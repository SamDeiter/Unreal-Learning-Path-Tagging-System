"""embed_udn_docs.py — Embed UDN docs and merge with scraped doc embeddings.

Reads UDN docs from content/udn_docs.json (Perforce-sourced, 2362 entries),
chunks their descriptions/sections, embeds via Gemini, and merges the results
with existing scraped doc embeddings in path-builder/src/data/docs_embeddings.json.

This bridges the gap where UDN data (which covers SSS, shading models, etc.)
was never connected to the embedding pipeline.

Usage:
    python scripts/embed_udn_docs.py                 # Full run
    python scripts/embed_udn_docs.py --resume         # Resume from checkpoint
    python scripts/embed_udn_docs.py --dry-run        # Preview without embedding
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
UDN_DOCS_PATH = Path("content/udn_docs.json")
EXISTING_EMBEDDINGS = Path("path-builder/src/data/docs_embeddings.json")
OUTPUT_FILE = EXISTING_EMBEDDINGS  # Overwrite with merged result
CHECKPOINT_FILE = Path("content/udn_embedding_checkpoint.json")

MODEL = "gemini-embedding-001"
DIMENSION = 768
TASK_TYPE = "RETRIEVAL_DOCUMENT"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:embedContent"

TARGET_TOKENS = 500
MAX_TOKENS = 700
APPROX_CHARS_PER_TOKEN = 4
CHECKPOINT_INTERVAL = 100
MAX_WORKERS = 10  # Parallel embedding threads

# Skip entries with very little content
MIN_CONTENT_TOKENS = 40


def get_api_key():
    """Get Gemini API key from environment."""
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        print("ERROR: No API key found. Set GOOGLE_API_KEY or GEMINI_API_KEY env var.")
        sys.exit(1)
    return key


def estimate_tokens(text):
    return len(text) // APPROX_CHARS_PER_TOKEN


def chunk_text(text, slug, max_tokens=MAX_TOKENS, target_tokens=TARGET_TOKENS):
    """Split text into chunks of ~target_tokens, tracking section headings."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    current_section = slug

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
            if estimate_tokens(current_chunk) >= MIN_CONTENT_TOKENS:
                chunks.append({
                    "text": current_chunk,
                    "section": current_section,
                    "token_estimate": estimate_tokens(current_chunk),
                })
            current_chunk = para
        else:
            current_chunk = candidate

    # Last chunk
    if current_chunk and estimate_tokens(current_chunk) >= MIN_CONTENT_TOKENS:
        chunks.append({
            "text": current_chunk,
            "section": current_section,
            "token_estimate": estimate_tokens(current_chunk),
        })

    return chunks


def build_doc_text(entry):
    """Build embeddable text from a UDN doc entry."""
    parts = []

    label = entry.get("label", "")
    if label:
        parts.append(f"# {label}")

    description = entry.get("description", "")
    if description:
        parts.append(description)

    # Include sections as headings for context
    sections = entry.get("sections", [])
    if sections and isinstance(sections, list):
        for sec in sections:
            parts.append(f"## {sec}")

    # Include key steps
    key_steps = entry.get("keySteps", [])
    if key_steps and isinstance(key_steps, list):
        for step in key_steps:
            parts.append(f"- {step}")

    # Include tags for semantic richness
    tags = entry.get("tags", [])
    if tags and isinstance(tags, list):
        parts.append(f"Topics: {', '.join(tags)}")

    return "\n\n".join(parts)


def embed_text(text, api_key):
    """Call Gemini embedding API with retry."""
    import urllib.error
    import urllib.request

    url = f"{API_URL}?key={api_key}"
    payload = {
        "model": f"models/{MODEL}",
        "content": {"parts": [{"text": text}]},
        "taskType": TASK_TYPE,
        "outputDimensionality": DIMENSION,
    }

    for attempt in range(3):
        try:
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
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                wait = (attempt + 1) * 5
                time.sleep(wait)
            else:
                raise
        except Exception:
            if attempt < 2:
                time.sleep(2)
            else:
                raise


def save_checkpoint(done_count):
    """Save progress checkpoint."""
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump({
            "embeddings_done": done_count,
            "timestamp": datetime.now().isoformat(),
        }, f)


def embed_one_chunk(chunk, api_key):
    """Embed a single chunk — called from thread pool."""
    content_hash = hashlib.sha256(chunk["text"].encode("utf-8")).hexdigest()[:16]
    vector = embed_text(chunk["text"], api_key)
    return {
        "id": chunk["id"],
        "result": {
            "embedding": vector,
            "slug": chunk["slug"],
            "url": chunk["url"],
            "title": chunk["title"],
            "section": chunk["section"],
            "text": chunk["text"][:300],
            "token_estimate": chunk["token_estimate"],
            "content_hash": content_hash,
            "source": "udn",
        }
    }


def main():
    parser = argparse.ArgumentParser(description="Embed UDN docs and merge with scraped embeddings")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--dry-run", action="store_true", help="Preview chunks without embedding")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Parallel workers (default 10)")
    args = parser.parse_args()

    # ── Step 1: Load UDN docs ──
    print(f"Loading UDN docs from {UDN_DOCS_PATH}...")
    with open(UDN_DOCS_PATH, encoding="utf-8") as f:
        udn_data = json.load(f)
    print(f"  Loaded {len(udn_data)} UDN doc entries")

    # ── Step 2: Chunk UDN docs ──
    print("\nChunking UDN docs...")
    all_chunks = []
    skipped_short = 0

    for key, entry in udn_data.items():
        text = build_doc_text(entry)
        if estimate_tokens(text) < MIN_CONTENT_TOKENS:
            skipped_short += 1
            continue

        slug = key
        url = entry.get("url", "")
        label = entry.get("label", key)

        chunks = chunk_text(text, slug)
        for chunk in chunks:
            all_chunks.append({
                "slug": slug,
                "url": url,
                "title": label,
                "section": chunk["section"],
                "text": chunk["text"],
                "token_estimate": chunk["token_estimate"],
                "source": "udn",
            })

    print(f"  Generated {len(all_chunks)} chunks from UDN docs")
    print(f"  Skipped {skipped_short} entries (too short)")

    # ── Step 3: Load existing scraped embeddings ──
    existing_embeddings = {}
    existing_urls = set()  # Track URLs for dedup
    next_id = 0

    if EXISTING_EMBEDDINGS.exists():
        print(f"\nLoading existing scraped embeddings from {EXISTING_EMBEDDINGS}...")
        with open(EXISTING_EMBEDDINGS, encoding="utf-8") as f:
            existing_data = json.load(f)
        existing_embeddings = existing_data.get("docs", {})
        print(f"  Loaded {len(existing_embeddings)} existing scraped chunks")

        # Track existing URLs for dedup
        for doc_id, doc_data in existing_embeddings.items():
            url = doc_data.get("url", "")
            slug = doc_data.get("slug", "")
            if url:
                existing_urls.add(url)
            if slug:
                existing_urls.add(slug)

        # Find highest existing ID to continue numbering
        for doc_id in existing_embeddings:
            match = re.match(r"doc_(\d+)", doc_id)
            if match:
                next_id = max(next_id, int(match.group(1)) + 1)

    # ── Step 4: Deduplicate UDN chunks against existing ──
    new_chunks = []
    deduped = 0
    for chunk in all_chunks:
        # Skip if this URL/slug already has a scraped embedding
        if chunk["url"] in existing_urls or chunk["slug"] in existing_urls:
            deduped += 1
            continue
        chunk["id"] = f"doc_{next_id:04d}"
        next_id += 1
        new_chunks.append(chunk)

    print(f"\n  New UDN chunks to embed: {len(new_chunks)}")
    print(f"  Deduplicated (already in scraped): {deduped}")

    if args.dry_run:
        print("\n[DRY RUN] Preview of first 10 chunks:")
        for chunk in new_chunks[:10]:
            print(f"  {chunk['id']}: {chunk['title'][:60]} — {chunk['text'][:80]}...")
        # Show SSS coverage
        sss_chunks = [c for c in new_chunks if "subsurface" in c["text"].lower()]
        print(f"\n  SSS-related chunks: {len(sss_chunks)}")
        for c in sss_chunks[:5]:
            print(f"    {c['id']}: {c['title'][:60]}")
        print(f"\n  Total merged would be: {len(existing_embeddings) + len(new_chunks)} chunks")
        return

    if not new_chunks:
        print("\nNo new chunks to embed. Nothing to do.")
        return

    # ── Step 5: Parallel embed new UDN chunks ──
    api_key = get_api_key()
    print(f"\n  API key: {api_key[:8]}...{api_key[-4:]}")

    start_idx = 0
    if args.resume and CHECKPOINT_FILE.exists():
        cp = json.load(open(CHECKPOINT_FILE))
        start_idx = cp["embeddings_done"]
        print(f"  Resuming from chunk {start_idx}")

    merged_embeddings = dict(existing_embeddings)  # Start with scraped
    chunks_to_embed = new_chunks[start_idx:]
    total = len(chunks_to_embed)
    errors = 0
    done_count = 0
    lock = threading.Lock()
    start_time = time.time()
    workers = args.workers

    print(f"\nEmbedding {total} UDN doc chunks ({workers} parallel workers)...\n")

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(embed_one_chunk, chunk, api_key): chunk
            for chunk in chunks_to_embed
        }

        for future in as_completed(futures):
            chunk = futures[future]
            try:
                result = future.result()
                with lock:
                    merged_embeddings[result["id"]] = result["result"]
                    done_count += 1

                    if done_count % 50 == 0 or done_count == total:
                        elapsed = time.time() - start_time
                        rate = done_count / elapsed if elapsed > 0 else 0
                        eta = (total - done_count) / rate if rate > 0 else 0
                        print(f"  [{done_count}/{total}] {done_count * 100 // total}% "
                              f"({rate:.1f}/sec, ETA: {eta:.0f}s)")

                    if done_count % CHECKPOINT_INTERVAL == 0:
                        save_checkpoint(start_idx + done_count)

            except Exception as e:
                with lock:
                    errors += 1
                    print(f"  ERROR on {chunk['id']}: {e}")
                    if errors > 50:
                        print("  Too many errors. Use --resume to continue.")
                        executor.shutdown(wait=False, cancel_futures=True)
                        save_checkpoint(start_idx + done_count)
                        break

    # ── Step 6: Safety check — don't lose data ──
    if len(merged_embeddings) < len(existing_embeddings):
        print(f"\n⚠️  SAFETY: Merged ({len(merged_embeddings)}) < existing "
              f"({len(existing_embeddings)}). NOT overwriting.")
        backup = OUTPUT_FILE.with_suffix(".backup.json")
        with open(backup, "w") as f:
            json.dump({"docs": merged_embeddings}, f)
        print(f"  Saved to {backup} instead.")
        return

    # ── Step 7: Save merged output ──
    output = {
        "model": MODEL,
        "dimension": DIMENSION,
        "task_type": TASK_TYPE,
        "generated_at": datetime.now().isoformat(),
        "total_chunks": len(merged_embeddings),
        "source": "dev.epicgames.com + udn_perforce",
        "source_hash": hashlib.sha256(
            json.dumps(list(merged_embeddings.keys())).encode()
        ).hexdigest(),
        "docs": merged_embeddings,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start_time

    # Count sources
    scraped_count = sum(1 for v in merged_embeddings.values() if v.get("source") != "udn")
    udn_count = sum(1 for v in merged_embeddings.values() if v.get("source") == "udn")

    print(f"\n{'='*50}")
    print(f"Done! Merged embeddings in {elapsed:.0f}s")
    print(f"  Scraped (dev.epicgames.com): {scraped_count}")
    print(f"  UDN (Perforce):              {udn_count}")
    print(f"  Total:                       {len(merged_embeddings)}")
    print(f"Output: {OUTPUT_FILE} ({file_size_mb:.1f} MB)")
    print(f"Errors: {errors}")

    # Verify SSS coverage
    sss_count = sum(1 for v in merged_embeddings.values()
                    if "subsurface" in v.get("text", "").lower())
    print(f"\n  SSS-related chunks: {sss_count}")

    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print("  Checkpoint cleaned up.")


if __name__ == "__main__":
    main()
