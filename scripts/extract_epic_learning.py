"""extract_epic_learning.py — Phase 2: Content Extraction Worker

Reads the catalog built by scrape_epic_learning.py and fetches the full
content for each entry via Epic's detail API:
  /community/api/learning/post.json?hash_id={hash_id}

The API returns structured 'blocks' (header, paragraph, code_snippet, etc.)
which are converted directly to Markdown — no DOM scraping needed.

Output per entry:
  content/epic_learning/extracted/{hash_id}.md
  content/epic_learning/extracted/{hash_id}.meta.json

Usage:
  python scripts/extract_epic_learning.py [--limit N] [--resume]
"""

import asyncio
import json
import random
import re
import sys
import time
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
LANDING_URL = "https://dev.epicgames.com/community/unreal-engine/learning?source=epic_games"
DETAIL_API = "/community/api/learning/post.json"
CATALOG_FILE = Path("content/epic_learning/catalog.json")
OUTPUT_DIR = Path("content/epic_learning/extracted")
JITTER_MIN = 1.0
JITTER_MAX = 2.5
BATCH_SIZE = 50  # Save catalog checkpoint every N items


# ── Block → Markdown Converter ──────────────────────────────────────────
def blocks_to_markdown(blocks):
    """Convert Epic's structured blocks array to clean Markdown."""
    lines = []
    for block in blocks:
        btype = block.get("type", "")

        if btype == "header":
            level = block.get("level", 2)
            text = _inline_text(block.get("children", []))
            lines.append(f"\n{'#' * level} {text}\n")

        elif btype == "paragraph":
            text = _inline_text(block.get("children", []))
            if text.strip():
                lines.append(f"{text}\n")

        elif btype == "code_snippet":
            lang = block.get("language", "")
            code = block.get("code", "")
            lines.append(f"\n```{lang}\n{code}\n```\n")

        elif btype == "image":
            alt = block.get("alt", "")
            url = block.get("url", block.get("src", ""))
            if url:
                lines.append(f"\n![{alt}]({url})\n")

        elif btype == "enhanced_list":
            items = block.get("items", block.get("children", []))
            style = block.get("list_style", "unordered")
            for i, item in enumerate(items):
                prefix = f"{i+1}." if style == "ordered" else "-"
                text = _extract_list_item_text(item)
                lines.append(f"{prefix} {text}")
            lines.append("")

        elif btype == "blockquote":
            text = _inline_text(block.get("children", []))
            for line in text.split("\n"):
                lines.append(f"> {line}")
            lines.append("")

        elif btype == "table":
            _render_table(block, lines)

        elif btype == "video":
            vid_url = block.get("url", block.get("src", ""))
            if vid_url:
                lines.append(f"\n[Video: {vid_url}]\n")

        elif btype == "youtube":
            yt_id = block.get("youtube_id", block.get("video_id", ""))
            if yt_id:
                lines.append(f"\n[YouTube: https://youtube.com/watch?v={yt_id}]\n")

        elif btype == "embed":
            embed_url = block.get("url", "")
            if embed_url:
                lines.append(f"\n[Embed: {embed_url}]\n")

        elif btype == "divider" or btype == "horizontal_rule":
            lines.append("\n---\n")

        else:
            # Fallback: try to extract text from children
            text = _inline_text(block.get("children", []))
            if text.strip():
                lines.append(f"{text}\n")

    return "\n".join(lines).strip()


def _inline_text(children):
    """Convert inline children to text with basic formatting."""
    if not children:
        return ""
    parts = []
    for child in children:
        if isinstance(child, str):
            parts.append(child)
        elif isinstance(child, dict):
            text = child.get("text", "")
            if not text and "children" in child:
                text = _inline_text(child["children"])

            # Apply formatting
            if child.get("bold"):
                text = f"**{text}**"
            if child.get("italic"):
                text = f"*{text}*"
            if child.get("code"):
                text = f"`{text}`"
            if child.get("type") == "link":
                url = child.get("url", "")
                text = f"[{text}]({url})"

            parts.append(text)
    return "".join(parts)


def _extract_list_item_text(item):
    """Extract text from a list item (may have nested structure)."""
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        text = item.get("text", "")
        if not text and "children" in item:
            text = _inline_text(item.get("children", []))
        if not text and "content" in item:
            text = _inline_text(item.get("content", []))
        return text or ""
    return str(item)


def _render_table(block, lines):
    """Render a table block to Markdown."""
    rows = block.get("rows", block.get("children", []))
    if not rows:
        return
    lines.append("")
    for i, row in enumerate(rows):
        cells = row.get("cells", row.get("children", []))
        row_text = " | ".join(_inline_text(c.get("children", [])) if isinstance(c, dict) else str(c) for c in cells)
        lines.append(f"| {row_text} |")
        if i == 0:
            lines.append("|" + " --- |" * len(cells))
    lines.append("")


# ── Fetch Helper ────────────────────────────────────────────────────────
JS_FETCH = """
    async (hashId) => {
        try {
            const resp = await fetch(
                '/community/api/learning/post.json?hash_id=' + hashId,
                {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'x-environment-descriptor': 'Web-UE/' + navigator.userAgent
                    }
                }
            );
            if (!resp.ok) return { _error: resp.status };
            return await resp.json();
        } catch (e) {
            return { _error: e.message };
        }
    }
"""


async def extract_all():
    """Extract content for all pending catalog entries."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: pip install playwright && python -m playwright install chromium")
        sys.exit(1)

    # Parse CLI args
    limit = None
    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    # Load catalog
    with open(CATALOG_FILE, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    # Filter to pending items
    pending = [item for item in catalog if item.get("status") == "pending"]
    if limit:
        pending = pending[:limit]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Build hash_id → catalog index map for status updates
    catalog_map = {item["hash_id"]: item for item in catalog}

    print("=" * 60)
    print(f" Epic Learning Content Extractor")
    print(f" {len(pending)} pending / {len(catalog)} total")
    print("=" * 60)

    if not pending:
        print("\n  Nothing to extract — all items processed!")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Get Cloudflare clearance
        print("\n[1/2] Getting Cloudflare clearance...")
        await page.goto(LANDING_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(5000)
        print("  ✓ Cookies acquired")

        # Process items
        print(f"\n[2/2] Extracting content...")
        success = 0
        failed = 0

        for i, item in enumerate(pending):
            hash_id = item["hash_id"]
            title = item.get("title", "")[:50]
            md_path = OUTPUT_DIR / f"{hash_id}.md"
            meta_path = OUTPUT_DIR / f"{hash_id}.meta.json"

            # Skip if already extracted
            if md_path.exists():
                catalog_map[hash_id]["status"] = "processed"
                success += 1
                continue

            try:
                result = await page.evaluate(JS_FETCH, hash_id)

                if isinstance(result, dict) and "_error" in result:
                    print(f"  [{i+1}/{len(pending)}] ✗ {title}... — error {result['_error']}")
                    catalog_map[hash_id]["status"] = "failed"
                    failed += 1
                    continue

                # Extract blocks and convert to Markdown
                blocks = result.get("blocks", [])
                api_title = result.get("title", title)
                description = result.get("description", "")

                # Build Markdown document
                md_parts = [f"# {api_title}\n"]
                if description:
                    md_parts.append(f"*{description}*\n")
                if blocks:
                    md_parts.append(blocks_to_markdown(blocks))

                markdown = "\n".join(md_parts)

                # Extract video references for later transcript processing
                videos = _extract_video_refs(blocks, result)

                # Save Markdown
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(markdown)

                # Save metadata
                meta = {
                    "hash_id": hash_id,
                    "title": api_title,
                    "description": description,
                    "url": item.get("url", ""),
                    "content_type": item.get("content_type", ""),
                    "author": item.get("author", ""),
                    "tags": item.get("tags", []),
                    "published_at": item.get("published_at", ""),
                    "views": item.get("views", 0),
                    "word_count": len(markdown.split()),
                    "block_count": len(blocks),
                    "videos": videos,
                    "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2, ensure_ascii=False)

                catalog_map[hash_id]["status"] = "processed"
                success += 1
                print(f"  [{i+1}/{len(pending)}] ✓ {title}... ({len(markdown)} chars, {len(videos)} videos)")

            except Exception as e:
                print(f"  [{i+1}/{len(pending)}] ✗ {title}... — {e}")
                catalog_map[hash_id]["status"] = "failed"
                failed += 1

            # Checkpoint catalog status
            if (i + 1) % BATCH_SIZE == 0:
                _save_catalog(list(catalog_map.values()))
                print(f"  [checkpoint] {success} ok, {failed} failed")

            # Polite delay
            await asyncio.sleep(random.uniform(JITTER_MIN, JITTER_MAX))

        await browser.close()

    # Final save
    _save_catalog(list(catalog_map.values()))

    print(f"\n{'=' * 60}")
    print(f"  ✓ Extracted: {success}")
    print(f"  ✗ Failed:    {failed}")
    print(f"  → Output:    {OUTPUT_DIR}")
    print(f"{'=' * 60}")


def _extract_video_refs(blocks, result):
    """Extract video references from blocks for transcript processing."""
    videos = []
    for block in blocks:
        btype = block.get("type", "")
        if btype == "youtube":
            yt_id = block.get("youtube_id", block.get("video_id", ""))
            if yt_id:
                videos.append({"type": "youtube", "id": yt_id})
        elif btype == "video":
            url = block.get("url", block.get("src", ""))
            if url:
                videos.append({"type": "epic_video", "url": url})
        elif btype == "embed":
            url = block.get("url", "")
            if url and ("youtube" in url or "youtu.be" in url):
                yt_match = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
                if yt_match:
                    videos.append({"type": "youtube", "id": yt_match.group(1)})
            elif url:
                videos.append({"type": "embed", "url": url})
    return videos


def _save_catalog(items):
    """Save updated catalog with status changes."""
    items.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    with open(CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    start = time.time()
    asyncio.run(extract_all())
    print(f"\nTotal time: {time.time() - start:.1f}s")
