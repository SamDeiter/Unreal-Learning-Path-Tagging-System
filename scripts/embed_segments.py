"""embed_segments.py — Phase 1A of RAG upgrade
Reads segment_index.json, merges adjacent segments into ~300-500 token chunks,
then embeds each chunk via Gemini text-embedding-004.

Output: path-builder/src/data/segment_embeddings.json

Usage:
    python scripts/embed_segments.py                    # Full run
    python scripts/embed_segments.py --dry-run          # Preview chunks only
    python scripts/embed_segments.py --resume            # Resume from last checkpoint
"""

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Load .env file so scripts pick up project-level keys
try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass  # dotenv not installed — rely on system env

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SEGMENT_INDEX = Path("path-builder/src/data/segment_index.json")
OUTPUT_FILE = Path("path-builder/src/data/segment_embeddings.json")
CHECKPOINT_FILE = Path("content/embedding_checkpoint.json")

MODEL = "gemini-embedding-001"          # same as embedQuery Cloud Function
DIMENSION = 768
TASK_TYPE = "RETRIEVAL_DOCUMENT"        # documents use RETRIEVAL_DOCUMENT
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:embedContent"
BATCH_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:batchEmbedContents"

# Chunking params
TARGET_TOKENS = 250          # aim for ~250 tokens per chunk (tighter for timestamp precision)
MAX_TOKENS = 400             # hard max
OVERLAP_SEGMENTS = 2         # overlap 2 segments between chunks for context continuity
APPROX_CHARS_PER_TOKEN = 4   # rough estimate for English text

# Rate limiting (Gemini free tier: 1500 req/min, but each batch = 1 request)
BATCH_DELAY = 1.0            # 1s between batch requests (~60 batches/min, well within limit)
BATCH_SIZE = 100             # max texts per batchEmbedContents request
CHECKPOINT_INTERVAL = 50     # save progress every 50 embeddings


def get_api_key():
    """Get Gemini API key from environment. Prefers GEMINI_API_KEY (.env)."""
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("ERROR: No API key found. Set GEMINI_API_KEY or GOOGLE_API_KEY env var.")
        sys.exit(1)
    return key


def estimate_tokens(text):
    """Rough token estimate: ~4 chars per token for English."""
    return len(text) // APPROX_CHARS_PER_TOKEN


def merge_segments_into_chunks(segment_index):
    """Merge adjacent segments into ~400-token chunks with 1-segment overlap.
    Returns list of chunk dicts with metadata.
    """
    chunks = []
    chunk_id = 0

    for course_code, course_data in segment_index.items():
        videos = course_data.get("videos", {})

        for video_key, video_data in videos.items():
            segments = video_data.get("segments", [])
            if not segments:
                continue

            video_title = video_data.get("title", video_key)
            i = 0

            while i < len(segments):
                # Build a chunk by merging adjacent segments
                chunk_segments = [segments[i]]
                chunk_text = segments[i]["text"]
                j = i + 1

                while j < len(segments):
                    candidate_text = chunk_text + " " + segments[j]["text"]
                    if estimate_tokens(candidate_text) > MAX_TOKENS:
                        break
                    chunk_text = candidate_text
                    chunk_segments.append(segments[j])
                    j += 1

                # Only create chunk if it has meaningful content
                if estimate_tokens(chunk_text) >= 30:  # skip tiny fragments
                    chunk = {
                        "id": f"seg_{chunk_id:04d}",
                        "course_code": course_code,
                        "video_key": video_key,
                        "video_title": video_title,
                        "start_timestamp": chunk_segments[0]["start"],
                        "end_timestamp": chunk_segments[-1].get("end", chunk_segments[-1]["start"]),
                        "start_seconds": chunk_segments[0].get("start_seconds", 0),
                        "text": chunk_text,
                        "token_estimate": estimate_tokens(chunk_text),
                        "segment_count": len(chunk_segments),
                    }
                    chunks.append(chunk)
                    chunk_id += 1

                # Advance with overlap
                advance = max(1, len(chunk_segments) - OVERLAP_SEGMENTS)
                i += advance

    return chunks


def embed_text(text, api_key):
    """Call Gemini embedding API for a single text. Returns 768-dim vector."""
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

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            values = result.get("embedding", {}).get("values", [])
            if len(values) != DIMENSION:
                raise ValueError(f"Expected {DIMENSION} dims, got {len(values)}")
            return values
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")[:300]
        print(f"  API error {e.code}: {body}")
        raise


def embed_texts_batch(texts, api_key):
    """Call Gemini batchEmbedContents API. Returns list of 768-dim vectors."""
    import urllib.error
    import urllib.request

    url = f"{BATCH_API_URL}?key={api_key}"
    payload = {
        "requests": [
            {
                "model": f"models/{MODEL}",
                "content": {"parts": [{"text": t}]},
                "taskType": TASK_TYPE,
                "outputDimensionality": DIMENSION,
            }
            for t in texts
        ]
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            vectors = []
            for emb in result.get("embeddings", []):
                values = emb.get("values", [])
                if len(values) != DIMENSION:
                    raise ValueError(f"Expected {DIMENSION} dims, got {len(values)}")
                vectors.append(values)
            if len(vectors) != len(texts):
                raise ValueError(f"Expected {len(texts)} embeddings, got {len(vectors)}")
            return vectors
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")[:300]
        print(f"  Batch API error {e.code}: {body}")
        raise


def save_checkpoint(chunk_id, embeddings_done):
    """Save progress for resume capability."""
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump({
            "last_chunk_id": chunk_id,
            "embeddings_done": embeddings_done,
            "timestamp": datetime.now().isoformat(),
        }, f)


def load_checkpoint():
    """Load resume checkpoint if exists."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE) as f:
            return json.load(f)
    return None


def main():
    parser = argparse.ArgumentParser(description="Embed transcript segments for RAG")
    parser.add_argument("--dry-run", action="store_true", help="Preview chunks without embedding")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    args = parser.parse_args()

    # Load segment index
    print(f"Loading {SEGMENT_INDEX}...")
    with open(SEGMENT_INDEX, encoding="utf-8") as f:
        segment_index = json.load(f)

    print(f"  Courses: {len(segment_index)}")
    total_segs = sum(
        len(vd.get("segments", []))
        for data in segment_index.values()
        for vd in data.get("videos", {}).values()
    )
    print(f"  Total segments: {total_segs}")

    # Merge into chunks
    print("\nMerging segments into chunks...")
    chunks = merge_segments_into_chunks(segment_index)
    print(f"  Chunks created: {len(chunks)}")

    # Stats
    token_counts = [c["token_estimate"] for c in chunks]
    print(f"  Token range: {min(token_counts)}-{max(token_counts)}")
    print(f"  Avg tokens/chunk: {sum(token_counts) // len(token_counts)}")

    # Show sample
    print("\n  Sample chunk:")
    sample = chunks[len(chunks) // 2]
    print(f"    ID: {sample['id']}")
    print(f"    Course: {sample['course_code']}, Video: {sample['video_title']}")
    print(f"    Time: {sample['start_timestamp']} → {sample['end_timestamp']}")
    print(f"    Text: {sample['text'][:150]}...")
    print(f"    Tokens: ~{sample['token_estimate']}")

    if args.dry_run:
        print("\n[DRY RUN] No embeddings generated.")
        # Distribution by course
        from collections import Counter
        course_counts = Counter(c["course_code"] for c in chunks)
        print("\n  Chunks per course (top 10):")
        for code, count in course_counts.most_common(10):
            print(f"    {code}: {count} chunks")
        return

    # Get API key
    api_key = get_api_key()
    print("\n  API key: [set]")

    # Resume support
    start_idx = 0
    existing_embeddings = {}
    if args.resume:
        checkpoint = load_checkpoint()
        if checkpoint:
            start_idx = checkpoint["embeddings_done"]
            print(f"  Resuming from chunk {start_idx} ({checkpoint['timestamp']})")
            # Load existing partial output
            if OUTPUT_FILE.exists():
                with open(OUTPUT_FILE) as f:
                    existing_data = json.load(f)
                    existing_embeddings = existing_data.get("segments", {})
                    print(f"  Loaded {len(existing_embeddings)} existing embeddings")

    # Embed chunks in batches
    embeddings = dict(existing_embeddings)
    total = len(chunks)
    consecutive_errors = 0
    errors = 0
    start_time = time.time()
    remaining = chunks[start_idx:]

    print(f"\nEmbedding {len(remaining)} chunks in batches of {BATCH_SIZE} (starting at {start_idx})...\n")

    for batch_start in range(0, len(remaining), BATCH_SIZE):
        batch = remaining[batch_start:batch_start + BATCH_SIZE]
        batch_texts = [c["text"] for c in batch]
        done = start_idx + batch_start + len(batch)

        # Retry batch up to 3 times with exponential backoff
        success = False
        for attempt in range(5):
            try:
                vectors = embed_texts_batch(batch_texts, api_key)
                for chunk, vector in zip(batch, vectors):
                    embeddings[chunk["id"]] = {
                        "embedding": vector,
                        "course_code": chunk["course_code"],
                        "video_key": chunk["video_key"],
                        "video_title": chunk["video_title"],
                        "start_timestamp": chunk["start_timestamp"],
                        "end_timestamp": chunk["end_timestamp"],
                        "start_seconds": chunk["start_seconds"],
                        "text": chunk["text"][:300],   # truncated for storage
                        "token_estimate": chunk["token_estimate"],
                    }
                success = True
                consecutive_errors = 0
                break
            except Exception as e:
                wait = 5 * (attempt + 1)  # 5s, 10s, 15s, 20s, 25s
                if attempt < 4:
                    print(f"  Retry {attempt+1}/5 for batch at {batch_start} (waiting {wait}s)...")
                    time.sleep(wait)
                else:
                    consecutive_errors += 1
                    errors += len(batch)
                    print(f"  FAILED batch at {batch_start} after 5 attempts: {e}")

        if not success and consecutive_errors > 10:
            print("  Too many consecutive batch errors, stopping.")
            break

        # Progress
        elapsed = time.time() - start_time
        rate = (done - start_idx) / elapsed if elapsed > 0 else 0
        eta = (total - done) / rate if rate > 0 else 0
        print(f"  [{done}/{total}] {done * 100 // total}% "
              f"({rate:.1f} chunks/sec, ETA: {eta:.0f}s)")

        # Checkpoint
        save_checkpoint(batch[-1]["id"], done)

        time.sleep(BATCH_DELAY)

    # Compute source hash for freshness tracking
    source_hash = hashlib.sha256(
        open(SEGMENT_INDEX, "rb").read()
    ).hexdigest()

    # Safety check: don't overwrite existing file with empty data
    if not embeddings:
        print("\nWARNING: No embeddings generated! Skipping file write to protect existing data.")
        print(f"Errors: {errors}")
        return

    # Save output
    output = {
        "model": MODEL,
        "dimension": DIMENSION,
        "task_type": TASK_TYPE,
        "generated_at": datetime.now().isoformat(),
        "total_chunks": len(embeddings),
        "source": "segment_index.json",
        "source_hash": source_hash,
        "segments": embeddings,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start_time

    print(f"\n{'='*50}")
    print(f"Done! Embedded {len(embeddings)} chunks in {elapsed:.0f}s")
    print(f"Output: {OUTPUT_FILE} ({file_size_mb:.1f} MB)")
    print(f"Errors: {errors}")

    # Cleanup checkpoint
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print("Checkpoint cleaned up.")


if __name__ == "__main__":
    main()
