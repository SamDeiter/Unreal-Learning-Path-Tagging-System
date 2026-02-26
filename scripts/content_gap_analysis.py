#!/usr/bin/env python3
"""
content_gap_analysis.py
Cross-reference the video manifest against transcript files to identify
coverage gaps — which videos have transcripts and which don't.

Usage:
    python scripts/content_gap_analysis.py
    python scripts/content_gap_analysis.py --verbose
"""

import argparse
import glob
import json
import os
import sys
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent / "content" / "epic_learning" / "video_manifest.json"
TRANSCRIPT_DIR = Path(__file__).parent.parent / "content" / "epic_learning" / "transcripts"
CMS_URLS_PATH = Path(__file__).parent.parent / "content" / "epic_learning" / "cms_stream_urls_v2.json"


def load_manifest():
    """Load video manifest."""
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_transcript_ids():
    """Get set of all transcript identifiers from filenames."""
    ids = set()
    for f in TRANSCRIPT_DIR.glob("*.txt"):
        stem = f.stem
        # Skip .bak files
        if stem.endswith(".bak"):
            continue
        ids.add(stem)
        # Also track the raw video ID for matching
        # YouTube: yt_XXXX -> XXXX
        if stem.startswith("yt_"):
            ids.add(stem[3:])
        # CMS: cms_HASH_TYPE_ID -> extract ID part
        elif stem.startswith("cms_"):
            parts = stem.split("_")
            if len(parts) >= 4:
                ids.add("_".join(parts[2:]))
        # Whisper: whisper_TYPE_ID -> extract ID part
        elif stem.startswith("whisper_"):
            parts = stem.split("_", 2)
            if len(parts) >= 3:
                ids.add(parts[2])
        # Legacy: just the raw filename stem (e.g. YouTube IDs)
        else:
            ids.add(stem)
    return ids


def check_coverage(manifest, transcript_ids, verbose=False):
    """Check which manifest videos have transcripts."""
    yt_videos = manifest.get("youtube_videos", [])
    cms_videos = manifest.get("cms_videos", [])

    yt_covered = []
    yt_missing = []
    cms_covered = []
    cms_missing = []

    # Check YouTube videos
    for v in yt_videos:
        vid_id = v.get("id", "")
        title = v.get("article_title", "Unknown")
        has_transcript = (
            vid_id in transcript_ids
            or f"yt_{vid_id}" in transcript_ids
        )
        if has_transcript:
            yt_covered.append((vid_id, title))
        else:
            yt_missing.append((vid_id, title))

    # Check CMS videos
    for v in cms_videos:
        vid_id = v.get("id", "")
        title = v.get("article_title", "Unknown")
        # CMS transcripts can come from cms_ or whisper_ prefixes
        has_transcript = any(
            vid_id in tid or tid.endswith(vid_id)
            for tid in transcript_ids
        )
        if has_transcript:
            cms_covered.append((vid_id, title))
        else:
            cms_missing.append((vid_id, title))

    return yt_covered, yt_missing, cms_covered, cms_missing


def main():
    parser = argparse.ArgumentParser(description="Content gap analysis")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Show individual video titles")
    args = parser.parse_args()

    if not MANIFEST_PATH.exists():
        print("Error: video_manifest.json not found")
        sys.exit(1)

    manifest = load_manifest()
    transcript_ids = load_transcript_ids()
    total_transcripts = len(list(TRANSCRIPT_DIR.glob("*.txt")))

    yt_covered, yt_missing, cms_covered, cms_missing = check_coverage(
        manifest, transcript_ids, args.verbose
    )

    total_yt = len(yt_covered) + len(yt_missing)
    total_cms = len(cms_covered) + len(cms_missing)
    total_videos = total_yt + total_cms
    total_covered = len(yt_covered) + len(cms_covered)

    yt_pct = (len(yt_covered) / total_yt * 100) if total_yt > 0 else 0
    cms_pct = (len(cms_covered) / total_cms * 100) if total_cms > 0 else 0
    total_pct = (total_covered / total_videos * 100) if total_videos > 0 else 0

    print(f"\n  Content Gap Analysis")
    print(f"  {'=' * 50}")
    print(f"\n  Transcript files on disk: {total_transcripts}")
    print(f"  Videos in manifest:      {total_videos}")

    print(f"\n  Coverage by Source")
    print(f"  {'-' * 50}")
    print(f"  YouTube:  {len(yt_covered):3d} / {total_yt:3d}  ({yt_pct:.0f}%)")
    print(f"  CMS:      {len(cms_covered):3d} / {total_cms:3d}  ({cms_pct:.0f}%)")
    print(f"  TOTAL:    {total_covered:3d} / {total_videos:3d}  ({total_pct:.0f}%)")

    # Show missing videos
    if yt_missing:
        print(f"\n  Missing YouTube Transcripts ({len(yt_missing)})")
        print(f"  {'-' * 50}")
        for vid_id, title in yt_missing[:15]:
            print(f"  - [{vid_id}] {title[:70]}")
        if len(yt_missing) > 15:
            print(f"  ... and {len(yt_missing) - 15} more")

    if cms_missing:
        print(f"\n  Missing CMS Transcripts ({len(cms_missing)})")
        print(f"  {'-' * 50}")
        for vid_id, title in cms_missing[:15]:
            print(f"  - [{vid_id}] {title[:70]}")
        if len(cms_missing) > 15:
            print(f"  ... and {len(cms_missing) - 15} more")

    if args.verbose and yt_covered:
        print(f"\n  Covered YouTube Videos ({len(yt_covered)})")
        print(f"  {'-' * 50}")
        for vid_id, title in yt_covered:
            print(f"  + [{vid_id}] {title[:70]}")

    if args.verbose and cms_covered:
        print(f"\n  Covered CMS Videos ({len(cms_covered)})")
        print(f"  {'-' * 50}")
        for vid_id, title in cms_covered[:20]:
            print(f"  + [{vid_id}] {title[:70]}")
        if len(cms_covered) > 20:
            print(f"  ... and {len(cms_covered) - 20} more")

    # Whisper pipeline status
    if CMS_URLS_PATH.exists():
        try:
            urls = json.load(open(CMS_URLS_PATH, "r", encoding="utf-8"))
            whisper_files = list(TRANSCRIPT_DIR.glob("whisper_*.txt"))
            print(f"\n  Whisper Pipeline Status")
            print(f"  {'-' * 50}")
            print(f"  CMS videos to transcribe: {len(urls)}")
            print(f"  Whisper transcripts done:  {len(whisper_files)}")
            wpct = (len(whisper_files) / len(urls) * 100) if urls else 0
            print(f"  Progress:                 {wpct:.0f}%")
        except Exception:
            pass

    # Overall health
    print(f"\n  Overall")
    print(f"  {'-' * 50}")
    if total_pct >= 90:
        print(f"  Excellent coverage ({total_pct:.0f}%)")
    elif total_pct >= 70:
        print(f"  Good coverage ({total_pct:.0f}%) -- {total_videos - total_covered} gaps remain")
    elif total_pct >= 50:
        print(f"  Moderate coverage ({total_pct:.0f}%) -- {total_videos - total_covered} gaps")
    else:
        print(f"  Low coverage ({total_pct:.0f}%) -- {total_videos - total_covered} gaps need attention")
    print()


if __name__ == "__main__":
    main()
