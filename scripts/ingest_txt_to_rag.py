"""ingest_txt_to_rag.py -- Ingest .txt transcripts into the RAG database.

Reads .txt transcripts from content/epic_learning/transcripts/, segments them
into ~30-second chunks, maps them to courses via lesson_urls.json/catalog.json,
and adds them to the RAG database (segment_index.json, transcript_segments.json).

Usage:
    python scripts/ingest_txt_to_rag.py --dry-run    # Preview what will be ingested
    python scripts/ingest_txt_to_rag.py               # Full ingestion
"""

import argparse
import json
import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TXT_DIR = REPO_ROOT / "content" / "epic_learning" / "transcripts"
CATALOG_PATH = REPO_ROOT / "content" / "epic_learning" / "catalog.json"
LESSON_URLS_PATH = REPO_ROOT / "content" / "epic_learning" / "lesson_urls.json"
RAG_DIR = REPO_ROOT / "path-builder" / "src" / "data"
SEGMENT_INDEX_PATH = RAG_DIR / "segment_index.json"
TRANSCRIPT_SEGMENTS_PATH = RAG_DIR / "transcript_segments.json"


def load_lesson_mapping():
    """Build mapping from lesson hash -> course info from lesson_urls.json and catalog.json."""
    mapping = {}

    # Load catalog for course-level info
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    catalog_by_hash = {}
    catalog_by_slug = {}
    for entry in catalog:
        h = entry.get("hash_id", "")
        s = entry.get("slug", "")
        if h:
            catalog_by_hash[h] = entry
        if s:
            catalog_by_slug[s] = entry

    # Load lesson_urls for lesson -> course mapping
    if LESSON_URLS_PATH.exists():
        lesson_urls = json.loads(LESSON_URLS_PATH.read_text(encoding="utf-8"))
        if isinstance(lesson_urls, dict):
            for course_hash, lessons in lesson_urls.items():
                course_info = catalog_by_hash.get(course_hash, {})
                if isinstance(lessons, list):
                    for lesson in lessons:
                        if isinstance(lesson, dict):
                            lhash = lesson.get("lessonHash", "")
                            if lhash:
                                mapping[f"lesson_{lhash}"] = {
                                    "course_hash": course_hash,
                                    "course_title": course_info.get("title", course_hash),
                                    "course_slug": course_info.get("slug", ""),
                                    "lesson_title": lesson.get("title", ""),
                                    "lesson_slug": lesson.get("lessonSlug", ""),
                                }

    return mapping, catalog_by_hash, catalog_by_slug


def segment_text(text, target_words=50):
    """Split text into segments of approximately target_words words.
    
    Returns list of dicts: {text, start_idx, end_idx}
    """
    # Clean text
    text = text.strip()
    if not text:
        return []

    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)

    segments = []
    current_words = []
    current_start = 0

    for sentence in sentences:
        words = sentence.split()
        current_words.extend(words)

        if len(current_words) >= target_words:
            segment_text = " ".join(current_words)
            segments.append({
                "text": segment_text,
                "word_count": len(current_words),
            })
            current_words = []

    # Flush remaining
    if current_words:
        segment_text = " ".join(current_words)
        segments.append({
            "text": segment_text,
            "word_count": len(current_words),
        })

    return segments


def build_rag_key(course_info, filename_stem):
    """Build a RAG-compatible key for a transcript."""
    if course_info:
        slug = course_info.get("course_slug", "")
        if slug:
            return slug
    # Fallback: use filename
    return f"epic_{filename_stem}"


def main():
    parser = argparse.ArgumentParser(description="Ingest .txt transcripts into RAG database")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    args = parser.parse_args()

    print("=" * 60)
    print("  TXT TRANSCRIPT -> RAG INGESTION")
    print("=" * 60)

    # Load existing RAG data
    segment_index = json.loads(SEGMENT_INDEX_PATH.read_text(encoding="utf-8"))
    transcript_segments = json.loads(TRANSCRIPT_SEGMENTS_PATH.read_text(encoding="utf-8"))
    existing_count = len(segment_index)

    print(f"  Existing RAG entries: {existing_count}")

    # Load lesson mapping
    mapping, catalog_by_hash, catalog_by_slug = load_lesson_mapping()
    print(f"  Lesson mappings loaded: {len(mapping)}")

    # Get .txt files not already in RAG
    txt_files = sorted([f for f in os.listdir(TXT_DIR) if f.endswith(".txt")])
    print(f"  Total .txt files: {len(txt_files)}")

    # Check which are already indexed
    existing_keys = set(segment_index.keys())
    # Also build reverse lookup to avoid duplicating by slug
    existing_slugs = set()
    for key, data in segment_index.items():
        existing_slugs.add(key)

    new_files = []
    matched = 0
    unmatched = 0

    for f in txt_files:
        stem = os.path.splitext(f)[0]
        course_info = mapping.get(stem)

        rag_key = build_rag_key(course_info, stem)
        if rag_key in existing_keys:
            continue

        content = Path(TXT_DIR / f).read_text(encoding="utf-8", errors="replace")
        if len(content.strip()) < 50:  # Skip near-empty files
            continue

        if course_info:
            matched += 1
        else:
            unmatched += 1

        new_files.append({
            "filename": f,
            "stem": stem,
            "course_info": course_info,
            "rag_key": rag_key,
            "content_len": len(content),
        })

    print(f"\n  New files to ingest: {len(new_files)}")
    print(f"    Mapped to courses: {matched}")
    print(f"    Unmapped (will use filename): {unmatched}")

    if args.dry_run:
        print("\n  DRY RUN — sample of what would be ingested:\n")
        for nf in new_files[:10]:
            info = nf["course_info"]
            title = info["course_title"][:40] if info else "(unmapped)"
            print(f"    {nf['stem'][:25]:25s} -> {title}  ({nf['content_len']} chars)")
        print(f"\n  Total new entries: {len(new_files)}")
        return

    if not new_files:
        print("  Nothing new to ingest!")
        return

    # Ingest
    ingested = 0
    total_segments = 0

    for nf in new_files:
        stem = nf["stem"]
        rag_key = nf["rag_key"]
        course_info = nf["course_info"]

        content = Path(TXT_DIR / nf["filename"]).read_text(encoding="utf-8", errors="replace")
        segments = segment_text(content, target_words=50)

        if not segments:
            continue

        # Build segment index entry
        video_key = stem
        title = ""
        if course_info:
            title = course_info.get("lesson_title", course_info.get("course_title", stem))
        else:
            # Try to extract title from first line
            first_line = content.strip().split("\n")[0][:80]
            title = first_line if first_line else stem

        segment_entries = []
        for i, seg in enumerate(segments):
            seg_id = f"{rag_key}_{video_key}_seg{i}"
            segment_entries.append({
                "start": f"seg_{i}",
                "text": seg["text"][:200],  # Preview
            })

            # Add to transcript_segments
            transcript_segments[seg_id] = {
                "course": rag_key,
                "video": video_key,
                "title": title,
                "segment_index": i,
                "text": seg["text"],
                "source": "epic_learning_txt",
            }
            total_segments += 1

        # Add/update segment_index
        if rag_key not in segment_index:
            segment_index[rag_key] = {"videos": {}}

        segment_index[rag_key]["videos"][video_key] = {
            "title": title,
            "segment_count": len(segments),
            "segments": segment_entries,
            "source": "epic_learning_txt",
        }

        ingested += 1
        if ingested % 100 == 0:
            print(f"    Ingested {ingested}/{len(new_files)} files...")

    # Save
    SEGMENT_INDEX_PATH.write_text(
        json.dumps(segment_index, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    TRANSCRIPT_SEGMENTS_PATH.write_text(
        json.dumps(transcript_segments, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\n{'='*60}")
    print(f"  COMPLETE")
    print(f"  Ingested: {ingested} files")
    print(f"  New segments: {total_segments}")
    print(f"  Total RAG entries: {len(segment_index)} (was {existing_count})")
    print(f"  Saved to: {SEGMENT_INDEX_PATH.name}, {TRANSCRIPT_SEGMENTS_PATH.name}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
