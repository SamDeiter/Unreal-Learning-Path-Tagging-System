"""discover_epic_videos.py — Phase 1: Video Discovery

Visits every Epic Learning page (from extracted .meta.json) using Playwright
and detects embedded YouTube iframes and Epic CMS video iframes.

Output: content/epic_learning/video_manifest.json

Usage:
  pip install playwright
  playwright install chromium
  python scripts/discover_epic_videos.py
  python scripts/discover_epic_videos.py --max-pages 50   # test subset
  python scripts/discover_epic_videos.py --workers 3       # parallel
"""

import argparse
import asyncio
import json
import os
import re
import time
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
EXTRACTED_DIR = Path("content/epic_learning/extracted")
MANIFEST_PATH = Path("content/epic_learning/video_manifest.json")
PAGE_TIMEOUT = 15_000   # ms to wait for page load
BATCH_DELAY = 0.5       # seconds between requests


# ── URL correction ──────────────────────────────────────────────────────
# Meta.json stores singular types (tutorial, course) but Epic's Angular
# router uses plurals (tutorials, courses). Singular URLs silently
# redirect to the learning hub, returning empty content.
URL_TYPE_FIXES = {
    "/learning/tutorial/": "/learning/tutorials/",
    "/learning/course/": "/learning/courses/",
    "/learning/talks_and_demos/": "/learning/talks-and-demos/",
    "/learning/knowledge_base/": "/learning/knowledge-base/",
}


def fix_url(url):
    """Fix singular/underscore content types in URLs to match Epic's router."""
    for wrong, right in URL_TYPE_FIXES.items():
        if wrong in url:
            return url.replace(wrong, right)
    return url


# ── Collect URLs from meta files ────────────────────────────────────────
def collect_urls():
    """Read all .meta.json files and return list of {hash_id, url, title, content_type}."""
    pages = []
    for meta_file in sorted(EXTRACTED_DIR.glob("*.meta.json")):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            url = meta.get("url", "")
            if url and "dev.epicgames.com" in url:
                pages.append({
                    "hash_id": meta.get("hash_id", meta_file.stem),
                    "url": fix_url(url),
                    "title": meta.get("title", "Unknown"),
                    "content_type": meta.get("content_type", "unknown"),
                })
        except (json.JSONDecodeError, IOError):
            continue
    return pages


# ── JS snippet to extract video iframes ─────────────────────────────────
EXTRACT_JS = """() => {
    const iframes = Array.from(document.querySelectorAll('iframe'));
    const youtube = [];
    const cms = [];

    for (const iframe of iframes) {
        const src = iframe.src || '';

        // YouTube embeds (youtube.com or youtube-nocookie.com)
        const ytMatch = src.match(/youtube(?:-nocookie)?\\.com\\/embed\\/([a-zA-Z0-9_-]+)/);
        if (ytMatch) {
            youtube.push(ytMatch[1]);
            continue;
        }

        // Epic CMS video embeds
        const cmsMatch = src.match(/\\/api\\/cms\\/videos\\/([A-Za-z0-9_]+)\\/embed/);
        if (cmsMatch) {
            cms.push(cmsMatch[1]);
        }
    }

    return { youtube, cms };
}"""


# ── Visit a single page ─────────────────────────────────────────────────
async def visit_page(page, page_info):
    """Navigate to a page and extract video references."""
    url = page_info["url"]
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT)
        # Wait for Angular to render video components (electra-player or iframe)
        try:
            await page.wait_for_selector(
                "iframe, electra-player, block-video",
                timeout=8000
            )
            # Extra wait for iframe src to populate
            await page.wait_for_timeout(1500)
        except Exception:
            # Page may not have videos — give minimal time for any late renders
            await page.wait_for_timeout(2000)

        result = await page.evaluate(EXTRACT_JS)
        return {
            "hash_id": page_info["hash_id"],
            "title": page_info["title"],
            "url": url,
            "content_type": page_info["content_type"],
            "youtube_ids": result.get("youtube", []),
            "cms_video_ids": result.get("cms", []),
        }
    except Exception as e:
        return {
            "hash_id": page_info["hash_id"],
            "title": page_info["title"],
            "url": url,
            "content_type": page_info["content_type"],
            "youtube_ids": [],
            "cms_video_ids": [],
            "error": str(e)[:100],
        }


# ── Worker coroutine ────────────────────────────────────────────────────
# Anti-detection config — Epic's Angular SPA blocks standard headless Chromium
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")
ANTI_DETECT_SCRIPT = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"


async def worker(browser, queue, results, worker_id, total):
    """Process pages from queue using a dedicated browser context."""
    context = await browser.new_context(
        user_agent=USER_AGENT,
        viewport={"width": 1280, "height": 720},
    )
    await context.add_init_script(ANTI_DETECT_SCRIPT)
    page = await context.new_page()

    while not queue.empty():
        idx, page_info = await queue.get()
        result = await visit_page(page, page_info)
        results.append(result)

        yt_count = len(result["youtube_ids"])
        cms_count = len(result["cms_video_ids"])
        status = ""
        if yt_count:
            status += f" 🎬 {yt_count} YT"
        if cms_count:
            status += f" 📹 {cms_count} CMS"
        if result.get("error"):
            status += f" ⚠ err"
        if not status:
            status = " ○"

        print(f"  [{idx+1}/{total}] W{worker_id}{status}  {result['title'][:50]}")

        await asyncio.sleep(BATCH_DELAY)

    await context.close()


# ── Main async runner ───────────────────────────────────────────────────
async def run(pages, num_workers=1):
    """Launch Playwright and process all pages."""
    from playwright.async_api import async_playwright

    queue = asyncio.Queue()
    for i, p in enumerate(pages):
        await queue.put((i, p))

    results = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )

        workers = [
            worker(browser, queue, results, w_id, len(pages))
            for w_id in range(num_workers)
        ]
        await asyncio.gather(*workers)

        await browser.close()

    return results


# ── Build manifest ──────────────────────────────────────────────────────
def build_manifest(results):
    """Aggregate results into a structured manifest."""
    all_youtube = []
    all_cms = []
    articles_with_video = 0
    errors = 0

    for r in results:
        has_video = False

        for yt_id in r["youtube_ids"]:
            all_youtube.append({
                "id": yt_id,
                "article_hash": r["hash_id"],
                "article_title": r["title"],
                "article_url": r["url"],
                "content_type": r["content_type"],
            })
            has_video = True

        for cms_id in r["cms_video_ids"]:
            all_cms.append({
                "id": cms_id,
                "article_hash": r["hash_id"],
                "article_title": r["title"],
                "article_url": r["url"],
                "content_type": r["content_type"],
            })
            has_video = True

        if has_video:
            articles_with_video += 1
        if r.get("error"):
            errors += 1

    # Deduplicate by video ID
    seen_yt = set()
    unique_youtube = []
    for v in all_youtube:
        if v["id"] not in seen_yt:
            seen_yt.add(v["id"])
            unique_youtube.append(v)

    seen_cms = set()
    unique_cms = []
    for v in all_cms:
        if v["id"] not in seen_cms:
            seen_cms.add(v["id"])
            unique_cms.append(v)

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_pages_scanned": len(results),
        "articles_with_videos": articles_with_video,
        "errors": errors,
        "youtube_videos": unique_youtube,
        "youtube_count": len(unique_youtube),
        "cms_videos": unique_cms,
        "cms_count": len(unique_cms),
        "total_unique_videos": len(unique_youtube) + len(unique_cms),
    }


# ── Entry point ─────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Discover videos on Epic Learning pages")
    parser.add_argument("--max-pages", type=int, default=0,
                        help="Limit number of pages to scan (0 = all)")
    parser.add_argument("--workers", type=int, default=3,
                        help="Number of parallel browser contexts (default: 3)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip pages already in existing manifest")
    args = parser.parse_args()

    print("Collecting URLs from extracted metadata...")
    pages = collect_urls()
    print(f"  Found {len(pages)} pages to scan")

    # Filter by content type — prioritize types likely to have videos
    video_types = {"talks_and_demos", "tutorials", "courses", "course"}
    video_pages = [p for p in pages if p["content_type"] in video_types]
    other_pages = [p for p in pages if p["content_type"] not in video_types]
    # Scan video-likely types first, then all others
    ordered = video_pages + other_pages
    print(f"  Priority: {len(video_pages)} video-likely types, {len(other_pages)} others")

    if args.resume and MANIFEST_PATH.exists():
        existing = json.load(open(MANIFEST_PATH, "r", encoding="utf-8"))
        scanned_hashes = set()
        for v in existing.get("youtube_videos", []):
            scanned_hashes.add(v["article_hash"])
        for v in existing.get("cms_videos", []):
            scanned_hashes.add(v["article_hash"])
        # Also mark pages that were scanned but had no videos
        # (we'd need to store all scanned hashes for proper resume)
        ordered = [p for p in ordered if p["hash_id"] not in scanned_hashes]
        print(f"  Resuming: {len(ordered)} pages remaining")

    if args.max_pages > 0:
        ordered = ordered[:args.max_pages]
        print(f"  Limited to {args.max_pages} pages")

    if not ordered:
        print("  No pages to scan!")
        return

    print(f"\n{'='*60}")
    print(f"  Scanning {len(ordered)} pages with {args.workers} worker(s)")
    print(f"{'='*60}\n")

    results = asyncio.run(run(ordered, num_workers=args.workers))

    manifest = build_manifest(results)

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  Pages scanned:        {manifest['total_pages_scanned']}")
    print(f"  Articles with videos: {manifest['articles_with_videos']}")
    print(f"  YouTube videos:       {manifest['youtube_count']}")
    print(f"  CMS videos:           {manifest['cms_count']}")
    print(f"  Total unique videos:  {manifest['total_unique_videos']}")
    print(f"  Errors:               {manifest['errors']}")
    print(f"  → Manifest: {MANIFEST_PATH}")
    print(f"{'='*60}")


if __name__ == "__main__":
    start = time.time()
    main()
    print(f"\nTotal time: {time.time() - start:.1f}s")
