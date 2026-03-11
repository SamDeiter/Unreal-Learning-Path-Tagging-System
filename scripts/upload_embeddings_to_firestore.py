"""upload_embeddings_to_firestore.py — Upload embedding vectors to Firestore.

Reads the local JSON embedding files and uploads them to Firestore
collections with native vector fields for KNN search via findNearest().

Collections created:
  - epic_embeddings     (from epic_learning_embeddings.json — 3,831 chunks)
  - course_embeddings   (from course_embeddings.json — ~190 courses)
  - segment_embeddings  (from segment_embeddings.json)
  - docs_embeddings     (from docs_embeddings.json)

Usage:
  python scripts/upload_embeddings_to_firestore.py               # Upload all
  python scripts/upload_embeddings_to_firestore.py --collection epic  # Only epic
  python scripts/upload_embeddings_to_firestore.py --dry-run     # Preview only
"""

import argparse
import base64
import json
import os
import struct
import sys
import time
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1.vector import Vector
except ImportError:
    print("Installing firebase-admin...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install",
                           "firebase-admin", "-q"])
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1.vector import Vector

# ── Config ──────────────────────────────────────────────────────────────
DATA_DIR = Path("path-builder/src/data")

EMBEDDING_FILES = {
    "epic": {
        "file": DATA_DIR / "epic_learning_embeddings.json",
        "collection": "epic_embeddings",
        "description": "RAG chunks from 3,234 docs (articles + transcripts)",
    },
    "course": {
        "file": DATA_DIR / "course_embeddings.json",
        "collection": "course_embeddings",
        "description": "Course-level embeddings (~190 courses)",
    },
    "segment": {
        "file": DATA_DIR / "segment_embeddings.json",
        "collection": "segment_embeddings",
        "description": "Video segment embeddings",
    },
    "docs": {
        "file": DATA_DIR / "docs_embeddings.json",
        "collection": "docs_embeddings",
        "description": "Documentation embeddings",
    },
}

BATCH_SIZE = 450  # Firestore limit is 500 writes per batch, leave margin


def decode_embedding(value):
    """Decode an embedding that may be a list of floats OR a base64-encoded string."""
    if isinstance(value, list):
        return value  # Already a float list
    if isinstance(value, str):
        raw = base64.b64decode(value)
        return list(struct.unpack(f'{len(raw) // 4}f', raw))
    return []


def init_firebase():
    """Initialize Firebase Admin SDK using application default credentials."""
    if not firebase_admin._apps:
        # Uses GOOGLE_APPLICATION_CREDENTIALS env var or gcloud auth
        import subprocess
        try:
            # Get project ID from gcloud config
            project_id = os.environ.get("GCLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
            if not project_id:
                result = subprocess.run(
                    ["gcloud", "config", "get-value", "project"],
                    capture_output=True, text=True, timeout=10
                )
                project_id = result.stdout.strip()
            
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {"projectId": project_id})
            print(f"  Project: {project_id}")
        except Exception:
            # Fallback: try without explicit credentials (works in GCP env)
            firebase_admin.initialize_app()
    return firestore.client()


def upload_epic_embeddings(db, data, collection_name, dry_run=False):
    """Upload epic_learning_embeddings.json format (chunks dict)."""
    chunks = data.get("chunks", {})
    dimension = data.get("dimension", 768)
    model = data.get("model", "unknown")

    print(f"\n  Collection: {collection_name}")
    print(f"  Chunks: {len(chunks)}")
    print(f"  Model: {model}, Dimension: {dimension}")

    if dry_run:
        sample = list(chunks.items())[:2]
        for cid, cdata in sample:
            print(f"    Sample: {cid} -> title='{cdata.get('title', '')[:50]}'")
        return 0

    batch = db.batch()
    count = 0
    total = 0

    for chunk_id, chunk_data in chunks.items():
        embedding = chunk_data.get("embedding", [])
        if len(embedding) != dimension:
            continue

        doc_ref = db.collection(collection_name).document(chunk_id)
        doc = {
            "embedding": Vector(embedding),
            "hash_id": chunk_data.get("hash_id", ""),
            "title": chunk_data.get("title", ""),
            "url": chunk_data.get("url", ""),
            "content_type": chunk_data.get("content_type", ""),
            "author": chunk_data.get("author", ""),
            "tags": chunk_data.get("tags", []),
            "text": chunk_data.get("text", "")[:1000],  # Truncate text for Firestore
            "token_estimate": chunk_data.get("token_estimate", 0),
            "chunk_index": chunk_data.get("chunk_index", 0),
            "source": chunk_data.get("source", "epic_learning"),
        }
        batch.set(doc_ref, doc)
        count += 1
        total += 1

        if count >= BATCH_SIZE:
            batch.commit()
            print(f"    Committed {total}/{len(chunks)}")
            batch = db.batch()
            count = 0
            time.sleep(0.5)  # Brief pause between batches

    if count > 0:
        batch.commit()
        print(f"    Committed {total}/{len(chunks)}")

    return total


def upload_course_embeddings(db, data, collection_name, dry_run=False):
    """Upload course_embeddings.json format (courses dict with nested embeddings)."""
    courses = data.get("courses", {})
    dimension = data.get("dimension", 768)

    print(f"\n  Collection: {collection_name}")
    print(f"  Courses: {len(courses)}")
    print(f"  Dimension: {dimension}")

    if dry_run:
        sample = list(courses.items())[:2]
        for code, cdata in sample:
            print(f"    Sample: {code} -> title='{cdata.get('title', '')[:50]}'")
        return 0

    batch = db.batch()
    count = 0
    total = 0

    for course_code, course_data in courses.items():
        embedding = course_data.get("embedding", [])
        if len(embedding) != dimension:
            continue

        doc_ref = db.collection(collection_name).document(course_code)
        doc = {
            "embedding": Vector(embedding),
            "title": course_data.get("title", ""),
            "course_code": course_code,
        }
        batch.set(doc_ref, doc)
        count += 1
        total += 1

        if count >= BATCH_SIZE:
            batch.commit()
            print(f"    Committed {total}/{len(courses)}")
            batch = db.batch()
            count = 0

    if count > 0:
        batch.commit()
        print(f"    Committed {total}/{len(courses)}")

    return total


def upload_segment_embeddings(db, data, collection_name, dry_run=False):
    """Upload segment_embeddings.json format (segments array/dict)."""
    segments = data.get("segments", data.get("chunks", {}))

    # Handle both dict and list formats
    if isinstance(segments, list):
        items = [(f"seg_{i:06d}", s) for i, s in enumerate(segments)]
    else:
        items = list(segments.items())

    # Detect actual dimension from first embedding (metadata may be wrong)
    dimension = data.get("dimension", 768)
    if items:
        first_emb = items[0][1].get("embedding", [])
        if first_emb:
            dimension = len(first_emb)

    print(f"\n  Collection: {collection_name}")
    print(f"  Segments: {len(items)}")
    print(f"  Dimension: {dimension} (auto-detected)")

    if dry_run:
        for sid, sdata in items[:2]:
            print(f"    Sample: {sid} -> text='{str(sdata.get('text', ''))[:50]}'")
        return 0

    batch = db.batch()
    count = 0
    total = 0

    for seg_id, seg_data in items:
        embedding = decode_embedding(seg_data.get("embedding", []))
        if not embedding:
            continue

        doc_ref = db.collection(collection_name).document(str(seg_id))
        doc = {
            "embedding": Vector(embedding),
            "text": str(seg_data.get("text", ""))[:1000],
            "course_code": seg_data.get("courseCode", seg_data.get("course_code", "")),
            "video_title": seg_data.get("videoTitle", seg_data.get("video_title", "")),
            "timestamp": seg_data.get("timestamp", 0),
        }
        # Add any extra metadata fields
        for key in ["title", "url", "hash_id", "chunk_index"]:
            if key in seg_data:
                doc[key] = seg_data[key]

        batch.set(doc_ref, doc)
        count += 1
        total += 1

        if count >= BATCH_SIZE:
            batch.commit()
            print(f"    Committed {total}/{len(items)}")
            batch = db.batch()
            count = 0
            time.sleep(0.5)

    if count > 0:
        batch.commit()
        print(f"    Committed {total}/{len(items)}")

    return total


def upload_docs_embeddings(db, data, collection_name, dry_run=False):
    """Upload docs_embeddings.json format."""
    docs_data = data.get("docs", data.get("chunks", {}))

    if isinstance(docs_data, list):
        items = [(f"doc_{i:06d}", d) for i, d in enumerate(docs_data)]
    else:
        items = list(docs_data.items())

    # Detect actual dimension from first embedding (metadata may be wrong)
    dimension = data.get("dimension", 768)
    if items:
        first_emb = items[0][1].get("embedding", [])
        if first_emb:
            dimension = len(first_emb)

    print(f"\n  Collection: {collection_name}")
    print(f"  Docs: {len(items)}")
    print(f"  Dimension: {dimension} (auto-detected)")

    if dry_run:
        for did, ddata in items[:2]:
            print(f"    Sample: {did} -> title='{str(ddata.get('title', ''))[:50]}'")
        return 0

    batch = db.batch()
    count = 0
    total = 0

    for doc_id, doc_data in items:
        embedding = decode_embedding(doc_data.get("embedding", []))
        if not embedding:
            continue

        doc_ref = db.collection(collection_name).document(str(doc_id))
        doc = {
            "embedding": Vector(embedding),
            "text": str(doc_data.get("text", ""))[:1000],
            "url": doc_data.get("url", ""),
            "title": doc_data.get("title", ""),
            "section": doc_data.get("section", ""),
        }
        batch.set(doc_ref, doc)
        count += 1
        total += 1

        if count >= BATCH_SIZE:
            batch.commit()
            print(f"    Committed {total}/{len(items)}")
            batch = db.batch()
            count = 0
            time.sleep(0.5)

    if count > 0:
        batch.commit()
        print(f"    Committed {total}/{len(items)}")

    return total


# Map collection names to their upload functions
UPLOAD_HANDLERS = {
    "epic": upload_epic_embeddings,
    "course": upload_course_embeddings,
    "segment": upload_segment_embeddings,
    "docs": upload_docs_embeddings,
}


def main():
    parser = argparse.ArgumentParser(
        description="Upload embedding vectors to Firestore"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview what would be uploaded")
    parser.add_argument("--collection", choices=list(EMBEDDING_FILES.keys()),
                        help="Upload only a specific collection")
    args = parser.parse_args()

    # Determine which collections to upload
    collections = [args.collection] if args.collection else list(EMBEDDING_FILES.keys())

    print("=" * 60)
    print("Firestore Vector Upload")
    print("=" * 60)

    if args.dry_run:
        print("[DRY RUN MODE]")
    else:
        print("\nInitializing Firebase Admin SDK...")
        db = init_firebase()
        print("  Connected to Firestore.")

    total_uploaded = 0

    for coll_key in collections:
        config = EMBEDDING_FILES[coll_key]
        file_path = config["file"]
        collection_name = config["collection"]

        print(f"\n{'─' * 50}")
        print(f"  {coll_key.upper()}: {config['description']}")
        print(f"  File: {file_path}")

        if not file_path.exists():
            print(f"  SKIP: File not found")
            continue

        mb = file_path.stat().st_size / (1024 * 1024)
        print(f"  Size: {mb:.1f} MB")

        print(f"  Loading...")
        with open(file_path, "r") as f:
            data = json.load(f)

        handler = UPLOAD_HANDLERS[coll_key]

        if args.dry_run:
            handler(None, data, collection_name, dry_run=True)
        else:
            uploaded = handler(db, data, collection_name, dry_run=False)
            total_uploaded += uploaded

    print(f"\n{'=' * 60}")
    if args.dry_run:
        print("[DRY RUN] No data was uploaded.")
    else:
        print(f"Done! {total_uploaded} documents uploaded to Firestore.")
    print("=" * 60)


if __name__ == "__main__":
    main()
