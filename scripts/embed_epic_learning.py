"""embed_epic_learning.py — Phase 3: RAG Vectorization

Reads extracted Markdown files + transcripts, chunks them with a
Markdown-aware splitter, embeds via Gemini gemini-embedding-001,
and outputs a single JSON file ready for semantic search.

Output: path-builder/src/data/epic_learning_embeddings.json

Usage:
  python scripts/embed_epic_learning.py               # Full run (batch + concurrent)
  python scripts/embed_epic_learning.py --dry-run      # Preview chunks only
  python scripts/embed_epic_learning.py --incremental  # Only embed new/changed chunks
"""

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

# ── Config ──────────────────────────────────────────────────────────────
EXTRACTED_DIR = Path("content/epic_learning/extracted")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
MANIFEST_PATH = Path("content/epic_learning/video_manifest.json")
OUTPUT_FILE = Path("path-builder/src/data/epic_learning_embeddings.json")
CHECKPOINT_FILE = Path("content/epic_learning_embed_checkpoint.json")

MODEL = "gemini-embedding-001"
DIMENSION = 768
TASK_TYPE = "RETRIEVAL_DOCUMENT"
BATCH_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:batchEmbedContents"

# Chunking
TARGET_TOKENS = 500
MAX_TOKENS = 700
OVERLAP_CHARS = 200
APPROX_CHARS_PER_TOKEN = 4

# Batch embedding — Gemini supports up to 100 texts per batchEmbedContents call
BATCH_SIZE = 100        # texts per API call
MAX_CONCURRENT = 5      # parallel API calls (5 * 100 = 500 texts in flight)
MAX_RETRIES = 5         # more retries for rate-limit resilience


def get_api_key():
    """Get Gemini API key from environment."""
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        print("ERROR: Set GOOGLE_API_KEY or GEMINI_API_KEY env var.")
        sys.exit(1)
    return key


def estimate_tokens(text):
    return len(text) // APPROX_CHARS_PER_TOKEN


def content_hash(text):
    """SHA-256 hash of chunk text for incremental embedding detection."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


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
    """Load Markdown + ALL transcript types, return list of chunk-ready documents."""
    docs = []
    md_files = sorted(EXTRACTED_DIR.glob("*.md"))

    # Build hash_id → [youtube_id, ...] lookup from video manifest
    manifest_yt_lookup = {}   # hash_id -> list of youtube IDs
    manifest_cms_lookup = {}  # hash_id -> list of CMS video IDs
    all_article_hashes = set()  # track which hash_ids have articles
    
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        for yt in manifest.get("youtube_videos", []):
            h = yt.get("article_hash", "")
            if h:
                manifest_yt_lookup.setdefault(h, []).append(yt["id"])
        for cms in manifest.get("cms_videos", []):
            h = cms.get("article_hash", "")
            if h:
                manifest_cms_lookup.setdefault(h, []).append(cms["id"])
        print(f"  Manifest: {len(manifest_yt_lookup)} articles with YT, "
              f"{len(manifest_cms_lookup)} with CMS videos")

    # Track which transcript files get consumed (to find standalone ones later)
    consumed_transcripts = set()

    for md_file in md_files:
        hash_id = md_file.stem
        all_article_hashes.add(hash_id)
        meta_file = EXTRACTED_DIR / f"{hash_id}.meta.json"

        # Load markdown
        with open(md_file, "r", encoding="utf-8") as f:
            markdown = f.read()

        # Load metadata
        meta = {"hash_id": hash_id}
        if meta_file.exists():
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)

        # Load transcripts from meta.json videos array (legacy YouTube)
        transcript = ""
        for vid in meta.get("videos", []):
            if vid.get("type") == "youtube":
                yt_id = vid.get("id", "")
                txt_path = TRANSCRIPT_DIR / f"{yt_id}.txt"
                if txt_path.exists():
                    with open(txt_path, "r", encoding="utf-8") as f:
                        transcript += f"\n\n## Video Transcript\n\n{f.read()}"
                    consumed_transcripts.add(txt_path.name)

        # Load YouTube transcripts from manifest (primary source)
        for yt_id in manifest_yt_lookup.get(hash_id, []):
            txt_path = TRANSCRIPT_DIR / f"{yt_id}.txt"
            if txt_path.exists():
                with open(txt_path, "r", encoding="utf-8") as f:
                    transcript += f"\n\n## Video Transcript\n\n{f.read()}"
                consumed_transcripts.add(txt_path.name)

        # Load CMS VTT transcripts (cms_ prefix with hash)
        for cms_id in manifest_cms_lookup.get(hash_id, []):
            # Try multiple naming patterns
            for prefix in ["cms_", "whisper_", ""]:
                for pattern in [f"{prefix}{cms_id}.txt",
                               f"{prefix}{hash_id}_{cms_id}.txt"]:
                    txt_path = TRANSCRIPT_DIR / pattern
                    if txt_path.exists() and txt_path.name not in consumed_transcripts:
                        with open(txt_path, "r", encoding="utf-8") as f:
                            transcript += f"\n\n## Video Transcript\n\n{f.read()}"
                        consumed_transcripts.add(txt_path.name)

        # Also match cms_ files by hash prefix pattern
        for t in TRANSCRIPT_DIR.glob(f"cms_{hash_id}_*.txt"):
            if t.name not in consumed_transcripts:
                with open(t, "r", encoding="utf-8") as f:
                    transcript += f"\n\n## Video Transcript\n\n{f.read()}"
                consumed_transcripts.add(t.name)

        # Match whisper_ files by CMS video ID
        for cms_id in manifest_cms_lookup.get(hash_id, []):
            t = TRANSCRIPT_DIR / f"whisper_{cms_id}.txt"
            if t.exists() and t.name not in consumed_transcripts:
                with open(t, "r", encoding="utf-8") as f:
                    transcript += f"\n\n## Video Transcript (Whisper)\n\n{f.read()}"
                consumed_transcripts.add(t.name)

        # Combine markdown + transcript
        full_text = markdown
        if transcript:
            full_text += transcript

        if len(full_text.strip()) < 50:
            continue  # Skip nearly empty docs

        docs.append({"text": full_text, "meta": meta})

    # ── Standalone YouTube channel transcripts (yt_ prefix) ─────────────
    # These don't match any article; embed them as independent documents
    standalone_count = 0
    for t in sorted(TRANSCRIPT_DIR.glob("yt_*.txt")):
        if t.name in consumed_transcripts:
            continue
        yt_id = t.stem[3:]  # Remove "yt_" prefix
        with open(t, "r", encoding="utf-8") as f:
            text = f.read()
        if len(text.strip()) < 50:
            continue
        
        meta = {
            "hash_id": f"yt_{yt_id}",
            "title": f"YouTube: {yt_id}",
            "url": f"https://www.youtube.com/watch?v={yt_id}",
            "content_type": "youtube_transcript",
            "author": "Unreal Engine",
            "tags": ["youtube", "unreal-engine"],
        }
        docs.append({"text": f"## YouTube Transcript\n\n{text}", "meta": meta})
        consumed_transcripts.add(t.name)
        standalone_count += 1

    print(f"  Standalone YouTube transcripts: {standalone_count}")
    print(f"  Total transcript files consumed: {len(consumed_transcripts)}")
    return docs


# ── Batch Embedding (async + concurrent) ────────────────────────────────

async def embed_batch_async(session, texts, api_key, semaphore):
    """Embed a batch of up to 100 texts in a single batchEmbedContents call."""
    url = f"{BATCH_URL}?key={api_key}"
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

    async with semaphore:
        for attempt in range(MAX_RETRIES):
            try:
                async with session.post(url, json=payload) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        embeddings = result.get("embeddings", [])
                        vectors = [e.get("values", []) for e in embeddings]
                        return vectors
                    elif resp.status == 429:
                        # Rate limited — back off
                        wait = 2 ** (attempt + 1)
                        print(f"  Rate limited, waiting {wait}s...")
                        await asyncio.sleep(wait)
                    else:
                        body = (await resp.text())[:200]
                        if attempt < MAX_RETRIES - 1:
                            wait = 2 ** (attempt + 1)
                            print(f"  Retry {attempt+1}/{MAX_RETRIES} (HTTP {resp.status})")
                            await asyncio.sleep(wait)
                        else:
                            print(f"  API error {resp.status}: {body}")
                            return None
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** (attempt + 1))
                else:
                    print(f"  Request failed: {e}")
                    return None
    return None


async def embed_all_async(chunks, api_key):
    """Embed all chunks using concurrent batch requests for maximum speed."""
    try:
        import aiohttp
    except ImportError:
        print("Installing aiohttp for async batch requests...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "aiohttp", "-q"])
        import aiohttp

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    results = {}
    errors = 0
    start_time = time.time()

    # Split chunks into batches of BATCH_SIZE
    batches = []
    for i in range(0, len(chunks), BATCH_SIZE):
        batches.append(chunks[i:i + BATCH_SIZE])

    print(f"\n  {len(batches)} API calls needed ({BATCH_SIZE} texts/call, "
          f"{MAX_CONCURRENT} concurrent)")

    async with aiohttp.ClientSession() as session:
        # Process batches concurrently
        tasks = []
        for batch_idx, batch in enumerate(batches):
            texts = [c["text"] for c in batch]
            task = asyncio.ensure_future(
                embed_batch_async(session, texts, api_key, semaphore)
            )
            tasks.append((batch_idx, batch, task))

        completed = 0
        for batch_idx, batch, task in tasks:
            vectors = await task
            completed += 1

            if vectors and len(vectors) == len(batch):
                for chunk, vector in zip(batch, vectors):
                    if len(vector) == DIMENSION:
                        results[chunk["id"]] = {
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
                            "text_hash": content_hash(chunk["text"]),
                        }
            else:
                errors += len(batch)
                print(f"  Batch {batch_idx} failed ({len(batch)} chunks lost)")

            # Progress reporting
            done_chunks = completed * BATCH_SIZE
            if done_chunks > len(chunks):
                done_chunks = len(chunks)
            elapsed = time.time() - start_time
            rate = done_chunks / elapsed if elapsed > 0 else 0
            eta = (len(chunks) - done_chunks) / rate if rate > 0 else 0
            pct = completed * 100 // len(batches)
            print(f"  [{done_chunks}/{len(chunks)}] {pct}% "
                  f"({rate:.0f} chunks/sec, ETA: {eta:.0f}s)")

    elapsed = time.time() - start_time
    print(f"\n  Embedded {len(results)} chunks in {elapsed:.1f}s "
          f"({len(results)/elapsed:.0f} chunks/sec)")
    if errors:
        print(f"  Errors: {errors}")

    return results


# ── Main ────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Embed Epic Learning content for RAG")
    parser.add_argument("--dry-run", action="store_true", help="Preview chunks only")
    parser.add_argument("--incremental", action="store_true",
                       help="Only embed new/changed chunks (skip unchanged)")
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

    # Incremental: skip chunks whose content hasn't changed
    chunks_to_embed = all_chunks
    existing_chunks = {}
    if args.incremental and OUTPUT_FILE.exists():
        print("\n  Loading existing embeddings for incremental update...")
        with open(OUTPUT_FILE, "r") as f:
            existing_data = json.load(f)
            existing_chunks = existing_data.get("chunks", {})

        # Build hash lookup from existing
        existing_hashes = {}
        for cid, cdata in existing_chunks.items():
            h = cdata.get("text_hash")
            if h:
                existing_hashes[cid] = h

        # Filter to only new/changed chunks
        unchanged = 0
        new_chunks = []
        for chunk in all_chunks:
            chunk_h = content_hash(chunk["text"])
            if chunk["id"] in existing_hashes and existing_hashes[chunk["id"]] == chunk_h:
                unchanged += 1
            else:
                new_chunks.append(chunk)

        chunks_to_embed = new_chunks
        print(f"  Unchanged: {unchanged}, New/Modified: {len(new_chunks)}")

        if not new_chunks:
            print("\n  Nothing to embed — all chunks are up to date!")
            return

    # Embed
    api_key = get_api_key()
    print(f"\n  API key loaded (len={len(api_key)})")
    print(f"\nEmbedding {len(chunks_to_embed)} chunks...\n")

    # Run async embedding loop
    new_embeddings = asyncio.run(embed_all_async(chunks_to_embed, api_key))

    # Merge with existing (for incremental mode)
    if args.incremental:
        merged = dict(existing_chunks)
        merged.update(new_embeddings)
        # Remove chunks that no longer exist in current corpus
        current_ids = {c["id"] for c in all_chunks}
        merged = {k: v for k, v in merged.items() if k in current_ids}
        embeddings = merged
    else:
        embeddings = new_embeddings

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

    print(f"\n{'=' * 50}")
    print(f"Done! {len(embeddings)} chunks embedded")
    print(f"Output: {OUTPUT_FILE} ({mb:.1f} MB)")

    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()


if __name__ == "__main__":
    main()

