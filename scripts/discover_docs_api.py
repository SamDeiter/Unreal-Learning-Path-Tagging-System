"""discover_docs_api.py — find the content API endpoint dev.epicgames.com docs uses.

The docs site is an Angular SPA: a plain HTTP fetch returns a 5KB shell with
no body content. Real content is fetched client-side via XHR/fetch from some
internal API path. This script loads ONE doc page in headless Chromium,
captures every network request, and prints the ones that look like content
APIs — so we know what URL pattern to call directly going forward.

Run once, manually, when the docs site changes structure:
    pip install playwright
    python -m playwright install chromium
    python scripts/discover_docs_api.py
"""

import asyncio
import json
from urllib.parse import urlparse

# A known doc page that should have substantial content. The migration guide
# is good — it has version-aware blocks so the API call must include version
# context, which is exactly the case we need to handle.
TEST_URL = "https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-migration-guide"


def is_likely_content_api(url, content_type, body_size):
    """Heuristic for "this is the content API, not analytics/tracking/css/etc"."""
    parsed = urlparse(url)
    if parsed.netloc and "epicgames.com" not in parsed.netloc:
        return False
    path = parsed.path.lower()
    # Static assets and trackers — skip.
    skip_substrings = [
        "/cdn-cgi/", "/static/", "/_next/", "/assets/",
        "google-analytics", "gtm.js", "doubleclick",
        "/sentry/", "/logrocket/",
    ]
    if any(s in url.lower() for s in skip_substrings):
        return False
    # Static file extensions.
    if any(path.endswith(ext) for ext in (".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff", ".woff2", ".ico", ".map")):
        return False
    # The content API probably returns substantial JSON.
    if "json" in content_type and body_size and body_size > 1000:
        return True
    # API path conventions.
    if any(s in path for s in ("/api/", "/community/api/", "/documentation")):
        # But don't catch the SPA route itself (HTML).
        if "html" not in content_type:
            return True
    return False


async def main():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: pip install playwright && python -m playwright install chromium")
        return 1

    captured = []  # list of {url, method, status, content_type, body_size, sample}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/134.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        async def on_response(response):
            try:
                # Skip non-success responses for clarity, but log them too.
                ct = response.headers.get("content-type", "")
                # Only download bodies for things that smell like APIs — saves time.
                body_size = None
                sample = ""
                try:
                    body = await response.body()
                    body_size = len(body)
                    if "json" in ct or body_size < 5000:
                        sample = body[:400].decode("utf-8", errors="replace")
                except Exception:
                    pass
                captured.append({
                    "url": response.url,
                    "method": response.request.method,
                    "status": response.status,
                    "content_type": ct,
                    "body_size": body_size,
                    "sample": sample,
                })
            except Exception as e:
                print(f"  [warn] couldn't capture {response.url}: {e}")

        page.on("response", on_response)

        print(f"Loading {TEST_URL} ...")
        await page.goto(TEST_URL, wait_until="networkidle", timeout=60000)
        # Give Angular extra time to make any deferred fetches.
        await page.wait_for_timeout(3000)

        # Sanity check: pull rendered text to confirm content actually loaded.
        body_text = await page.evaluate(
            "() => document.querySelector('article, app-root, main, #content-blocks-renderer')?.innerText || ''"
        )
        print(f"\nRendered article text length: {len(body_text)} chars")
        print(f"First 300 chars: {body_text[:300]!r}\n")

        await browser.close()

    print("=" * 70)
    print(" CAPTURED REQUESTS — likely content APIs first")
    print("=" * 70)

    likely = [r for r in captured if is_likely_content_api(r["url"], r["content_type"], r["body_size"])]
    likely.sort(key=lambda r: r["body_size"] or 0, reverse=True)

    if not likely:
        print("(no obvious content-API responses captured)")
    else:
        for r in likely[:15]:
            size_kb = (r["body_size"] or 0) / 1024
            print(f"\n  {r['method']} {r['status']} {r['content_type']} {size_kb:.1f}KB")
            print(f"  {r['url']}")
            if r["sample"]:
                print(f"  sample: {r['sample'][:300]!r}")

    print("\n" + "=" * 70)
    print(f" ALL {len(captured)} REQUESTS (for reference)")
    print("=" * 70)
    for r in captured:
        size_kb = (r["body_size"] or 0) / 1024
        print(f"  {r['method']} {r['status']} {size_kb:6.1f}KB  {r['url']}")

    # Save the full capture to disk for follow-up inspection.
    out = "content/docs_api_discovery.json"
    import pathlib
    pathlib.Path("content").mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(captured, f, indent=2)
    print(f"\nFull capture saved to {out}")
    return 0


if __name__ == "__main__":
    asyncio.run(main())
