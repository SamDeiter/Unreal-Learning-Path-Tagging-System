"""scrape_epic_learning.py — Phase 1: Epic Learning Catalog Spider

Uses Playwright to bypass Cloudflare, then paginates through Epic's
learning catalog API using the browser context's built-in fetch.

Output: content/epic_learning/catalog.json

Usage:
  pip install playwright
  python -m playwright install chromium
  python scripts/scrape_epic_learning.py
"""

import asyncio
import json
import random
import sys
import time
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
LANDING_URL = "https://dev.epicgames.com/community/unreal-engine/learning?source=epic_games"
API_BASE = "/community/api/learning/search.json"
OUTPUT_DIR = Path("content/epic_learning")
CATALOG_FILE = OUTPUT_DIR / "catalog.json"
PER_PAGE = 20
MAX_PAGES = 200
JITTER_MIN = 1.5
JITTER_MAX = 3.5

CONTENT_TYPES = ["tutorial", "course", "talks_and_demos", "knowledge_base"]


def build_api_path(page_num):
    """Build the relative API path with query params."""
    types = "&".join(f"types%5B%5D={t}" for t in CONTENT_TYPES)
    return (
        f"{API_BASE}?{types}"
        f"&application_families%5B%5D=unreal_engine"
        f"&sort_by=first_published_at"
        f"&page={page_num}&per_page={PER_PAGE}"
    )


def parse_item(item):
    """Extract a clean catalog entry from an API response item."""
    hash_id = item.get("entity_hash_id", "")
    entity_type = item.get("entity_type", "snippet")
    slug = item.get("entity_slug", "")
    profile = item.get("profile") or {}

    return {
        "hash_id": hash_id,
        "title": item.get("title", ""),
        "slug": slug,
        "url": f"https://dev.epicgames.com/community/learning/{entity_type}/{hash_id}/{slug}",
        "content_type": entity_type,
        "description": item.get("description", ""),
        "author": profile.get("display_name", "Unknown"),
        "tags": [t.get("name", "") for t in (item.get("tags") or [])],
        "published_at": item.get("published_at", ""),
        "views": item.get("views_count", 0),
        "status": "pending",
    }


async def fetch_page_via_browser(page, page_num):
    """Use in-page JavaScript fetch with same-origin credentials."""
    api_path = build_api_path(page_num)

    # Use relative URL so the browser sends it as same-origin with all cookies
    js_code = """
        async (apiPath) => {
            try {
                const resp = await fetch(apiPath, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'x-environment-descriptor': 'Web-UE/' + navigator.userAgent
                    }
                });
                if (!resp.ok) {
                    const body = await resp.text();
                    return { _error: resp.status, _statusText: resp.statusText, _body: body.substring(0, 300) };
                }
                const text = await resp.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { _error: 'json_parse', _body: text.substring(0, 200) };
                }
            } catch (e) {
                return { _error: e.message };
            }
        }
    """
    return await page.evaluate(js_code, api_path)


async def build_catalog():
    """Crawl the Epic Learning API and build a full catalog."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: pip install playwright && python -m playwright install chromium")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Resume from existing catalog
    existing = {}
    if CATALOG_FILE.exists():
        with open(CATALOG_FILE, "r", encoding="utf-8") as f:
            for item in json.load(f):
                existing[item["hash_id"]] = item
        print(f"  Resume: {len(existing)} existing entries loaded")

    print("=" * 60)
    print(" Epic Learning Catalog Spider")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Step 1: Get Cloudflare clearance by visiting the SPA
        print("\n[1/3] Getting Cloudflare clearance...")
        await page.goto(LANDING_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(5000)  # Give extra time for CF challenge
        print("  ✓ Cookies acquired")

        # Step 2: Paginate through the API using same-origin fetch
        print("\n[2/3] Fetching catalog via API...")
        all_items = dict(existing)
        total_new = 0
        consecutive_empty = 0

        for page_num in range(1, MAX_PAGES + 1):
            try:
                result = await fetch_page_via_browser(page, page_num)
            except Exception as e:
                print(f"  ✗ Page {page_num}: Exception: {e}")
                consecutive_empty += 1
                if consecutive_empty >= 3:
                    break
                continue

            # Check for errors
            if isinstance(result, dict) and "_error" in result:
                err = result["_error"]
                body = result.get("_body", "")[:100]
                print(f"  ✗ Page {page_num}: error={err} {body}")
                consecutive_empty += 1
                if consecutive_empty >= 3:
                    print("  3 consecutive failures — stopping")
                    break
                continue

            consecutive_empty = 0

            # Debug: show structure on first page
            if page_num == 1:
                if isinstance(result, dict):
                    keys = list(result.keys())
                    print(f"  DEBUG: Response keys: {keys}")
                    if "data" in result and result["data"]:
                        first = result["data"][0]
                        print(f"  DEBUG: First item keys: {list(first.keys())[:10]}")
                        print(f"  DEBUG: First title: {first.get('title', 'N/A')[:60]}")
                else:
                    print(f"  DEBUG: response type: {type(result).__name__}")

            # Extract items
            data = result.get("data", []) if isinstance(result, dict) else []
            if not data:
                print(f"  ✓ Page {page_num}: No more results — catalog complete")
                break

            page_new = 0
            for item in data:
                hash_id = item.get("entity_hash_id", "")
                if not hash_id or hash_id in all_items:
                    continue
                all_items[hash_id] = parse_item(item)
                page_new += 1

            total_new += page_new
            print(f"  Page {page_num}: {len(data)} items ({page_new} new) — total: {len(all_items)}")

            # Checkpoint every page
            _save_catalog(all_items)

            # Polite delay
            delay = random.uniform(JITTER_MIN, JITTER_MAX)
            await asyncio.sleep(delay)

        await browser.close()

    # Step 3: Final save
    print(f"\n[3/3] Saving catalog...")
    _save_catalog(all_items)
    print(f"  ✓ {len(all_items)} total entries ({total_new} new this run)")
    print(f"  → Saved to {CATALOG_FILE}")

    # Summary by type
    types = {}
    for item in all_items.values():
        t = item.get("content_type", "unknown")
        types[t] = types.get(t, 0) + 1
    if types:
        print(f"\n  Content types: {json.dumps(types, indent=2)}")


def _save_catalog(items_dict):
    """Save catalog sorted by publish date."""
    items = sorted(items_dict.values(), key=lambda x: x.get("published_at", ""), reverse=True)
    with open(CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    start = time.time()
    asyncio.run(build_catalog())
    print(f"\nTotal time: {time.time() - start:.1f}s")
