#!/usr/bin/env python3
"""
audit_transcripts.py
Health check for all transcript files in the epic_learning/transcripts folder.

Reports:
  - Transcript counts by type (yt_, cms_, whisper_, legacy)
  - Total size and coverage stats
  - Broken/empty files (< 200 bytes)
  - Files with repetitive content (potential hallucinations)
  - Missing whisper transcripts for CMS videos

Usage:
    python scripts/audit_transcripts.py
    python scripts/audit_transcripts.py --verbose
"""

import argparse
import glob
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

TRANSCRIPT_DIR = Path(__file__).parent.parent / "content" / "epic_learning" / "transcripts"
MANIFEST_PATH = Path(__file__).parent.parent / "content" / "epic_learning" / "cms_stream_urls_v2.json"
MIN_BYTES = 200  # files under this threshold are flagged


def classify_file(name: str) -> str:
    """Classify a transcript file by its prefix."""
    if name.startswith("yt_"):
        return "YouTube"
    elif name.startswith("cms_"):
        return "CMS"
    elif name.startswith("whisper_"):
        return "Whisper"
    else:
        return "Legacy"


def check_repetition(text: str, min_words: int = 5, min_repeats: int = 3) -> str | None:
    """Check if a file has suspiciously repetitive content."""
    words = text.split()
    if len(words) < min_words * min_repeats:
        return None

    for phrase_len in range(min_words, 10):
        i = 0
        while i <= len(words) - phrase_len:
            phrase = " ".join(words[i:i + phrase_len])
            count = 1
            j = i + phrase_len
            while j + phrase_len <= len(words):
                if " ".join(words[j:j + phrase_len]).lower() == phrase.lower():
                    count += 1
                    j += phrase_len
                else:
                    break
            if count >= min_repeats:
                return f'"{phrase[:50]}..." repeated {count}x'
            i += 1
    return None


def load_manifest() -> dict:
    """Load CMS manifest to check whisper coverage."""
    if not MANIFEST_PATH.exists():
        return {}
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def main():
    parser = argparse.ArgumentParser(description="Audit transcript health")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed file list")
    args = parser.parse_args()

    files = sorted(TRANSCRIPT_DIR.glob("*.txt"))
    if not files:
        print("No transcript files found.")
        sys.exit(1)

    print(f"\n  Transcript Health Audit")
    print(f"  {'=' * 45}")

    # ── Classify ──
    categories = Counter()
    sizes = {}
    for f in files:
        cat = classify_file(f.name)
        categories[cat] += 1
        sizes[cat] = sizes.get(cat, 0) + f.stat().st_size

    total_size = sum(f.stat().st_size for f in files)
    print(f"\n  Total files:    {len(files)} ({total_size / 1024 / 1024:.1f} MB)")
    print(f"  {'-' * 30}")
    for cat in ["YouTube", "CMS", "Whisper", "Legacy"]:
        count = categories.get(cat, 0)
        size = sizes.get(cat, 0)
        print(f"  {cat:12s}  {count:4d} files  ({size / 1024:.0f} KB)")

    # ── Broken files ──
    broken = []
    for f in files:
        if f.stat().st_size < MIN_BYTES:
            try:
                content = f.read_text(encoding="utf-8").strip()
            except Exception:
                content = "<unreadable>"
            broken.append((f.name, f.stat().st_size, content[:80]))

    print(f"\n  Broken/Empty Files (< {MIN_BYTES} bytes)")
    print(f"  {'-' * 30}")
    if broken:
        for name, size, content in broken:
            print(f"  ⚠ {name}: {size} bytes → [{content}]")
    else:
        print(f"  ✅ None found")

    # ── Repetition check ──
    print(f"\n  Hallucination Check")
    print(f"  {'-' * 30}")
    hallucinations = []
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except Exception:
            continue
        if len(text) < 200:
            continue
        result = check_repetition(text)
        if result:
            hallucinations.append((f.name, result))
            print(f"  ⚠ {f.name}: {result}")
    if not hallucinations:
        print(f"  ✅ No repetitive content detected")

    # ── Whisper coverage ──
    manifest = load_manifest()
    if manifest:
        print(f"\n  Whisper Coverage")
        print(f"  {'-' * 30}")
        manifest_ids = set()
        for entry in manifest.values():
            if isinstance(entry, dict) and "video_id" in entry:
                manifest_ids.add(entry["video_id"])
            elif isinstance(entry, dict):
                for v in entry.values():
                    if isinstance(v, dict) and "video_id" in v:
                        manifest_ids.add(v["video_id"])

        whisper_ids = set()
        for f in files:
            if f.name.startswith("whisper_"):
                # Extract ID from filename: whisper_V_XXXX.txt or whisper_1_XXXX.txt
                stem = f.stem
                parts = stem.split("_", 2)
                if len(parts) >= 3:
                    whisper_ids.add(parts[2])

        # Check coverage from manifest
        total_cms = len(manifest)
        covered = len(whisper_ids)
        print(f"  CMS videos in manifest: {total_cms}")
        print(f"  Whisper transcripts:    {covered}")
        pct = (covered / total_cms * 100) if total_cms > 0 else 0
        print(f"  Coverage:               {pct:.0f}%")

    # ── Summary ──
    print(f"\n  Overall Health")
    print(f"  {'-' * 30}")
    issues = len(broken) + len(hallucinations)
    if issues == 0:
        print(f"  All clean -- {len(files)} transcripts, no issues")
    else:
        print(f"  {issues} issue(s) found across {len(files)} transcripts")
    print()


if __name__ == "__main__":
    main()
