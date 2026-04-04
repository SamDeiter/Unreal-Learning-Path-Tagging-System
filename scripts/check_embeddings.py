#!/usr/bin/env python3
"""check_embeddings.py — Freshness checker for RAG embedding files.

Computes SHA-256 hashes of source data files and compares them against
hashes stored in the embedding JSON files. Reports which embeddings are
stale and need re-generation.

Usage:
    python scripts/check_embeddings.py          # Check all
    python scripts/check_embeddings.py --fix    # Re-run stale pipelines automatically
"""

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime

# ---------- Configuration ----------

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "path-builder", "src", "data")
CONTENT_DIR = os.path.join(ROOT, "content")

EMBEDDING_CONFIGS = [
    {
        "name": "Segment Embeddings (transcripts)",
        "embedding_file": os.path.join(DATA_DIR, "segment_embeddings.json"),
        "source_files": [
            os.path.join(DATA_DIR, "segment_index.json"),
        ],
        "regen_command": ["python", os.path.join(ROOT, "scripts", "embed_segments.py")],
        "key": "segments",
    },
    {
        "name": "Epic Learning Embeddings",
        "embedding_file": os.path.join(DATA_DIR, "epic_learning_embeddings.json"),
        "source_files": [
            os.path.join(CONTENT_DIR, "epic_learning", "extracted"),
            os.path.join(CONTENT_DIR, "epic_learning", "transcripts"),
        ],
        "regen_command": ["python", os.path.join(ROOT, "scripts", "embed_epic_learning.py")],
        "key": "epic_learning",
    },
    {
        "name": "Doc Embeddings (Epic UE5 docs)",
        "embedding_file": os.path.join(DATA_DIR, "docs_embeddings.json"),
        "source_files": [
            os.path.join(CONTENT_DIR, "scraped_docs.json"),
        ],
        "regen_command": ["python", os.path.join(ROOT, "scripts", "scrape_epic_docs.py"), "--embed-only"],
        "key": "docs",
    },
    {
        "name": "Course Embeddings",
        "embedding_file": os.path.join(DATA_DIR, "course_embeddings.json"),
        "source_files": [
            os.path.join(DATA_DIR, "video_library_enriched.json"),
        ],
        "regen_command": ["python", os.path.join(ROOT, "scripts", "build_embeddings.py")],
        "key": "courses",
    },
]

# ---------- Helpers ----------

def file_hash(filepath):
    """Compute SHA-256 of a file's contents."""
    if not os.path.exists(filepath):
        return None
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def dir_hash(dirpath):
    """Compute combined SHA-256 across all files in a directory."""
    h = hashlib.sha256()
    if not os.path.isdir(dirpath):
        return None
    for root, _dirs, files in os.walk(dirpath):
        for fname in sorted(files):
            fpath = os.path.join(root, fname)
            fh = file_hash(fpath)
            if fh:
                h.update(f"{fname}:{fh}".encode())
    return h.hexdigest()


def multi_file_hash(filepaths):
    """Compute a combined SHA-256 across multiple source files or directories."""
    h = hashlib.sha256()
    for fp in sorted(filepaths):
        if os.path.isdir(fp):
            dh = dir_hash(fp)
            if dh:
                h.update(dh.encode())
            else:
                h.update(f"EMPTY_DIR:{fp}".encode())
        else:
            fh = file_hash(fp)
            if fh:
                h.update(fh.encode())
            else:
                h.update(f"MISSING:{fp}".encode())
    return h.hexdigest()


def read_embedding_meta(filepath):
    """Read metadata from an embedding file without loading all vectors."""
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
        return {
            "source_hash": data.get("source_hash"),
            "generated_at": data.get("generated_at"),
            "total_chunks": data.get("total_chunks"),
            "model": data.get("model"),
        }
    except (OSError, json.JSONDecodeError):
        return None


def inject_hash(embedding_file, source_hash):
    """Inject source_hash into an existing embedding JSON file."""
    if not os.path.exists(embedding_file):
        return False
    try:
        with open(embedding_file, encoding="utf-8") as f:
            data = json.load(f)
        data["source_hash"] = source_hash
        with open(embedding_file, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        return True
    except (OSError, json.JSONDecodeError) as e:
        print(f"  ✗ Failed to inject hash: {e}")
        return False


def format_age(generated_at_str):
    """Return human-readable age from ISO timestamp."""
    if not generated_at_str:
        return "unknown age"
    try:
        gen = datetime.fromisoformat(generated_at_str)
        delta = datetime.now() - gen
        days = delta.days
        if days == 0:
            hours = delta.seconds // 3600
            if hours == 0:
                return f"{delta.seconds // 60} minutes ago"
            return f"{hours} hours ago"
        if days == 1:
            return "yesterday"
        if days < 7:
            return f"{days} days ago"
        if days < 30:
            return f"{days // 7} weeks ago"
        return f"{days // 30} months ago"
    except (ValueError, TypeError):
        return "unknown age"


# ---------- Main ----------

def check_all(auto_fix=False, json_output=False):
    if not json_output:
        print("=" * 60)
        print("  RAG Embedding Freshness Check")
        print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        print()

    stale_count = 0
    missing_count = 0
    fresh_count = 0
    stale_keys = []
    fresh_keys = []
    missing_keys = []

    def log(msg):
        if not json_output:
            print(msg)

    for config in EMBEDDING_CONFIGS:
        name = config["name"]
        key = config["key"]
        emb_file = config["embedding_file"]
        src_files = config["source_files"]

        log(f"📦 {name}")
        log(f"   Embedding: {os.path.relpath(emb_file, ROOT)}")

        # Check source files exist
        missing_sources = [f for f in src_files
                          if not os.path.exists(f) and not os.path.isdir(f)]
        if missing_sources:
            for ms in missing_sources:
                log(f"   ⚠️  Source missing: {os.path.relpath(ms, ROOT)}")

        # Check embedding file exists
        if not os.path.exists(emb_file):
            log("   ✗ MISSING — embedding file does not exist")
            missing_count += 1
            missing_keys.append(key)
            log("")
            continue

        # Read metadata
        meta = read_embedding_meta(emb_file)
        if not meta:
            log("   ✗ UNREADABLE — cannot parse embedding file")
            missing_count += 1
            missing_keys.append(key)
            log("")
            continue

        age = format_age(meta.get("generated_at"))
        chunks = meta.get("total_chunks", "?")
        log(f"   Generated: {age} ({chunks} chunks)")

        # Compare hashes
        current_hash = multi_file_hash(src_files)
        stored_hash = meta.get("source_hash")

        if stored_hash is None:
            log("   ⚠️  No source_hash stored — injecting current hash")
            inject_hash(emb_file, current_hash)
            log("   ✓ ASSUMED FRESH (hash now stored for future checks)")
            fresh_count += 1
            fresh_keys.append(key)
        elif stored_hash == current_hash:
            log("   ✓ FRESH — source data unchanged")
            fresh_count += 1
            fresh_keys.append(key)
        else:
            log("   ✗ STALE — source data has changed since last embedding!")
            log(f"     Stored:  {stored_hash[:16]}...")
            log(f"     Current: {current_hash[:16]}...")
            stale_count += 1
            stale_keys.append(key)

            if auto_fix and config["regen_command"]:
                log("   🔄 Re-generating...")
                try:
                    result = subprocess.run(
                        config["regen_command"],
                        cwd=ROOT,
                        capture_output=True,
                        text=True,
                        timeout=600,
                    )
                    if result.returncode == 0:
                        inject_hash(emb_file, current_hash)
                        log("   ✓ Regenerated successfully!")
                    else:
                        log(f"   ✗ Regeneration failed: {result.stderr[:200]}")
                except subprocess.TimeoutExpired:
                    log("   ✗ Regeneration timed out (10 min)")
                except Exception as e:
                    log(f"   ✗ Regeneration error: {e}")

        emb_size = os.path.getsize(emb_file)
        log(f"   Size: {emb_size / (1024*1024):.1f} MB")
        log("")

    # JSON output mode for CI
    if json_output:
        print(json.dumps({
            "stale": stale_keys,
            "fresh": fresh_keys,
            "missing": missing_keys,
        }))
        return 1 if (stale_count > 0 or missing_count > 0) else 0

    # Summary
    print("=" * 60)
    total = fresh_count + stale_count + missing_count
    if stale_count == 0 and missing_count == 0:
        print(f"  ✅ All {fresh_count} embedding files are FRESH")
    else:
        if stale_count > 0:
            print(f"  ⚠️  {stale_count}/{total} embedding files are STALE")
        if missing_count > 0:
            print(f"  ❌ {missing_count}/{total} embedding files are MISSING")
        if not auto_fix:
            print("\n  Run with --fix to auto-regenerate stale embeddings")
    print("=" * 60)

    return 1 if (stale_count > 0 or missing_count > 0) else 0


if __name__ == "__main__":
    auto_fix = "--fix" in sys.argv
    json_mode = "--json" in sys.argv
    exit_code = check_all(auto_fix, json_output=json_mode)
    sys.exit(exit_code)
