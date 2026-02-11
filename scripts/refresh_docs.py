"""refresh_docs.py — Pipeline Refresh for doc_links.json
────────────────────────────────────────────────────────
Updates readTimeMinutes in doc_links.json using:
  1. Cached scraped doc content (content/scraped_docs.json), or
  2. Live re-scrape of Epic docs pages.

Also detects stale embeddings by comparing source hashes.

Usage:
  python scripts/refresh_docs.py                  # update read times from cached content
  python scripts/refresh_docs.py --scrape          # re-scrape first, then update
  python scripts/refresh_docs.py --dry-run         # preview changes without writing
  python scripts/refresh_docs.py --check-stale     # report stale embedding chunks
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

# Paths relative to repo root
REPO_ROOT = Path(__file__).resolve().parent.parent
DOC_LINKS = REPO_ROOT / "path-builder" / "src" / "data" / "doc_links.json"
SCRAPED_DOCS = REPO_ROOT / "content" / "scraped_docs.json"
EMBEDDINGS = REPO_ROOT / "content" / "doc_embeddings.json"

# Reading speed: 200 words per minute (average non-fiction)
WPM = 200
MIN_READ_MINUTES = 3
MAX_READ_MINUTES = 45


def estimate_read_time(word_count):
    """Estimate reading time in minutes from word count, clamped to [3, 45]."""
    minutes = max(MIN_READ_MINUTES, min(MAX_READ_MINUTES, round(word_count / WPM)))
    return minutes


def load_scraped_docs():
    """Load cached scraped docs. Returns list of doc dicts."""
    if not SCRAPED_DOCS.exists():
        print(f"ERROR: {SCRAPED_DOCS} not found.")
        print("Run: python scripts/scrape_epic_docs.py --scrape-only")
        sys.exit(1)

    with open(SCRAPED_DOCS, encoding="utf-8") as f:
        docs = json.load(f)
    print(f"Loaded {len(docs)} scraped docs from {SCRAPED_DOCS}")
    return docs


def compute_word_counts(docs):
    """Compute word count per doc by summing chunk texts."""
    word_counts = {}
    for doc in docs:
        total_words = 0
        for chunk in doc.get("chunks", []):
            text = chunk.get("text", "")
            total_words += len(text.split())
        word_counts[doc["slug"]] = total_words
    return word_counts


def slug_from_url(url):
    """Extract slug from an Epic docs URL."""
    base = "https://dev.epicgames.com/documentation/en-us/unreal-engine/"
    if url.startswith(base):
        return url[len(base):].rstrip("/")
    return None


def update_doc_links(word_counts, dry_run=False):
    """Update readTimeMinutes in doc_links.json based on word counts."""
    with open(DOC_LINKS, encoding="utf-8") as f:
        links = json.load(f)

    updates = 0
    unchanged = 0
    no_match = 0

    for key, entry in links.items():
        url = entry.get("url", "")
        slug = slug_from_url(url)

        if slug and slug in word_counts:
            wc = word_counts[slug]
            new_time = estimate_read_time(wc)
            old_time = entry.get("readTimeMinutes", 10)

            if new_time != old_time:
                if dry_run:
                    print(f"  [DRY] {key}: {old_time}m → {new_time}m ({wc} words)")
                entry["readTimeMinutes"] = new_time
                updates += 1
            else:
                unchanged += 1
        else:
            no_match += 1

    if not dry_run:
        with open(DOC_LINKS, "w", encoding="utf-8") as f:
            json.dump(links, f, indent=2)
        print(f"\nUpdated {DOC_LINKS}")

    print(f"\nResults: {updates} updated, {unchanged} unchanged, {no_match} unmatched")
    return updates


def check_stale_embeddings():
    """Check if embeddings are stale by comparing source hashes."""
    if not EMBEDDINGS.exists():
        print("No embeddings file found. Run scrape_epic_docs.py to generate.")
        return

    if not SCRAPED_DOCS.exists():
        print("No scraped docs found. Cannot compare hashes.")
        return

    with open(EMBEDDINGS, encoding="utf-8") as f:
        emb = json.load(f)

    stored_hash = emb.get("source_hash", "unknown")
    current_hash = hashlib.sha256(
        open(SCRAPED_DOCS, "rb").read()
    ).hexdigest()

    if stored_hash == current_hash:
        print("✅ Embeddings are fresh (hashes match)")
    else:
        print("⚠️  Embeddings are STALE")
        print(f"  Stored:  {stored_hash[:16]}...")
        print(f"  Current: {current_hash[:16]}...")
        print("  Run: python scripts/scrape_epic_docs.py --embed-only")

    total_chunks = emb.get("total_chunks", 0)
    generated_at = emb.get("generated_at", "unknown")
    print(f"  Chunks: {total_chunks}, Generated: {generated_at}")


def main():
    parser = argparse.ArgumentParser(description="Refresh doc_links.json read times")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without writing")
    parser.add_argument("--scrape", action="store_true",
                        help="Re-scrape docs before updating")
    parser.add_argument("--check-stale", action="store_true",
                        help="Check if embeddings are stale")
    args = parser.parse_args()

    if args.check_stale:
        check_stale_embeddings()
        return

    if args.scrape:
        print("Re-scraping docs first...")
        # Import and run scrape from existing script
        sys.path.insert(0, str(Path(__file__).parent))
        from scrape_epic_docs import extract_slugs, scrape_docs
        slugs = extract_slugs()
        docs = scrape_docs(slugs)

        # Cache
        SCRAPED_DOCS.parent.mkdir(parents=True, exist_ok=True)
        with open(SCRAPED_DOCS, "w", encoding="utf-8") as f:
            json.dump(docs, f, indent=2)
        print(f"Cached {len(docs)} docs")
    else:
        docs = load_scraped_docs()

    word_counts = compute_word_counts(docs)
    print(f"Computed word counts for {len(word_counts)} docs")

    # Stats
    wc_values = list(word_counts.values())
    if wc_values:
        avg_wc = sum(wc_values) // len(wc_values)
        min_wc = min(wc_values)
        max_wc = max(wc_values)
        print(f"  Word count range: {min_wc} – {max_wc} (avg {avg_wc})")
        print(f"  Read time range: {estimate_read_time(min_wc)} – {estimate_read_time(max_wc)} min")

    updates = update_doc_links(word_counts, dry_run=args.dry_run)
    prefix = "[DRY RUN] " if args.dry_run else ""
    print(f"\n{prefix}Done. {updates} entries {'would be ' if args.dry_run else ''}updated.")


if __name__ == "__main__":
    main()
