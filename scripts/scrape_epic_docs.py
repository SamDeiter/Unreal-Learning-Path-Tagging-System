"""scrape_epic_docs.py — Phase 1B of RAG upgrade
Scrapes Epic Games UE5 documentation using curated URL slugs from
UE5QuestionGenerator/src/utils/urlValidatorData.js.

Converts HTML → plain text, chunks into ~500-token blocks, then
embeds via Vertex AI gemini-embedding-001 (:predict endpoint).

Auth: Vertex AI / ADC only. The legacy AI-Studio
`generativelanguage.googleapis.com/.../embedContent` + GEMINI_API_KEY path
was retired alongside the rest of the codebase (see commit c8d3ceb0,
2026-04-28). Locally this requires:
    gcloud auth application-default login
Project + region overridable via VERTEX_PROJECT_ID / VERTEX_LOCATION envs;
defaults to development-317819 / us-central1.

Output: path-builder/src/data/docs_embeddings.json

Usage:
    python scripts/scrape_epic_docs.py --scrape-only    # Scrape docs, no embedding
    python scripts/scrape_epic_docs.py                   # Scrape + embed
    python scripts/scrape_epic_docs.py --resume          # Resume embedding
    python scripts/scrape_epic_docs.py --auth-test       # Verify Vertex ADC auth
"""

import argparse
import hashlib
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.robotparser import RobotFileParser

# Load .env file for env overrides (VERTEX_PROJECT_ID, VERTEX_LOCATION, etc).
# No API keys are read anymore — auth is ADC.
try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass  # dotenv not installed

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SLUG_SOURCE = Path(r"c:\Users\Sam Deiter\Documents\GitHub\UE5QuestionGenerator\src\utils\urlValidatorData.js")
SCRAPED_DOCS = Path("content/scraped_docs.json")
OUTPUT_FILE = Path("path-builder/src/data/docs_embeddings.json")
CHECKPOINT_FILE = Path("content/docs_embedding_checkpoint.json")

BASE_URL = "https://dev.epicgames.com/documentation/en-us/unreal-engine"

MODEL = "gemini-embedding-001"
DIMENSION = 768
TASK_TYPE = "RETRIEVAL_DOCUMENT"

# Vertex AI / ADC. `:embedContent` on generativelanguage.googleapis.com no
# longer supports gemini-embedding-001 — embeddings go through Vertex's
# `:predict` endpoint with a different request/response shape (see
# functions/utils/vertex.js and eval/rag_eval.js for the JS equivalents).
PROJECT_ID = os.environ.get("VERTEX_PROJECT_ID", "development-317819")
LOCATION = os.environ.get("VERTEX_LOCATION", "us-central1")
API_URL = (
    f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}"
    f"/locations/{LOCATION}/publishers/google/models/{MODEL}:predict"
)

TARGET_TOKENS = 500
MAX_TOKENS = 700
APPROX_CHARS_PER_TOKEN = 4
BATCH_DELAY = 0.05
CHECKPOINT_INTERVAL = 25
SCRAPE_DELAY = 0.5          # 500ms between page fetches (default; --polite overrides)

# ---------------------------------------------------------------------------
# Polite-mode pacing (engaged via --polite).
# Goal: look like a researcher reading the docs in a browser, not a bot
# requesting on a metronome. Throughput drops but we stay off WAF heuristics
# that flag uniform request cadence + bot-shaped User-Agent strings.
# ---------------------------------------------------------------------------
POLITE_DELAY_MIN = 1.5
POLITE_DELAY_MAX = 4.0
# After this many pages the fetcher pauses for IDLE_GAP seconds — simulates a
# human getting distracted between bursts of reading.
POLITE_BURST_MIN = 8
POLITE_BURST_MAX = 15
POLITE_IDLE_MIN = 30.0
POLITE_IDLE_MAX = 90.0
# Backoff for transient 429/503 (and network errors). Exponential: 30s, 60s,
# 120s capped. After 3 attempts we surface the failure.
POLITE_BACKOFF_BASE = 30.0
POLITE_BACKOFF_MAX = 120.0
POLITE_BACKOFF_RETRIES = 3

# Realistic Chrome 134 desktop User-Agent. Pair with Sec-Fetch-* + Accept-*
# so the request shape matches what a real browser sends. The point is honesty
# about being a researcher, not impersonation — the previous UA literally said
# "UE5 Learning Path Builder" which trips lazy WAF rules even on legitimate
# traffic.
POLITE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/134.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "DNT": "1",
}


# ---------------------------------------------------------------------------
# Vertex ADC auth
# ---------------------------------------------------------------------------
# Locally requires `gcloud auth application-default login`. In Cloud
# environments the runtime service account supplies credentials.
_credentials = None


def get_access_token():
    """Return a fresh ADC bearer token for cloud-platform scope."""
    global _credentials
    # Imported lazily so `--auth-test` failures surface a useful error
    # instead of an ImportError at module load time.
    from google.auth import default as google_auth_default
    from google.auth.transport.requests import Request as AuthRequest

    if _credentials is None:
        _credentials, _ = google_auth_default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    if not _credentials.valid:
        _credentials.refresh(AuthRequest())
    return _credentials.token


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


class PoliteFetcher:
    """HTTP fetcher that paces and shapes requests like a researcher reading
    docs in a browser. Used when the user passes --polite. The fast path uses
    the same interface but with the legacy fixed-delay behavior so existing
    tests/scripts don't change.

    What it does (polite=True):
      - Persistent cookie jar so the site sees one session, not 569 strangers
      - Browser-shaped headers (Chrome UA, Sec-Fetch-*, Accept-Language, gzip)
      - Random delay POLITE_DELAY_MIN..MAX between requests
      - Bursty pacing: every 8-15 pages, idle 30-90s
      - 429/503 → exponential backoff (30s, 60s, 120s) up to 3 retries
      - robots.txt check up front (disabled fetches just log + skip)
    """

    def __init__(self, polite=False):
        self.polite = polite
        self.pages_in_burst = 0
        self.burst_target = self._next_burst_target()
        # Cookie jar so sessions persist across pages (real browsers do this).
        cookie_jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(cookie_jar),
            urllib.request.HTTPRedirectHandler(),
        )
        # robots.txt disposition — None until fetched. False = blocked, True = allowed.
        self.robots_allowed = None
        if polite:
            self._fetch_robots()

    def _next_burst_target(self):
        return random.randint(POLITE_BURST_MIN, POLITE_BURST_MAX)

    def _fetch_robots(self):
        robots_url = "https://dev.epicgames.com/robots.txt"
        try:
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            self.robots = rp
            print(f"  [polite] robots.txt loaded from {robots_url}")
        except Exception as e:
            print(f"  [polite] robots.txt fetch failed ({e}); proceeding cautiously")
            self.robots = None

    def _allowed(self, url):
        if not self.polite or self.robots is None:
            return True
        return self.robots.can_fetch(POLITE_HEADERS["User-Agent"], url)

    def _pause_between(self):
        """Idle between requests. Polite: jittered 1.5-4s, bursty pause every
        8-15 pages. Non-polite: fixed 0.5s (legacy behavior)."""
        if not self.polite:
            time.sleep(SCRAPE_DELAY)
            return

        self.pages_in_burst += 1
        if self.pages_in_burst >= self.burst_target:
            idle = random.uniform(POLITE_IDLE_MIN, POLITE_IDLE_MAX)
            print(f"  [polite] burst of {self.pages_in_burst} pages done — idling {idle:.0f}s")
            time.sleep(idle)
            self.pages_in_burst = 0
            self.burst_target = self._next_burst_target()
        else:
            time.sleep(random.uniform(POLITE_DELAY_MIN, POLITE_DELAY_MAX))

    def fetch(self, url, timeout=10):
        """Return decoded HTML for url, or raise. Pauses AFTER returning so
        the caller can short-circuit on 404 without burning idle time."""
        if not self._allowed(url):
            raise PermissionError(f"robots.txt disallows fetch of {url}")

        headers = POLITE_HEADERS if self.polite else {
            "User-Agent": "Mozilla/5.0 (UE5 Learning Path Builder)",
            "Accept": "text/html",
        }

        attempts = POLITE_BACKOFF_RETRIES if self.polite else 1
        last_err = None
        for attempt in range(attempts):
            try:
                req = urllib.request.Request(url, headers=headers)
                with self.opener.open(req, timeout=timeout) as response:
                    raw = response.read()
                    # gzip/deflate handled by content-encoding; urllib doesn't
                    # decompress automatically, so check + decode.
                    encoding = response.headers.get("Content-Encoding", "")
                    if "gzip" in encoding:
                        import gzip
                        raw = gzip.decompress(raw)
                    elif "deflate" in encoding:
                        import zlib
                        raw = zlib.decompress(raw)
                    return raw.decode("utf-8", errors="replace")
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code in (429, 503) and attempt + 1 < attempts:
                    backoff = min(POLITE_BACKOFF_BASE * (2 ** attempt), POLITE_BACKOFF_MAX)
                    print(f"  [polite] HTTP {e.code} — backing off {backoff:.0f}s (attempt {attempt + 1}/{attempts})")
                    time.sleep(backoff)
                    continue
                raise
            except (urllib.error.URLError, TimeoutError) as e:
                last_err = e
                if attempt + 1 < attempts:
                    backoff = min(POLITE_BACKOFF_BASE * (2 ** attempt), POLITE_BACKOFF_MAX)
                    print(f"  [polite] network error ({e}) — retrying in {backoff:.0f}s")
                    time.sleep(backoff)
                    continue
                raise
        raise last_err

    def settle(self):
        """Pause after a successful fetch. Separated from fetch() so callers
        can decide not to wait (e.g. on a 404 we skip the idle)."""
        self._pause_between()


def crawl_discover_slugs(max_pages=2000, fetcher=None):
    """Discover doc page slugs by crawling from the docs index.
    Uses BFS to follow links within /documentation/en-us/unreal-engine/.
    Returns list of discovered slugs.
    """
    from collections import deque

    if fetcher is None:
        fetcher = PoliteFetcher(polite=False)

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
            html = fetcher.fetch(url)

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

            fetcher.settle()

        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"  HTTP {e.code}: {url}")
        except Exception as e:
            print(f"  Error: {url} — {e}")

    print(f"  Crawl complete: {len(discovered_slugs)} pages discovered "
          f"({len(visited)} visited)")
    return discovered_slugs


def scrape_docs(slugs, fetcher=None):
    """Fetch and parse doc pages. Returns list of {slug, title, chunks}."""
    if fetcher is None:
        fetcher = PoliteFetcher(polite=False)

    docs = []
    success = 0
    failed = 0

    print(f"\nScraping {len(slugs)} doc pages...")

    for i, slug in enumerate(slugs):
        url = f"{BASE_URL}/{slug}"
        try:
            html = fetcher.fetch(url)

            text = html_to_text(html)

            if estimate_tokens(text) < 50:
                print(f"  [{i+1}/{len(slugs)}] SKIP (too short): {slug}")
                fetcher.settle()
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

            fetcher.settle()

        except urllib.error.HTTPError as e:
            failed += 1
            if e.code == 404:
                pass  # Common — some slugs may be outdated; skip the idle delay
            else:
                print(f"  [{i+1}/{len(slugs)}] HTTP {e.code}: {slug}")
        except Exception as e:
            failed += 1
            print(f"  [{i+1}/{len(slugs)}] ERROR: {slug} — {e}")

    print(f"\nScrape complete: {success} docs, {failed} failed, "
          f"{sum(d['chunk_count'] for d in docs)} total chunks")

    return docs


def embed_text(text, _unused=None):
    """Call Vertex AI :predict embedding endpoint via ADC.

    The second positional arg is kept for backwards compatibility with the
    old `embed_text(text, api_key)` signature — callers that still pass a
    second value won't break, but the value is ignored. Auth comes from
    `get_access_token()` (ADC).
    """
    import urllib.request

    token = get_access_token()
    payload = {
        "instances": [{"task_type": TASK_TYPE, "content": text}],
        "parameters": {"outputDimensionality": DIMENSION},
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        predictions = result.get("predictions") or []
        if not predictions:
            raise ValueError(f"Empty predictions in Vertex response: {result}")
        values = (
            predictions[0].get("embeddings", {}).get("values", [])
        )
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
    parser.add_argument(
        "--polite",
        action="store_true",
        help=(
            "Pace requests like a human researcher: jittered 1.5-4s delays, "
            "browser-shaped headers, bursty pauses every 8-15 pages, "
            "robots.txt + 429/503 backoff. Slower (~2x) but stays off WAF heuristics."
        ),
    )
    args = parser.parse_args()

    fetcher = PoliteFetcher(polite=args.polite)
    if args.polite:
        print("Mode: POLITE (jittered delays, browser headers, bursty pacing)")

    # Step 1: Get slugs
    if args.crawl:
        print("Mode: CRAWL (discovering pages from site)")
        slugs = crawl_discover_slugs(args.max_pages, fetcher=fetcher)
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
        docs = scrape_docs(slugs, fetcher=fetcher)

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
    # ADC auth — fetch a token up front to fail fast on misconfigured creds.
    _ = get_access_token()
    print(f"  Auth: Vertex ADC (project={PROJECT_ID}, location={LOCATION})")

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
            vector = embed_text(chunk["text"])
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
    # Lightweight auth smoke test — does not run the full pipeline. Useful
    # for verifying ADC + Vertex `:predict` works end-to-end from Python
    # without committing to a multi-hour scrape/embed run.
    if "--auth-test" in sys.argv:
        print(f"Auth test against {API_URL}")
        vec = embed_text("test")
        print(f"OK — {len(vec)} dims; first 3: {vec[:3]}")
        sys.exit(0)
    main()
