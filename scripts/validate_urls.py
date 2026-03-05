#!/usr/bin/env python3
"""
URL Health Checker for Unreal Learning Path data files.

Scans JSON data files for URLs, validates them via HEAD requests,
and uses Google site-search to suggest replacements for broken ones.

Usage:
    python scripts/validate_urls.py              # Report only (stdout + JSON)
    python scripts/validate_urls.py --fix        # Report + patch JSON files
    python scripts/validate_urls.py --verbose    # Extra logging
"""

import argparse
import json
import os
import re
import sys
import time
import hashlib
from pathlib import Path
from urllib.parse import urlparse, quote_plus

# ---------------------------------------------------------------------------
# Optional imports (graceful degradation)
# ---------------------------------------------------------------------------
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "path-builder" / "src" / "data"
REPORT_PATH = Path(__file__).resolve().parent / "url_health_report.json"

# Files to scan for URLs
TARGET_FILES = [
    "video_library_enriched.json",
    "doc_links.json",
    "challengeRegistry.json",
    "youtube_curated.json",
    "external_sources.json",
]

# URL patterns we care about
URL_DOMAINS = [
    "dev.epicgames.com",
    "docs.unrealengine.com",
    "youtube.com",
    "youtu.be",
]

# Rate limiting
REQUEST_DELAY = 1.0  # seconds between requests
GOOGLE_DELAY = 3.0   # seconds between Google searches (be polite)
REQUEST_TIMEOUT = 15  # seconds

# Status codes that indicate broken URLs
BROKEN_CODES = {404, 410, 403, 500, 502, 503}

# YouTube oembed for lightweight validation
YOUTUBE_OEMBED = "https://www.youtube.com/oembed?url={url}&format=json"


def extract_urls_from_json(filepath: Path) -> list[dict]:
    """Recursively extract all URLs and their context from a JSON file."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    urls = []

    def walk(obj, path=""):
        if isinstance(obj, str):
            # Check if string looks like a URL
            if obj.startswith("http://") or obj.startswith("https://"):
                domain = urlparse(obj).netloc
                if any(d in domain for d in URL_DOMAINS):
                    urls.append({
                        "url": obj,
                        "file": filepath.name,
                        "json_path": path,
                        "domain": domain,
                    })
        elif isinstance(obj, dict):
            for k, v in obj.items():
                walk(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk(v, f"{path}[{i}]")

    walk(data)
    return urls


def get_title_context(filepath: Path, json_path: str) -> str:
    """Try to extract a title or name near the URL in the JSON for search context."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Navigate to the parent object of the URL
    parts = re.findall(r'\.(\w+)|\[(\d+)\]', json_path)
    obj = data
    parent = data
    for dot_key, bracket_idx in parts:
        parent = obj
        if dot_key:
            obj = obj.get(dot_key, obj) if isinstance(obj, dict) else obj
        elif bracket_idx:
            idx = int(bracket_idx)
            obj = obj[idx] if isinstance(obj, list) and idx < len(obj) else obj

    # Look for title-like keys in the parent object
    if isinstance(parent, dict):
        for key in ["title", "name", "course_title", "label", "description"]:
            if key in parent and isinstance(parent[key], str):
                return parent[key][:100]

    return ""


def check_url_health(url: str) -> dict:
    """Check if a URL is alive. Returns status info."""
    if not HAS_REQUESTS:
        return {"status": "skipped", "reason": "requests not installed"}

    domain = urlparse(url).netloc

    # YouTube: use oembed
    if "youtube.com" in domain or "youtu.be" in domain:
        try:
            resp = requests.get(
                YOUTUBE_OEMBED.format(url=quote_plus(url)),
                timeout=REQUEST_TIMEOUT,
            )
            return {
                "status": "ok" if resp.status_code == 200 else "broken",
                "code": resp.status_code,
            }
        except requests.RequestException as e:
            return {"status": "error", "reason": str(e)}

    # Epic / UE docs: HEAD request
    try:
        resp = requests.head(
            url,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
            headers={"User-Agent": "UE5-LearningPath-URLChecker/1.0"},
        )
        # Epic SPA returns 200 for everything but empty page
        # Check if we got redirected to a generic page
        final_url = resp.url
        status = "ok"
        if resp.status_code in BROKEN_CODES:
            status = "broken"
        elif resp.status_code == 200 and final_url != url:
            status = "redirected"

        return {
            "status": status,
            "code": resp.status_code,
            "final_url": final_url if final_url != url else None,
        }
    except requests.RequestException as e:
        return {"status": "error", "reason": str(e)}


def search_replacement(title: str, domain: str) -> str | None:
    """Use Google search to find a replacement URL."""
    if not title:
        return None

    query = f"site:{domain} {title}"
    search_url = f"https://www.google.com/search?q={quote_plus(query)}&num=3"

    try:
        resp = requests.get(
            search_url,
            timeout=REQUEST_TIMEOUT,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
        )
        if resp.status_code != 200:
            return None

        # Extract URLs from Google results (simple regex, not a full parser)
        # Look for URLs matching our target domain
        pattern = rf'https?://{re.escape(domain)}[^\s"<>\'&]*'
        matches = re.findall(pattern, resp.text)

        # Filter out Google tracking URLs and duplicates
        seen = set()
        candidates = []
        for m in matches:
            # Clean up common URL artifacts
            m = m.split("&")[0].rstrip("/")
            if m not in seen and "/search?" not in m:
                seen.add(m)
                candidates.append(m)

        return candidates[0] if candidates else None

    except requests.RequestException:
        return None


def apply_fixes(fixes: list[dict]):
    """Apply URL replacements to the source JSON files."""
    # Group fixes by file
    by_file: dict[str, list] = {}
    for fix in fixes:
        fname = fix["file"]
        if fname not in by_file:
            by_file[fname] = []
        by_file[fname].append(fix)

    for fname, file_fixes in by_file.items():
        filepath = DATA_DIR / fname
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        for fix in file_fixes:
            old_url = fix["url"]
            new_url = fix["suggested_replacement"]
            if new_url and old_url in content:
                content = content.replace(old_url, new_url)
                print(f"  ✓ Patched: {old_url[:60]}... → {new_url[:60]}...")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)


def main():
    parser = argparse.ArgumentParser(description="URL Health Checker")
    parser.add_argument("--fix", action="store_true", help="Auto-patch broken URLs")
    parser.add_argument("--verbose", action="store_true", help="Extra logging")
    args = parser.parse_args()

    if not HAS_REQUESTS:
        print("⚠  'requests' package not installed. Install with: pip install requests")
        print("   Running in scan-only mode (no HTTP validation).\n")

    if not DATA_DIR.exists():
        print(f"✗ Data directory not found: {DATA_DIR}")
        sys.exit(1)

    # Phase 1: Extract all URLs
    print("━" * 60)
    print("Phase 1: Scanning data files for URLs...")
    print("━" * 60)

    all_urls = []
    for fname in TARGET_FILES:
        filepath = DATA_DIR / fname
        if not filepath.exists():
            if args.verbose:
                print(f"  ⊘ {fname} — not found, skipping")
            continue
        urls = extract_urls_from_json(filepath)
        print(f"  ✓ {fname}: {len(urls)} URLs found")
        all_urls.extend(urls)

    # Deduplicate by URL
    seen = set()
    unique_urls = []
    for entry in all_urls:
        if entry["url"] not in seen:
            seen.add(entry["url"])
            unique_urls.append(entry)

    print(f"\n  Total unique URLs: {len(unique_urls)}")

    # Phase 2: Validate URLs
    print("\n" + "━" * 60)
    print("Phase 2: Checking URL health...")
    print("━" * 60)

    broken = []
    ok_count = 0
    error_count = 0

    for i, entry in enumerate(unique_urls):
        url = entry["url"]
        if args.verbose:
            print(f"  [{i+1}/{len(unique_urls)}] {url[:70]}...")

        health = check_url_health(url)
        entry["health"] = health

        if health["status"] == "ok":
            ok_count += 1
        elif health["status"] == "broken":
            title = get_title_context(DATA_DIR / entry["file"], entry["json_path"])
            entry["title_context"] = title
            broken.append(entry)
            print(f"  ✗ BROKEN ({health.get('code', '?')}): {url[:70]}...")
            if title:
                print(f"    Context: \"{title}\"")
        elif health["status"] == "error":
            error_count += 1
            if args.verbose:
                print(f"  ⚠ ERROR: {url[:50]}... — {health.get('reason', '')[:50]}")

        time.sleep(REQUEST_DELAY)

    print(f"\n  OK: {ok_count} | Broken: {len(broken)} | Errors: {error_count}")

    # Phase 3: Search for replacements
    if broken and HAS_REQUESTS:
        print("\n" + "━" * 60)
        print("Phase 3: Searching for replacement URLs...")
        print("━" * 60)

        for entry in broken:
            title = entry.get("title_context", "")
            domain = entry["domain"]
            if not title:
                entry["suggested_replacement"] = None
                print(f"  ⊘ No title context for {entry['url'][:50]}... — skipping search")
                continue

            replacement = search_replacement(title, domain)
            entry["suggested_replacement"] = replacement

            if replacement:
                print(f"  ✓ Found: {replacement[:70]}")
            else:
                print(f"  ✗ No replacement found for: \"{title[:50]}\"")

            time.sleep(GOOGLE_DELAY)

    # Phase 4: Generate report
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_urls_scanned": len(unique_urls),
        "ok": ok_count,
        "broken_count": len(broken),
        "errors": error_count,
        "broken_urls": [
            {
                "url": e["url"],
                "file": e["file"],
                "status_code": e["health"].get("code"),
                "title_context": e.get("title_context", ""),
                "suggested_replacement": e.get("suggested_replacement"),
            }
            for e in broken
        ],
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n  Report saved to: {REPORT_PATH}")

    # Phase 5: Apply fixes if requested
    fixable = [e for e in broken if e.get("suggested_replacement")]
    if args.fix and fixable:
        print("\n" + "━" * 60)
        print(f"Phase 5: Applying {len(fixable)} fixes...")
        print("━" * 60)
        apply_fixes(fixable)
        print("  Done! Review changes with: git diff")
    elif fixable:
        print(f"\n  💡 {len(fixable)} fixable URLs found. Run with --fix to patch.")

    # Exit with non-zero if broken URLs found (for CI)
    sys.exit(1 if broken else 0)


if __name__ == "__main__":
    main()
