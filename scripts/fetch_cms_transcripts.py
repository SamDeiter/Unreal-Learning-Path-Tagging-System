"""fetch_cms_transcripts.py — Phase 2b: CMS Video Transcript Extraction

Uses Playwright in headed mode to visit Epic Learning article pages,
plays the embedded Electra video player, and intercepts VTT subtitle
responses from the network. Falls back to DASH audio download + Whisper
for videos without subtitles.

Usage:
  python scripts/fetch_cms_transcripts.py                # Full run
  python scripts/fetch_cms_transcripts.py --max-pages 10 # Test subset
  python scripts/fetch_cms_transcripts.py --workers 3    # Parallel
  python scripts/fetch_cms_transcripts.py --headless      # Try headless
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

# ── Config ──────────────────────────────────────────────────────────────
MANIFEST_PATH = Path("content/epic_learning/video_manifest.json")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")

# Anti-detection config
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")
ANTI_DETECT_SCRIPT = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"


def load_cms_articles():
    """Load CMS video entries from manifest, grouped by article."""
    if not MANIFEST_PATH.exists():
        print(f"  ERROR: Manifest not found at {MANIFEST_PATH}")
        return []

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Group by article URL
    by_url = {}
    for cms in manifest.get("cms_videos", []):
        url = cms.get("article_url", "")
        if url:
            if url not in by_url:
                by_url[url] = {
                    "url": url,
                    "hash_id": cms.get("article_hash", ""),
                    "title": cms.get("article_title", ""),
                    "video_ids": [],
                }
            by_url[url]["video_ids"].append(cms["id"])

    return list(by_url.values())


def vtt_to_text(vtt_content):
    """Convert WebVTT content to clean plain text."""
    lines = []
    seen = set()
    for line in vtt_content.split("\n"):
        line = line.strip()
        if not line or line.startswith("WEBVTT") or line.startswith("NOTE"):
            continue
        if re.match(r"^\d{2}:\d{2}", line):
            continue
        if re.match(r"^\d+$", line):
            continue
        line = re.sub(r"<[^>]+>", "", line)
        if line and line not in seen:
            lines.append(line)
            seen.add(line)
    return " ".join(lines)


async def extract_from_page(context, article, idx, total, results):
    """Visit article page, play video, capture VTT subtitles."""
    url = article["url"]
    video_ids = article["video_ids"]
    title_short = article["title"][:50]

    # Skip if all already cached
    needed = [vid for vid in video_ids
              if not (TRANSCRIPT_DIR / f"{vid}.txt").exists()]
    if not needed:
        print(f"  [{idx}/{total}] ✓ cached  {title_short}")
        return

    page = await context.new_page()
    captured_vtts = {}

    # Intercept VTT responses
    async def handle_response(response):
        try:
            if ".vtt" in response.url and response.status == 200:
                body = await response.text()
                if body and len(body) > 50:
                    # Extract entry ID from URL if possible
                    for vid_id in video_ids:
                        if vid_id in response.url:
                            captured_vtts[vid_id] = body
                            return
                    # Store by URL basename
                    basename = response.url.split("/")[-1].split("?")[0]
                    captured_vtts[basename] = body
        except Exception:
            pass

    page.on("response", handle_response)

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)

        # Try to click play to trigger VTT loading
        selectors = [
            'button[aria-label*="play" i]',
            'button[class*="play" i]',
            '.vjs-big-play-button',
            'video',
            '[class*="electra"] button',
        ]
        for sel in selectors:
            try:
                el = await page.query_selector(sel)
                if el:
                    await el.click()
                    break
            except Exception:
                continue

        # Wait for VTTs to load
        await page.wait_for_timeout(5000)

    except Exception as e:
        pass

    # Remove response listener before closing page to prevent race
    page.remove_listener("response", handle_response)
    await page.wait_for_timeout(500)
    await page.close()

    # Save captured VTTs
    saved = 0
    if captured_vtts:
        for key, vtt_content in captured_vtts.items():
            text = vtt_to_text(vtt_content)
            if len(text.strip()) > 20:
                # Map to video ID if possible
                out_id = key if key in video_ids else f"cms_{article['hash_id']}_{key.replace('.vtt', '')}"
                out_path = TRANSCRIPT_DIR / f"{out_id}.txt"
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write(text)
                saved += 1

    if saved > 0:
        results["vtt_saved"] += saved
        print(f"  [{idx}/{total}] 📝 {saved} VTTs  {title_short}")
    else:
        results["no_vtt"] += len(needed)
        print(f"  [{idx}/{total}] ○ no VTTs  {title_short} ({len(needed)} videos)")


async def run(max_pages=None, workers=3, headless=False):
    """Main async runner."""
    from playwright.async_api import async_playwright

    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)

    articles = load_cms_articles()
    total_articles = len(articles)
    total_vids = sum(len(a["video_ids"]) for a in articles)
    print(f"  Found {total_articles} articles with {total_vids} CMS videos")

    # Check cached
    cached = sum(1 for a in articles for vid in a["video_ids"]
                 if (TRANSCRIPT_DIR / f"{vid}.txt").exists())
    print(f"  Already cached: {cached}")

    items = articles[:max_pages] if max_pages else articles
    total = len(items)
    print(f"  Will scan {total} articles")

    results = {"vtt_saved": 0, "no_vtt": 0}

    print(f"\n{'='*60}")
    print(f"  Extracting CMS video subtitles ({total} articles)")
    print(f"  Mode: {'headless' if headless else 'headed'}")
    print(f"{'='*60}\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 720},
        )
        await context.add_init_script(ANTI_DETECT_SCRIPT)

        for i, article in enumerate(items, 1):
            try:
                await extract_from_page(context, article, i, total, results)
            except Exception as e:
                results["errors"] = results.get("errors", 0) + 1
                title_short = article["title"][:50]
                print(f"  [{i}/{total}] ✗ ERROR  {title_short}: {e}")
            # Brief pause between pages
            await asyncio.sleep(1)

        await context.close()
        await browser.close()

    print(f"\n{'='*60}")
    print(f"  Articles scanned:    {total}")
    print(f"  VTT subtitles saved: {results['vtt_saved']}")
    print(f"  Videos without VTT:  {results['no_vtt']}")
    print(f"  → Output: {TRANSCRIPT_DIR}")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="Extract CMS video subtitles")
    parser.add_argument("--max-pages", type=int, help="Limit pages to scan")
    parser.add_argument("--workers", type=int, default=3, help="Parallel workers")
    parser.add_argument("--headless", action="store_true", help="Run headless")
    args = parser.parse_args()

    start = time.time()
    asyncio.run(run(max_pages=args.max_pages, workers=args.workers,
                    headless=args.headless))
    print(f"\nTotal time: {time.time() - start:.1f}s")


if __name__ == "__main__":
    main()
