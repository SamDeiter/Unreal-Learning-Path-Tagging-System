"""scrape_docs_via_api.py — fetch Epic UE5 docs via the SPA's internal JSON API.

Discovered 2026-04-29 by capturing dev.epicgames.com network traffic with
Playwright (see scripts/discover_docs_api.py). The docs SPA fetches:

  1. /community/api/documentation/table_of_content.json?path=/documentation/unreal-engine&lang=en-us
       → tree of all doc slugs across all UE versions
  2. /community/api/documentation/document.json?path=/documentation/unreal-engine/<slug>&lang=en-us
       → version-resolved content for a single page (HTML in `blocks[*].content_html`)

Both endpoints are gated by Cloudflare. Plain curl gets challenged, but if we
get CF clearance cookies via a real browser session first, in-page `fetch()`
calls from that session go straight through. Pattern is the same as
scripts/scrape_epic_learning.py — visit a landing page, then hit JSON
endpoints with same-origin credentials.

Why this beats the static-HTML scraper (scripts/scrape_epic_docs.py):
- Static HTML returns a 5KB Angular shell — content is JS-rendered → useless
- This API returns ~40KB of structured JSON per page, current UE version baked in
- TOC supplies the COMPLETE slug list (5.7, 5.8 included) — no curated list to maintain
- No HTML→text scraping; we parse one `content_html` field per block

Output: same shape as scrape_epic_docs.py — written to
path-builder/src/data/docs_embeddings.json so downstream consumers (Firestore
reindex, eval harness) don't need changes.

Usage:
    pip install playwright
    python -m playwright install chromium
    python scripts/scrape_docs_via_api.py --discover-only      # just dump the TOC slugs
    python scripts/scrape_docs_via_api.py --limit 5            # smoke test on 5 docs
    python scripts/scrape_docs_via_api.py                      # full run
"""

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

# Reuse helpers from the legacy scraper so chunking/embedding stays consistent.
sys.path.insert(0, str(Path(__file__).parent))
from scrape_epic_docs import (  # noqa: E402
    HTMLTextExtractor,
    chunk_doc,
    embed_text,
    estimate_tokens,
    get_access_token,
    save_checkpoint,
    DIMENSION,
    LOCATION,
    MODEL,
    OUTPUT_FILE,
    PROJECT_ID,
    TASK_TYPE,
)

LANDING_URL = "https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-migration-guide"
TOC_URL = "https://dev.epicgames.com/community/api/documentation/table_of_content.json?path=/documentation/unreal-engine&lang=en-us"
DOC_URL_TMPL = "https://dev.epicgames.com/community/api/documentation/document.json?path=/documentation/unreal-engine/{slug}&lang=en-us"

SCRAPED_DOCS = Path("content/scraped_docs_via_api.json")
CHECKPOINT_FILE = Path("content/docs_via_api_embedding_checkpoint.json")

# Per-page pause between API calls. Same-origin cookied calls don't trigger
# CF as eagerly as plain curl, but we still want to be polite — these
# requests hit Epic's backend, not just a CDN. Random 0.6-1.5s.
DELAY_MIN = 0.6
DELAY_MAX = 1.5


def html_to_text(html_content):
    """Strip HTML to plain text. Lifted from scrape_epic_docs.html_to_text;
    duplicating here so a future change to legacy chunking doesn't surprise us."""
    parser = HTMLTextExtractor()
    parser.feed(html_content)
    text = "".join(parser.result)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def extract_slugs_from_toc(toc):
    """Walk the TOC tree and pull every entry that has a live revision.
    TOC shape (verified 2026-04-29):
        {id, all_versions, application: {version}, entries: [
            {slug, title, has_live_revision, document_hash_id, sub_entries: [...]}
        ]}
    A node is content-bearing when has_live_revision is True. Both leaves and
    intermediate "category" nodes can have content (Epic puts content at
    section roots), so we collect every node with the flag set."""
    slugs = set()
    skip_prefixes = (
        "api-reference", "blueprint-api", "python-api", "web-api",
        "node-reference",
    )

    def walk(node):
        if isinstance(node, dict):
            slug = node.get("slug")
            if (
                isinstance(slug, str)
                and slug
                and node.get("has_live_revision") is True
            ):
                # Skip API reference pages (huge, low signal for tutoring).
                lower = slug.lower()
                if not any(lower.startswith(p) for p in skip_prefixes):
                    slugs.add(slug)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(toc)
    return sorted(slugs)


def doc_to_chunks(doc, slug):
    """Convert a document.json payload to chunks compatible with the legacy
    embedding output. Each block's content_html is HTML-decoded to text and
    chunked using the same chunk_doc() the legacy scraper uses, so chunk
    sizes / token counts match what's already in the corpus."""
    title = doc.get("title") or slug.replace("-", " ").title()
    blocks = doc.get("blocks") or []
    parts = []
    for b in blocks:
        # Most blocks carry HTML in content_html. Some non-content block
        # types (like switches/callouts/code-fences) may use other shapes —
        # be defensive and extract what we can.
        html = b.get("content_html") or ""
        if not html:
            # block-callout / block-switch sometimes nest content
            inner = b.get("content")
            if isinstance(inner, str):
                html = inner
            elif isinstance(inner, dict):
                html = inner.get("html", "") or ""
        if html:
            parts.append(html)
    full_html = "\n\n".join(parts)
    text = html_to_text(full_html)
    if not text or estimate_tokens(text) < 50:
        return None, None, 0
    chunks = chunk_doc(text, slug)
    return title, chunks, len(text)


async def fetch_in_page(page, url):
    """Use the browser's fetch() so the request inherits CF clearance cookies.
    Also passes the CSRF token from the page's <meta name="public-csrf-token">
    tag — the Angular app reads it from there and the API enforces it."""
    js_code = """
        async (url) => {
            try {
                const csrfMeta = document.querySelector('meta[name="public-csrf-token"]');
                const csrf = csrfMeta ? csrfMeta.getAttribute('content') : null;
                const headers = {'Accept': 'application/json, text/plain, */*'};
                if (csrf) {
                    headers['X-CSRF-Token'] = csrf;
                    headers['X-XSRF-TOKEN'] = csrf;
                }
                const resp = await fetch(url, {
                    credentials: 'include',
                    headers,
                });
                if (!resp.ok) {
                    const body = await resp.text();
                    return { _error: resp.status, _statusText: resp.statusText, _body: body.substring(0, 300) };
                }
                const text = await resp.text();
                try { return JSON.parse(text); }
                catch (e) { return { _error: 'json_parse', _body: text.substring(0, 300) }; }
            } catch (e) {
                return { _error: e.message };
            }
        }
    """
    return await page.evaluate(js_code, url)


async def collect_docs(slugs, page, sleep_jitter=True):
    """For each slug, navigate to the page and intercept the document.json
    response the SPA fetches naturally. We can't call the JSON endpoint
    directly (CF blocks the request shape even with same-origin cookies and
    a CSRF token), but driving the SPA through a normal navigation cleanly
    gets us the same payload. Slower (~3-4s/page) but reliable."""
    import random
    docs = []
    success = 0
    failed = 0

    for i, slug in enumerate(slugs):
        page_url = f"https://dev.epicgames.com/documentation/en-us/unreal-engine/{slug}"
        try:
            # expect_response sets up the listener BEFORE the navigation, so
            # we don't race against the SPA firing the request before we
            # start watching. wait_until="domcontentloaded" returns fast;
            # the listener is what tells us the data arrived.
            data = None
            try:
                async with page.expect_response(
                    lambda r: "/community/api/documentation/document.json" in r.url
                    and r.status == 200,
                    timeout=20000,
                ) as resp_info:
                    await page.goto(page_url, wait_until="domcontentloaded", timeout=45000)
                resp = await resp_info.value
                data = await resp.json()
            except Exception:
                data = None

            if not data:
                failed += 1
                if (i + 1) <= 5 or (i + 1) % 25 == 0:
                    print(f"  [{i+1}/{len(slugs)}] no document.json: {slug}")
                continue

            title, chunks, text_len = doc_to_chunks(data, slug)
            if not chunks:
                if sleep_jitter:
                    await asyncio.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
                continue

            docs.append({
                "slug": slug,
                "url": page_url,
                "title": title,
                "text_length": text_len,
                "chunk_count": len(chunks),
                "chunks": chunks,
                "updated_at": data.get("updated_at"),
                "hash_id": data.get("hash_id"),
            })
            success += 1
            if (i + 1) % 25 == 0:
                print(f"  [{i+1}/{len(slugs)}] scraped {success}, failed {failed}")

            if sleep_jitter:
                await asyncio.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

        except Exception as e:
            failed += 1
            print(f"  [{i+1}/{len(slugs)}] EXCEPTION: {slug} — {e}")

    print(f"\n  Scrape complete: {success} docs, {failed} failed/skipped, "
          f"{sum(d['chunk_count'] for d in docs)} total chunks")
    return docs


async def main_async(args):
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: pip install playwright && python -m playwright install chromium")
        return 1

    Path("content").mkdir(parents=True, exist_ok=True)

    # ─── Phase 1: Get CF clearance + discover slugs via TOC ──────────────────
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

        print("[1/4] Loading docs SPA to get CF clearance + capture TOC response...")
        captured_toc = {"data": None}

        async def capture_toc(response):
            if "/community/api/documentation/table_of_content.json" in response.url and response.status == 200:
                try:
                    captured_toc["data"] = await response.json()
                except Exception as e:
                    print(f"  (couldn't read TOC response: {e})")

        page.on("response", capture_toc)
        await page.goto(LANDING_URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(3000)
        page.remove_listener("response", capture_toc)

        if not captured_toc["data"]:
            print("  ERROR: never saw a table_of_content.json response. SPA may have changed.")
            await browser.close()
            return 1
        toc = captured_toc["data"]
        print("  OK — cookies + TOC acquired")

        print("\n[2/4] Extracting slugs from TOC...")
        slugs = extract_slugs_from_toc(toc)
        print(f"  Discovered {len(slugs)} doc slugs (post API/blueprint/python filter)")

        if args.limit:
            slugs = slugs[: args.limit]
            print(f"  --limit {args.limit} — testing first {len(slugs)} slugs")

        if args.discover_only:
            out = Path("content/docs_toc_slugs.json")
            with open(out, "w", encoding="utf-8") as f:
                json.dump(slugs, f, indent=2)
            print(f"\n[--discover-only] Saved {len(slugs)} slugs to {out}")
            await browser.close()
            return 0

        print(f"\n[3/4] Fetching document.json for {len(slugs)} slugs...")
        docs = await collect_docs(slugs, page)

        await browser.close()

    # Cache scraped docs to disk before we even try embedding — gives us
    # a recovery path if embedding fails partway through.
    SCRAPED_DOCS.parent.mkdir(parents=True, exist_ok=True)
    with open(SCRAPED_DOCS, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2)
    print(f"  Cached scraped docs to {SCRAPED_DOCS}")

    if args.scrape_only:
        print("\n[--scrape-only] Skipping embedding.")
        return 0

    if not docs and OUTPUT_FILE.exists():
        print(
            f"\nABORT: scrape produced 0 docs but {OUTPUT_FILE} exists. "
            f"Refusing to overwrite the production embeddings."
        )
        return 1

    # ─── Phase 4: Embed via Vertex (reuse legacy embed flow) ─────────────────
    print(f"\n[4/4] Embedding chunks via Vertex (project={PROJECT_ID}, model={MODEL})...")
    _ = get_access_token()  # fail fast on auth misconfig

    all_chunks = []
    for doc in docs:
        for chunk in doc["chunks"]:
            all_chunks.append({
                "id": f"doc_{len(all_chunks):04d}",
                "slug": doc["slug"],
                "url": doc["url"],
                "title": doc["title"],
                "section": chunk.get("section", ""),
                "text": chunk["text"],
                "token_estimate": chunk["token_estimate"],
            })
    print(f"  Total chunks to embed: {len(all_chunks)}")

    # Try to reuse hashes from the existing output to skip unchanged chunks.
    existing_hashes = {}
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, encoding="utf-8") as f:
                prev = json.load(f)
            for k, doc in (prev.get("docs") or {}).items():
                if "content_hash" in doc and "embedding" in doc:
                    existing_hashes[doc["content_hash"]] = doc["embedding"]
            print(f"  Loaded {len(existing_hashes)} prior embeddings for hash-based skip")
        except Exception as e:
            print(f"  (couldn't reuse prior embeddings: {e})")

    out_docs = {}
    skipped = 0
    re_embedded = 0
    errors = 0
    for i, chunk in enumerate(all_chunks):
        h = hashlib.sha256(chunk["text"].encode("utf-8")).hexdigest()
        if h in existing_hashes:
            embedding = existing_hashes[h]
            skipped += 1
        else:
            try:
                embedding = embed_text(chunk["text"])
                re_embedded += 1
                time.sleep(0.05)
            except Exception as e:
                errors += 1
                print(f"  [embed err] {chunk['id']}: {e}")
                continue
        out_docs[chunk["id"]] = {
            "embedding": embedding,
            "slug": chunk["slug"],
            "url": chunk["url"],
            "title": chunk["title"],
            "section": chunk["section"],
            "text": chunk["text"],
            "token_estimate": chunk["token_estimate"],
            "content_hash": h,
        }
        if (i + 1) % 50 == 0:
            print(f"    [{i+1}/{len(all_chunks)}] embedded ({re_embedded} new, {skipped} cached, {errors} err)")
            save_checkpoint(i + 1, len(out_docs))

    output = {
        "model": MODEL,
        "dimension": DIMENSION,
        "task_type": TASK_TYPE,
        "generated_at": datetime.now().isoformat(),
        "total_chunks": len(out_docs),
        "source": "dev.epicgames.com (api/documentation/document.json)",
        "source_hash": hashlib.sha256(json.dumps(sorted(d["slug"] for d in docs)).encode()).hexdigest()[:16],
        "docs": out_docs,
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f)
    print(f"\nDone! Wrote {len(out_docs)} chunks to {OUTPUT_FILE}")
    print(f"  New embeddings: {re_embedded}")
    print(f"  Cached (unchanged): {skipped}")
    print(f"  Errors: {errors}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Scrape UE docs via the SPA's internal API")
    parser.add_argument("--discover-only", action="store_true", help="Just dump the TOC slug list, don't fetch docs")
    parser.add_argument("--scrape-only", action="store_true", help="Fetch docs but skip embedding")
    parser.add_argument("--limit", type=int, default=None, help="Cap on slugs (smoke testing)")
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main() or 0)
