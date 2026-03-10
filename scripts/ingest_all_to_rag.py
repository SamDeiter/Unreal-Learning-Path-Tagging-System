"""ingest_all_to_rag.py -- Comprehensive RAG ingestion for all 3 gaps.

Gap 1: 63 VTT transcript courses from content/transcripts/
Gap 2: scraped_docs.json + udn_docs.json documentation
Gap 3: Reconcile video_lookup course codes with RAG keys

Usage:
    python scripts/ingest_all_to_rag.py
"""

import json
import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAG_DIR = REPO_ROOT / "path-builder" / "src" / "data"
SEGMENT_INDEX_PATH = RAG_DIR / "segment_index.json"
TRANSCRIPT_SEGMENTS_PATH = RAG_DIR / "transcript_segments.json"

# Data sources
VTT_DIR = REPO_ROOT / "content" / "transcripts"
SCRAPED_DOCS_PATH = REPO_ROOT / "content" / "scraped_docs.json"
UDN_DOCS_PATH = REPO_ROOT / "content" / "udn_docs.json"
LOOKUP_PATH = REPO_ROOT / "path-builder" / "public" / "video_lookup.json"
CATALOG_PATH = REPO_ROOT / "content" / "epic_learning" / "catalog.json"


def segment_text(text, target_words=50):
    """Split text into ~50-word chunks for RAG."""
    text = text.strip()
    if not text:
        return []
    sentences = re.split(r'(?<=[.!?])\s+', text)
    segments = []
    current = []
    for sentence in sentences:
        words = sentence.split()
        current.extend(words)
        if len(current) >= target_words:
            segments.append(" ".join(current))
            current = []
    if current:
        segments.append(" ".join(current))
    return segments


def parse_vtt(vtt_text):
    """Extract plain text from VTT content."""
    lines = vtt_text.strip().split("\n")
    text_parts = []
    for line in lines:
        line = line.strip()
        if not line or line == "WEBVTT" or "-->" in line or line.isdigit():
            continue
        text_parts.append(line)
    return " ".join(text_parts)


def main():
    print("=" * 70)
    print("  COMPREHENSIVE RAG INGESTION")
    print("=" * 70)

    # Load existing RAG
    si = json.loads(SEGMENT_INDEX_PATH.read_text(encoding="utf-8"))
    ts = json.loads(TRANSCRIPT_SEGMENTS_PATH.read_text(encoding="utf-8"))
    original_entries = len(si)
    original_segments = len(ts)
    print(f"  Starting RAG: {original_entries} entries, {original_segments} segments")

    # ═══════════════════════════════════════════════════════════════
    # GAP 1: Ingest 63 VTT transcript courses
    # ═══════════════════════════════════════════════════════════════
    print(f"\n{'─'*70}")
    print(f"  GAP 1: VTT Transcript Courses")
    print(f"{'─'*70}")

    vtt_ingested = 0
    vtt_segments = 0

    if VTT_DIR.exists():
        for course_dir in sorted(VTT_DIR.iterdir()):
            if not course_dir.is_dir():
                continue

            course_code = course_dir.name

            # Check if this course already has VTT-sourced entries
            if course_code in si and any(
                v.get("source") == "whisper_vtt"
                for v in si[course_code].get("videos", {}).values()
            ):
                continue

            if course_code not in si:
                si[course_code] = {"videos": {}}

            for vtt_file in sorted(course_dir.glob("*.vtt")):
                vtt_text = vtt_file.read_text(encoding="utf-8", errors="replace")
                plain_text = parse_vtt(vtt_text)
                if len(plain_text.strip()) < 50:
                    continue

                chunks = segment_text(plain_text, target_words=50)
                video_name = vtt_file.stem
                video_key = f"{course_code}_{video_name}"
                title = video_name.replace("_", " ")

                seg_entries = []
                for i, chunk in enumerate(chunks):
                    seg_id = f"{video_key}_seg{i}"
                    seg_entries.append({
                        "start": f"seg_{i}",
                        "text": chunk[:200],
                    })
                    ts[seg_id] = {
                        "course": course_code,
                        "video": video_name,
                        "title": title,
                        "segment_index": i,
                        "text": chunk,
                        "source": "whisper_vtt",
                    }
                    vtt_segments += 1

                si[course_code]["videos"][video_name] = {
                    "title": title,
                    "segment_count": len(chunks),
                    "segments": seg_entries,
                    "source": "whisper_vtt",
                }
                vtt_ingested += 1

    print(f"  Ingested: {vtt_ingested} VTT files")
    print(f"  New segments: {vtt_segments}")

    # ═══════════════════════════════════════════════════════════════
    # GAP 2: Ingest scraped_docs.json + udn_docs.json
    # ═══════════════════════════════════════════════════════════════
    print(f"\n{'─'*70}")
    print(f"  GAP 2: Documentation (scraped_docs + udn_docs)")
    print(f"{'─'*70}")

    docs_ingested = 0
    docs_segments = 0

    for doc_path, source_name in [
        (SCRAPED_DOCS_PATH, "scraped_docs"),
        (UDN_DOCS_PATH, "udn_docs"),
    ]:
        if not doc_path.exists():
            print(f"  {source_name}: file not found, skipping")
            continue

        docs = json.loads(doc_path.read_text(encoding="utf-8"))
        if isinstance(docs, dict):
            docs = list(docs.values())

        doc_count = 0
        seg_count = 0

        for doc in docs:
            if not isinstance(doc, dict):
                continue

            title = doc.get("title", "")
            url = doc.get("url", "")
            description = doc.get("description", "")
            doc_type = doc.get("type", "doc")
            slug = doc.get("slug", "")

            # Build text content from sections + description
            text_parts = []
            if description:
                text_parts.append(description)

            sections = doc.get("sections", [])
            if isinstance(sections, list):
                for sec in sections:
                    if isinstance(sec, dict):
                        sec_title = sec.get("title", "")
                        sec_content = sec.get("content", sec.get("text", ""))
                        if sec_title:
                            text_parts.append(sec_title)
                        if sec_content:
                            text_parts.append(sec_content)
                    elif isinstance(sec, str):
                        text_parts.append(sec)

            # Also check keySteps, seeAlso
            for field in ["keySteps", "seeAlso", "tags"]:
                val = doc.get(field, [])
                if isinstance(val, list):
                    for item in val:
                        if isinstance(item, str):
                            text_parts.append(item)
                        elif isinstance(item, dict):
                            text_parts.append(item.get("title", item.get("name", "")))

            full_text = " ".join(t for t in text_parts if t)
            if len(full_text.strip()) < 30:
                continue

            chunks = segment_text(full_text, target_words=50)
            if not chunks:
                continue

            # Use slug or url-based key
            doc_key = slug or url.split("/")[-1] or f"{source_name}_{doc_count}"
            rag_key = f"doc_{source_name}_{doc_key}"[:80]  # Ensure reasonable key length

            if rag_key not in si:
                si[rag_key] = {"videos": {}}

            seg_entries = []
            for i, chunk in enumerate(chunks):
                seg_id = f"{rag_key}_seg{i}"
                seg_entries.append({
                    "start": f"seg_{i}",
                    "text": chunk[:200],
                })
                ts[seg_id] = {
                    "course": rag_key,
                    "video": title,
                    "title": title,
                    "url": url,
                    "segment_index": i,
                    "text": chunk,
                    "source": source_name,
                }
                seg_count += 1

            si[rag_key]["videos"][title or doc_key] = {
                "title": title,
                "url": url,
                "segment_count": len(chunks),
                "segments": seg_entries,
                "source": source_name,
            }
            doc_count += 1

        docs_ingested += doc_count
        docs_segments += seg_count
        print(f"  {source_name}: {doc_count} docs, {seg_count} segments")

    # ═══════════════════════════════════════════════════════════════
    # GAP 3: Reconcile video_lookup course codes with RAG keys
    # ═══════════════════════════════════════════════════════════════
    print(f"\n{'─'*70}")
    print(f"  GAP 3: Key Reconciliation (video_lookup ↔ catalog ↔ RAG)")
    print(f"{'─'*70}")

    # Build lookup-code to catalog-slug mapping
    lookup = json.loads(LOOKUP_PATH.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    # Map course codes (100_01, 100.01) to catalog slugs
    code_to_slug = {}
    for entry in catalog:
        slug = entry.get("slug", "")
        title = entry.get("title", "")
        # The catalog hash_id uses formats like "100.01"
        hash_id = entry.get("hash_id", "")
        if hash_id and slug:
            # Convert 100.01 -> 100_01
            code = hash_id.replace(".", "_")
            code_to_slug[code] = slug
            code_to_slug[hash_id] = slug

    # Create alias entries: if RAG has slug, add course_code alias too
    aliases_added = 0
    for code, slug in code_to_slug.items():
        underscore_code = code.replace(".", "_")
        # If RAG has the entry under the slug, add a cross-reference under the code
        if slug in si and underscore_code not in si:
            si[underscore_code] = si[slug]  # Share the same data
            aliases_added += 1
        # Vice versa: if RAG has course code, cross-ref to slug
        elif underscore_code in si and slug not in si:
            si[slug] = si[underscore_code]
            aliases_added += 1

    print(f"  Code-to-slug mappings: {len(code_to_slug)}")
    print(f"  Cross-reference aliases added: {aliases_added}")

    # ═══════════════════════════════════════════════════════════════
    # Save
    # ═══════════════════════════════════════════════════════════════
    SEGMENT_INDEX_PATH.write_text(
        json.dumps(si, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    TRANSCRIPT_SEGMENTS_PATH.write_text(
        json.dumps(ts, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\n{'='*70}")
    print(f"  COMPLETE")
    print(f"  RAG entries: {original_entries} → {len(si)} (+{len(si)-original_entries})")
    print(f"  RAG segments: {original_segments} → {len(ts)} (+{len(ts)-original_segments})")
    print(f"  Breakdown:")
    print(f"    VTT transcripts:  +{vtt_ingested} files, +{vtt_segments} segments")
    print(f"    Documentation:    +{docs_ingested} docs, +{docs_segments} segments")
    print(f"    Key aliases:      +{aliases_added}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
