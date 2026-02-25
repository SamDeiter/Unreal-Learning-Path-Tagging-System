"""fetch_epic_transcripts.py — Phase 2c: Video Transcript Extraction

Scans extracted metadata files for YouTube video references, then
uses yt-dlp to download auto-generated subtitles (no video download).

Usage:
  pip install yt-dlp
  python scripts/fetch_epic_transcripts.py
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
EXTRACTED_DIR = Path("content/epic_learning/extracted")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
BATCH_DELAY = 1.0  # Seconds between yt-dlp calls


def find_youtube_videos():
    """Scan all .meta.json files and collect YouTube video references."""
    videos = []
    for meta_file in sorted(EXTRACTED_DIR.glob("*.meta.json")):
        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)

        hash_id = meta.get("hash_id", meta_file.stem)
        title = meta.get("title", "Unknown")

        for vid in meta.get("videos", []):
            if vid.get("type") == "youtube":
                yt_id = vid.get("id", "")
                if yt_id:
                    videos.append({
                        "hash_id": hash_id,
                        "title": title,
                        "youtube_id": yt_id,
                    })
    return videos


def download_transcript(youtube_id, output_path):
    """Use yt-dlp to download auto-generated subtitles only."""
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    cmd = [
        "yt-dlp",
        "--write-auto-subs",
        "--sub-lang", "en",
        "--skip-download",
        "--sub-format", "vtt",
        "--output", str(output_path.with_suffix("")),
        url,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        # yt-dlp creates files like {name}.en.vtt
        vtt_files = list(output_path.parent.glob(f"{output_path.stem}*.vtt"))
        if vtt_files:
            # Convert VTT to plain text
            vtt_path = vtt_files[0]
            text = vtt_to_text(vtt_path)
            txt_path = output_path.with_suffix(".txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(text)
            # Clean up VTT file
            vtt_path.unlink()
            return txt_path, len(text.split())
        else:
            return None, 0
    except subprocess.TimeoutExpired:
        return None, 0
    except FileNotFoundError:
        print("  ERROR: yt-dlp not found. Install: pip install yt-dlp")
        sys.exit(1)


def vtt_to_text(vtt_path):
    """Convert WebVTT subtitles to clean plain text."""
    with open(vtt_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove VTT header
    content = re.sub(r"^WEBVTT.*?\n\n", "", content, flags=re.DOTALL)
    # Remove timestamps
    content = re.sub(r"\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*?\n", "", content)
    # Remove positioning tags
    content = re.sub(r"<[^>]+>", "", content)
    # Remove duplicate lines (auto-subs often repeat)
    seen = set()
    lines = []
    for line in content.split("\n"):
        line = line.strip()
        if line and line not in seen and not re.match(r"^\d+$", line):
            seen.add(line)
            lines.append(line)
    return " ".join(lines)


def main():
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)

    # Find all YouTube references
    print("Scanning extracted metadata for YouTube videos...")
    videos = find_youtube_videos()
    print(f"  Found {len(videos)} YouTube video references")

    if not videos:
        print("  No YouTube videos to process.")
        return

    # Filter out already-downloaded transcripts
    pending = []
    for vid in videos:
        txt_path = TRANSCRIPT_DIR / f"{vid['youtube_id']}.txt"
        if not txt_path.exists():
            pending.append(vid)

    print(f"  {len(pending)} transcripts to download ({len(videos) - len(pending)} already cached)")

    if not pending:
        print("  All transcripts already downloaded!")
        return

    # Download transcripts
    success = 0
    failed = 0

    for i, vid in enumerate(pending):
        yt_id = vid["youtube_id"]
        title = vid["title"][:40]
        output_path = TRANSCRIPT_DIR / yt_id

        txt_path, word_count = download_transcript(yt_id, output_path)
        if txt_path:
            success += 1
            print(f"  [{i+1}/{len(pending)}] ✓ {title}... ({word_count} words)")
        else:
            failed += 1
            print(f"  [{i+1}/{len(pending)}] ✗ {title}... (no subs available)")

        time.sleep(BATCH_DELAY)

    print(f"\n{'=' * 50}")
    print(f"  ✓ Downloaded: {success}")
    print(f"  ✗ No subs:    {failed}")
    print(f"  → Output:     {TRANSCRIPT_DIR}")


if __name__ == "__main__":
    start = time.time()
    main()
    print(f"\nTotal time: {time.time() - start:.1f}s")
