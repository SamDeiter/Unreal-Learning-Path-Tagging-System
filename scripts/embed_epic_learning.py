"""embed_epic_learning.py — Phase 3: RAG Vectorization

Reads extracted Markdown files + transcripts, chunks them with a
Markdown-aware splitter, embeds via Gemini text-embedding-004,
and outputs a single JSON file ready for semantic search.

Output: path-builder/src/data/epic_learning_embeddings.json

Usage:
  python scripts/embed_epic_learning.py               # Full run
  python scripts/embed_epic_learning.py --dry-run      # Preview chunks only
  python scripts/embed_epic_learning.py --resume       # Resume from checkpoint
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
EXTRACTED_DIR = Path("content/epic_learning/extracted")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
OUTPUT_FILE = Path("path-builder/src/data/epic_learning_embeddings.json")
CHECKPOINT_FILE = Path("content/epic_learning_embed_checkpoint.json")

MODEL = "gemini-embedding-001"
DIMENSION = 768
TASK_TYPE = "RETRIEVAL_DOCUMENT"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:embedContent"

# Chunking
TARGET_TOKENS = 500
MAX_TOKENS = 700
OVERLAP_CHARS = 200
APPROX_CHARS_PER_TOKEN = 4

# Rate limiting
BATCH_DELAY = 0.05
CHECKPOINT_INTERVAL = 50


def get_api_key():
    """Get Gemini API key from environment."""
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        print("ERROR: Set GOOGLE_API_KEY or GEMINI_API_KEY env var.")
        sys.exit(1)
    return key


def estimate_tokens(text):
    return len(text) // APPROX_CHARS_PER_TOKEN


# ── Markdown-Aware Chunker ──────────────────────────────────────────────
def chunk_markdown(text, meta):
    """Split Markdown text into semantically meaningful chunks.
    Breaks at heading and paragraph boundaries.
    """
    chunks = []
    # Split at heading boundaries (keep heading with its section)
    sections = re.split(r"(?=\n#{1,4}\s)", text)

    current_chunk = ""
    chunk_idx = 0

    for section in sections:
        section = section.strip()
        if not section:
            continue

        combined = (current_chunk + "\n\n" + section).strip() if current_chunk else section

        if estimate_tokens(combined) <= MAX_TOKENS:
            current_chunk = combined
        else:
            # Save current chunk if it has content
            if current_chunk and estimate_tokens(current_chunk) >= 30:
                chunks.append(_make_chunk(current_chunk, meta, chunk_idx))
                chunk_idx += 1

            # If single section is too long, split by paragraphs
            if estimate_tokens(section) > MAX_TOKENS:
                para_chunks = _split_long_section(section, meta, chunk_idx)
                chunks.extend(para_chunks)
                chunk_idx += len(para_chunks)
                current_chunk = ""
            else:
                current_chunk = section

    # Don't forget the last chunk
    if current_chunk and estimate_tokens(current_chunk) >= 30:
        chunks.append(_make_chunk(current_chunk, meta, chunk_idx))

    return chunks


def _split_long_section(text, meta, start_idx):
    """Split a long section by paragraphs."""
    chunks = []
    paragraphs = text.split("\n\n")
    current = ""
    idx = start_idx

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        combined = (current + "\n\n" + para).strip() if current else para
        if estimate_tokens(combined) <= MAX_TOKENS:
            current = combined
        else:
            if current and estimate_tokens(current) >= 30:
                chunks.append(_make_chunk(current, meta, idx))
                idx += 1
            current = para

    if current and estimate_tokens(current) >= 30:
        chunks.append(_make_chunk(current, meta, idx))

    return chunks


def _make_chunk(text, meta, idx):
    """Create a chunk dict with metadata."""
    return {
        "id": f"epic_{meta['hash_id']}_{idx:03d}",
        "hash_id": meta["hash_id"],
        "title": meta.get("title", ""),
        "url": meta.get("url", ""),
        "content_type": meta.get("content_type", ""),
        "author": meta.get("author", ""),
        "tags": meta.get("tags", []),
        "text": text,
        "token_estimate": estimate_tokens(text),
        "chunk_index": idx,
    }


# ── Load Content ────────────────────────────────────────────────────────
def load_all_content():
    """Load Markdown + transcripts, return list of chunk-ready documents."""
    docs = []
    md_files = sorted(EXTRACTED_DIR.glob("*.md"))

    for md_file in md_files:
        hash_id = md_file.stem
        meta_file = EXTRACTED_DIR / f"{hash_id}.meta.json"

        # Load markdown
        with open(md_file, "r", encoding="utf-8") as f:
            markdown = f.read()

        # Load metadata
        meta = {"hash_id": hash_id}
        if meta_file.exists():
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)

        # Load transcript if available
        transcript = ""
        for vid in meta.get("videos", []):
            if vid.get("type") == "youtube":
                yt_id = vid.get("id", "")
                txt_path = TRANSCRIPT_DIR / f"{yt_id}.txt"
                if txt_path.exists():
                    with open(txt_path, "r", encoding="utf-8") as f:
                        transcript += f"\n\n## Video Transcript\n\n{f.read()}"

        # Combine markdown + transcript
        full_text = markdown
        if transcript:
            full_text += transcript

        if len(full_text.strip()) < 50:
            continue  # Skip nearly empty docs

        docs.append({"text": full_text, "meta": meta})

    return docs


# ── Embedding ───────────────────────────────────────────────────────────
MAX_RETRIES = 3

def embed_text(text, api_key):
    """Call Gemini embedding API with retry. Returns 768-dim vector."""
    url = f"{API_URL}?key={api_key}"
    payload = {
        "content": {"parts": [{"text": text}]},
        "taskType": TASK_TYPE,
        "outputDimensionality": DIMENSION,
    }

    req_data = json.dumps(payload).encode("utf-8")

    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(
            url,
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode("utf-8"))
                values = result.get("embedding", {}).get("values", [])
                if len(values) != DIMENSION:
                    raise ValueError(f"Expected {DIMENSION} dims, got {len(values)}")
                return values
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")[:200]
            if attempt < MAX_RETRIES - 1:
                wait = 2 ** (attempt + 1)
                print(f"  Retry {attempt+1}/{MAX_RETRIES} after {wait}s (HTTP {e.code})")
                time.sleep(wait)
            else:
                print(f"  API error {e.code}: {body}")
                raise


def save_checkpoint(chunk_id, done):
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump({"last_chunk_id": chunk_id, "done": done,
                    "timestamp": datetime.now().isoformat()}, f)


def load_checkpoint():
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE) as f:
            return json.load(f)
    return None


# ── Main ────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Embed Epic Learning content for RAG")
    parser.add_argument("--dry-run", action="store_true", help="Preview chunks only")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    args = parser.parse_args()

    # Load all extracted content
    print("Loading extracted content...")
    docs = load_all_content()
    print(f"  Loaded {len(docs)} documents")

    if not docs:
        print("  No content found! Run extract_epic_learning.py first.")
        return

    # Chunk all documents
    print("\nChunking documents...")
    all_chunks = []
    for doc in docs:
        chunks = chunk_markdown(doc["text"], doc["meta"])
        all_chunks.extend(chunks)

    print(f"  Total chunks: {len(all_chunks)}")

    if not all_chunks:
        print("  No chunks generated!")
        return

    # Stats
    tokens = [c["token_estimate"] for c in all_chunks]
    print(f"  Token range: {min(tokens)}-{max(tokens)}")
    print(f"  Avg tokens/chunk: {sum(tokens) // len(tokens)}")

    # Content type distribution
    from collections import Counter
    type_counts = Counter(c["content_type"] for c in all_chunks)
    print(f"  Chunks by type: {dict(type_counts)}")

    if args.dry_run:
        print("\n[DRY RUN] Sample chunks:")
        for c in all_chunks[:3]:
            print(f"\n  ID: {c['id']}")
            print(f"  Title: {c['title'][:50]}")
            print(f"  Tokens: ~{c['token_estimate']}")
            print(f"  Text: {c['text'][:120]}...")
        return

    # Embed
    api_key = get_api_key()
    print(f"\n  API key loaded (len={len(api_key)})")

    # Resume support
    start_idx = 0
    existing = {}
    if args.resume:
        cp = load_checkpoint()
        if cp:
            start_idx = cp["done"]
            print(f"  Resuming from chunk {start_idx}")
            if OUTPUT_FILE.exists():
                with open(OUTPUT_FILE) as f:
                    existing = json.load(f).get("chunks", {})

    embeddings = dict(existing)
    total = len(all_chunks)
    errors = 0
    start_time = time.time()

    print(f"\nEmbedding {total - start_idx} chunks...\n")

    for i in range(start_idx, total):
        chunk = all_chunks[i]
        try:
            vector = embed_text(chunk["text"], api_key)
            embeddings[chunk["id"]] = {
                "embedding": vector,
                "hash_id": chunk["hash_id"],
                "title": chunk["title"],
                "url": chunk["url"],
                "content_type": chunk["content_type"],
                "author": chunk["author"],
                "tags": chunk["tags"],
                "text": chunk["text"][:400],
                "token_estimate": chunk["token_estimate"],
                "chunk_index": chunk["chunk_index"],
                "source": "epic_learning",
            }

            done = i + 1
            if done % 10 == 0 or done == total:
                elapsed = time.time() - start_time
                rate = (done - start_idx) / elapsed if elapsed > 0 else 0
                eta = (total - done) / rate if rate > 0 else 0
                print(f"  [{done}/{total}] {done * 100 // total}% "
                      f"({rate:.1f}/sec, ETA: {eta:.0f}s)")

            if done % CHECKPOINT_INTERVAL == 0:
                save_checkpoint(chunk["id"], done)

            time.sleep(BATCH_DELAY)

        except Exception as e:
            errors += 1
            print(f"  ERROR on {chunk['id']}: {e}")
            if errors > 10:
                print("  Too many errors, stopping.")
                break
            time.sleep(2)

    # Save output
    output = {
        "model": MODEL,
        "dimension": DIMENSION,
        "task_type": TASK_TYPE,
        "generated_at": datetime.now().isoformat(),
        "total_chunks": len(embeddings),
        "source": "epic_learning_extracted",
        "chunks": embeddings,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start_time

    print(f"\n{'=' * 50}")
    print(f"Done! {len(embeddings)} chunks embedded in {elapsed:.0f}s")
    print(f"Output: {OUTPUT_FILE} ({mb:.1f} MB)")
    print(f"Errors: {errors}")

    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()


if __name__ == "__main__":
    main()
