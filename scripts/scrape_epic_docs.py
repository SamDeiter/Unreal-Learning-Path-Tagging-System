"""scrape_epic_docs.py — Phase 1B of RAG upgrade
Scrapes Epic Games UE5 documentation using curated URL slugs from
UE5QuestionGenerator/src/utils/urlValidatorData.js.

Converts HTML → plain text, chunks into ~500-token blocks, then
embeds via Gemini text-embedding-004.

Output: path-builder/src/data/docs_embeddings.json

Usage:
    python scripts/scrape_epic_docs.py --scrape-only    # Scrape docs, no embedding
    python scripts/scrape_epic_docs.py                   # Scrape + embed
    python scripts/scrape_epic_docs.py --resume          # Resume embedding
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SLUG_SOURCE = Path(r"c:\Users\Sam Deiter\Documents\GitHub\UE5QuestionGenerator\src\utils\urlValidatorData.js")
SCRAPED_DOCS = Path("content/scraped_docs.json")
OUTPUT_FILE = Path("path-builder/src/data/docs_embeddings.json")
CHECKPOINT_FILE = Path("content/docs_embedding_checkpoint.json")

BASE_URL = "https://dev.epicgames.com/documentation/en-us/unreal-engine"

MODEL = "text-embedding-004"
DIMENSION = 768
TASK_TYPE = "RETRIEVAL_DOCUMENT"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:embedContent"

TARGET_TOKENS = 500
MAX_TOKENS = 700
APPROX_CHARS_PER_TOKEN = 4
BATCH_DELAY = 0.05
CHECKPOINT_INTERVAL = 25
SCRAPE_DELAY = 0.5          # 500ms between page fetches (be polite)


def get_api_key():
    """Get Gemini API key from environment."""
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        print("ERROR: No API key found. Set GOOGLE_API_KEY or GEMINI_API_KEY env var.")
        sys.exit(1)
    return key


def extract_slugs():
    """Extract URL slugs from urlValidatorData.js."""
    content = SLUG_SOURCE.read_text(encoding="utf-8")

    # Find the KNOWN_VALID_SLUGS Set
    slugs = []
    in_set = False
    for line in content.split("\n"):
        stripped = line.strip()
        if "KNOWN_VALID_SLUGS" in line:
            in_set = True
            continue
        if in_set and stripped.startswith("])"):
            break
        if in_set and stripped.startswith('"'):
            # Extract slug between quotes
            match = re.search(r'"([^"]+)"', stripped)
            if match:
                slug = match.group(1)
                if slug not in slugs:  # deduplicate
                    slugs.append(slug)

    return slugs


class HTMLTextExtractor(HTMLParser):
    """Simple HTML → text converter, stripping tags but keeping structure."""

    def __init__(self):
        super().__init__()
        self.result = []
        self.skip_tags = {"script", "style", "nav", "footer", "header", "aside"}
        self.skip_depth = 0
        self.in_heading = False
        self.heading_level = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.skip_depth += 1
        if tag in ("h1", "h2", "h3", "h4"):
            self.in_heading = True
            self.heading_level = int(tag[1])
            self.result.append("\n\n")
        if tag in ("p", "div", "li", "br"):
            self.result.append("\n")

    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.skip_depth = max(0, self.skip_depth - 1)
        if tag in ("h1", "h2", "h3", "h4"):
            self.in_heading = False
            self.result.append("\n")

    def handle_data(self, data):
        if self.skip_depth == 0:
            text = data.strip()
            if text:
                if self.in_heading:
                    prefix = "#" * self.heading_level + " "
                    self.result.append(prefix + text)
                else:
                    self.result.append(text)

    def get_text(self):
        return " ".join(self.result)


def html_to_text(html_content):
    """Convert HTML to clean text."""
    extractor = HTMLTextExtractor()
    extractor.feed(html_content)
    text = extractor.get_text()

    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"  +", " ", text)
    return text.strip()


def estimate_tokens(text):
    return len(text) // APPROX_CHARS_PER_TOKEN


def chunk_doc(text, slug, max_tokens=MAX_TOKENS, target_tokens=TARGET_TOKENS):
    """Split a document into chunks of ~target_tokens."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    current_section = slug  # Default section title

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Track section headings
        if para.startswith("#"):
            heading_match = re.match(r"#+\s*(.*)", para)
            if heading_match:
                current_section = heading_match.group(1).strip()

        candidate = (current_chunk + "\n\n" + para).strip() if current_chunk else para

        if estimate_tokens(candidate) > max_tokens and current_chunk:
            # Save current chunk
            if estimate_tokens(current_chunk) >= 40:  # skip tiny fragments
                chunks.append({
                    "text": current_chunk,
                    "section": current_section,
                    "token_estimate": estimate_tokens(current_chunk),
                })
            current_chunk = para
        else:
            current_chunk = candidate

    # Don't forget the last chunk
    if current_chunk and estimate_tokens(current_chunk) >= 40:
        chunks.append({
            "text": current_chunk,
            "section": current_section,
            "token_estimate": estimate_tokens(current_chunk),
        })

    return chunks


def crawl_discover_slugs(max_pages=2000):
    """Discover doc page slugs by crawling from the docs index.
    Uses BFS to follow links within /documentation/en-us/unreal-engine/.
    Returns list of discovered slugs.
    """
    import urllib.error
    import urllib.request
    from collections import deque

    docs_prefix = "/documentation/en-us/unreal-engine/"
    # Skip API reference pages (huge, low RAG value)
    skip_patterns = ["/API/", "/BlueprintAPI/", "/PythonAPI/", "/WebAPI/", "/node-reference"]

    visited = set()
    to_visit = deque([""])  # Start from root
    discovered_slugs = []

    print(f"\nCrawling Epic docs to discover pages (max {max_pages})...")

    while to_visit and len(discovered_slugs) < max_pages:
        slug = to_visit.popleft()
        if slug in visited:
            continue
        visited.add(slug)

        url = f"{BASE_URL}/{slug}" if slug else BASE_URL
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (UE5 Learning Path Builder)",
                "Accept": "text/html",
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode("utf-8", errors="replace")

            # Extract internal links
            link_pattern = re.compile(
                r'href="' + re.escape(docs_prefix) + r'([^"#?]+)"'
            )
            for match in link_pattern.finditer(html):
                found_slug = match.group(1).rstrip("/")
                if found_slug and found_slug not in visited:
                    # Skip API ref pages
                    if any(skip in found_slug for skip in skip_patterns):
                        continue
                    to_visit.append(found_slug)

            # Record this page as a valid doc slug (skip the root)
            if slug and slug not in discovered_slugs:
                discovered_slugs.append(slug)

            if len(discovered_slugs) % 50 == 0 and discovered_slugs:
                print(f"  Discovered {len(discovered_slugs)} pages, queue: {len(to_visit)}")

            time.sleep(SCRAPE_DELAY)

        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"  HTTP {e.code}: {url}")
        except Exception as e:
            print(f"  Error: {url} — {e}")

    print(f"  Crawl complete: {len(discovered_slugs)} pages discovered "
          f"({len(visited)} visited)")
    return discovered_slugs


def scrape_docs(slugs):
    """Fetch and parse doc pages. Returns list of {slug, title, chunks}."""
    import urllib.error
    import urllib.request

    docs = []
    success = 0
    failed = 0

    print(f"\nScraping {len(slugs)} doc pages...")

    for i, slug in enumerate(slugs):
        url = f"{BASE_URL}/{slug}"
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (UE5 Learning Path Builder)",
                "Accept": "text/html",
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode("utf-8", errors="replace")

            text = html_to_text(html)

            if estimate_tokens(text) < 50:
                print(f"  [{i+1}/{len(slugs)}] SKIP (too short): {slug}")
                continue

            # Extract title from slug
            title = slug.replace("-in-unreal-engine", "").replace("-", " ").title()

            chunks = chunk_doc(text, slug)

            docs.append({
                "slug": slug,
                "url": url,
                "title": title,
                "text_length": len(text),
                "chunk_count": len(chunks),
                "chunks": chunks,
            })

            success += 1
            if (i + 1) % 20 == 0:
                print(f"  [{i+1}/{len(slugs)}] scraped {success}, failed {failed}")

            time.sleep(SCRAPE_DELAY)

        except urllib.error.HTTPError as e:
            failed += 1
            if e.code == 404:
                pass  # Common — some slugs may be outdated
            else:
                print(f"  [{i+1}/{len(slugs)}] HTTP {e.code}: {slug}")
        except Exception as e:
            failed += 1
            print(f"  [{i+1}/{len(slugs)}] ERROR: {slug} — {e}")

    print(f"\nScrape complete: {success} docs, {failed} failed, "
          f"{sum(d['chunk_count'] for d in docs)} total chunks")

    return docs


def embed_text(text, api_key):
    """Call Gemini embedding API."""
    import urllib.error
    import urllib.request

    url = f"{API_URL}?key={api_key}"
    payload = {
        "model": f"models/{MODEL}",
        "content": {"parts": [{"text": text}]},
        "taskType": TASK_TYPE,
        "outputDimensionality": DIMENSION,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        values = result.get("embedding", {}).get("values", [])
        if len(values) != DIMENSION:
            raise ValueError(f"Expected {DIMENSION} dims, got {len(values)}")
        return values


def save_checkpoint(chunk_idx, embeddings_done):
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump({
            "chunk_idx": chunk_idx,
            "embeddings_done": embeddings_done,
            "timestamp": datetime.now().isoformat(),
        }, f)


def main():
    parser = argparse.ArgumentParser(description="Scrape and embed Epic UE5 docs")
    parser.add_argument("--scrape-only", action="store_true", help="Scrape docs without embedding")
    parser.add_argument("--resume", action="store_true", help="Resume embedding from checkpoint")
    parser.add_argument("--embed-only", action="store_true", help="Embed already-scraped docs")
    parser.add_argument("--crawl", action="store_true", help="Crawl site to discover pages (vs curated slugs)")
    parser.add_argument("--max-pages", type=int, default=2000, help="Max pages to crawl (default 2000)")
    args = parser.parse_args()

    # Step 1: Get slugs
    if args.crawl:
        print("Mode: CRAWL (discovering pages from site)")
        slugs = crawl_discover_slugs(args.max_pages)
        print(f"  Discovered {len(slugs)} unique doc slugs via crawl")
    else:
        print(f"Reading slugs from {SLUG_SOURCE}...")
        slugs = extract_slugs()
        print(f"  Found {len(slugs)} unique doc slugs (curated list)")

    # Step 2: Scrape (or load cached)
    if args.embed_only and SCRAPED_DOCS.exists():
        print(f"\nLoading cached scraped docs from {SCRAPED_DOCS}...")
        with open(SCRAPED_DOCS) as f:
            docs = json.load(f)
        print(f"  Loaded {len(docs)} docs")
    else:
        docs = scrape_docs(slugs)

        # Cache scraped docs
        SCRAPED_DOCS.parent.mkdir(parents=True, exist_ok=True)
        with open(SCRAPED_DOCS, "w", encoding="utf-8") as f:
            json.dump(docs, f, indent=2)
        print(f"  Cached to {SCRAPED_DOCS}")

    if args.scrape_only:
        print("\n[SCRAPE ONLY] No embeddings generated.")
        return

    # Step 3: Flatten chunks for embedding
    all_chunks = []
    for doc in docs:
        for _j, chunk in enumerate(doc["chunks"]):
            all_chunks.append({
                "id": f"doc_{len(all_chunks):04d}",
                "slug": doc["slug"],
                "url": doc["url"],
                "title": doc["title"],
                "section": chunk["section"],
                "text": chunk["text"],
                "token_estimate": chunk["token_estimate"],
            })

    print(f"\n  Total doc chunks to embed: {len(all_chunks)}")

    # Step 4: Embed (with smart re-indexing via content hashing)
    api_key = get_api_key()
    print(f"  API key: {api_key[:8]}...{api_key[-4:]}")

    start_idx = 0
    existing = {}
    existing_hashes = {}  # id -> content_hash from previous run
    if OUTPUT_FILE.exists():
        prev_output = json.load(open(OUTPUT_FILE))
        existing = prev_output.get("docs", {})
        # Build hash lookup from previous embeddings
        for doc_id, doc_data in existing.items():
            if "content_hash" in doc_data:
                existing_hashes[doc_id] = doc_data["content_hash"]

    if args.resume and CHECKPOINT_FILE.exists():
        cp = json.load(open(CHECKPOINT_FILE))
        start_idx = cp["embeddings_done"]
        print(f"  Resuming from {start_idx}")

    embeddings = dict(existing)
    total = len(all_chunks)
    errors = 0
    skipped = 0
    start_time = time.time()

    print(f"\nEmbedding {total - start_idx} doc chunks...\n")

    for i in range(start_idx, total):
        chunk = all_chunks[i]
        # Smart re-indexing: hash the chunk text
        content_hash = hashlib.sha256(chunk["text"].encode("utf-8")).hexdigest()[:16]
        if chunk["id"] in existing_hashes and existing_hashes[chunk["id"]] == content_hash:
            skipped += 1
            continue
        try:
            vector = embed_text(chunk["text"], api_key)
            embeddings[chunk["id"]] = {
                "embedding": vector,
                "slug": chunk["slug"],
                "url": chunk["url"],
                "title": chunk["title"],
                "section": chunk["section"],
                "text": chunk["text"][:300],
                "token_estimate": chunk["token_estimate"],
                "content_hash": content_hash,
            }

            done = i + 1
            if done % 10 == 0 or done == total:
                elapsed = time.time() - start_time
                rate = (done - start_idx) / elapsed if elapsed > 0 else 0
                eta = (total - done) / rate if rate > 0 else 0
                print(f"  [{done}/{total}] {done * 100 // total}% "
                      f"({rate:.1f}/sec, ETA: {eta:.0f}s)")

            if done % CHECKPOINT_INTERVAL == 0:
                save_checkpoint(i, done)

            time.sleep(BATCH_DELAY)

        except Exception as e:
            errors += 1
            print(f"  ERROR on {chunk['id']}: {e}")
            if errors > 20:
                print("  Too many errors, stopping.")
                break
            time.sleep(2)

    # Compute source hash for freshness tracking
    source_hash = "unknown"
    if SCRAPED_DOCS.exists():
        source_hash = hashlib.sha256(
            open(SCRAPED_DOCS, "rb").read()
        ).hexdigest()

    # Save output
    output = {
        "model": MODEL,
        "dimension": DIMENSION,
        "task_type": TASK_TYPE,
        "generated_at": datetime.now().isoformat(),
        "total_chunks": len(embeddings),
        "source": "dev.epicgames.com",
        "source_hash": source_hash,
        "docs": embeddings,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start_time

    print(f"\n{'='*50}")
    print(f"Done! Embedded {len(embeddings)} doc chunks in {elapsed:.0f}s")
    print(f"  Skipped (unchanged): {skipped}")
    print(f"  Re-embedded: {len(embeddings) - skipped}")
    print(f"Output: {OUTPUT_FILE} ({file_size_mb:.1f} MB)")
    print(f"Errors: {errors}")

    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()


if __name__ == "__main__":
    main()
