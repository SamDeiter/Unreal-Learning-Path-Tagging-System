"""
Build Transcript Segments Index
Parses VTT files from content/transcripts/ and produces a compact JSON
mapping each video to timestamped text segments.

Output: path-builder/src/data/transcript_segments.json
"""

import os
import re
import json
from pathlib import Path

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPTS_DIR = REPO_ROOT / "content" / "transcripts"
OUTPUT_FILE = REPO_ROOT / "path-builder" / "src" / "data" / "transcript_segments.json"

# Segment grouping: merge cues into ~30-second chunks
SEGMENT_DURATION_SECONDS = 30


def parse_vtt_timestamp(ts):
    """Convert VTT timestamp (HH:MM:SS.mmm) to total seconds."""
    parts = ts.strip().split(":")
    if len(parts) == 3:
        h, m, s = parts
    elif len(parts) == 2:
        h = "0"
        m, s = parts
    else:
        return 0
    s = s.replace(",", ".")  # handle SRT format
    return int(h) * 3600 + int(m) * 60 + float(s)


def format_timestamp(seconds):
    """Format seconds to M:SS display string."""
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"


def parse_vtt_file(filepath):
    """Parse a VTT file into a list of cues with start, end, text."""
    cues = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove WEBVTT header
    content = re.sub(r"^WEBVTT\s*\n", "", content.strip())

    # Split into cue blocks (separated by blank lines)
    blocks = re.split(r"\n\s*\n", content.strip())

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 2:
            continue

        # Find the timestamp line
        ts_line = None
        text_lines = []
        for line in lines:
            if "-->" in line:
                ts_line = line
            elif ts_line is not None:
                text_lines.append(line.strip())

        if not ts_line or not text_lines:
            continue

        # Parse timestamps
        match = re.match(r"([\d:.,]+)\s*-->\s*([\d:.,]+)", ts_line)
        if not match:
            continue

        start = parse_vtt_timestamp(match.group(1))
        end = parse_vtt_timestamp(match.group(2))
        text = " ".join(text_lines).strip()

        if text:
            cues.append({"start": start, "end": end, "text": text})

    return cues


def group_cues_into_segments(cues, chunk_seconds=SEGMENT_DURATION_SECONDS):
    """Group consecutive cues into larger segments for readability."""
    if not cues:
        return []

    segments = []
    current_start = cues[0]["start"]
    current_texts = []
    current_end = cues[0]["end"]

    for cue in cues:
        if cue["start"] - current_start >= chunk_seconds and current_texts:
            # Finalize current segment
            segments.append({
                "start": format_timestamp(current_start),
                "end": format_timestamp(current_end),
                "startSec": round(current_start, 1),
                "text": " ".join(current_texts),
            })
            current_start = cue["start"]
            current_texts = []

        current_texts.append(cue["text"])
        current_end = cue["end"]

    # Don't forget the last segment
    if current_texts:
        segments.append({
            "start": format_timestamp(current_start),
            "end": format_timestamp(current_end),
            "startSec": round(current_start, 1),
            "text": " ".join(current_texts),
        })

    return segments


def extract_video_key(filename):
    """Extract a clean video key from VTT filename.
    
    Example: '100.01_12_Lumen_55.vtt' -> '12_Lumen'
    """
    name = Path(filename).stem

    # Remove course prefix (100.01_)
    name = re.sub(r"^\d+\.\d+_", "", name)

    # Remove trailing version numbers (_55, _56, _1, _NEW)
    name = re.sub(r"_\d+$", "", name)
    name = re.sub(r"_NEW$", "", name)

    return name


def build_index():
    """Main: parse all VTT files and build the segments index."""
    index = {}
    total_files = 0
    total_segments = 0

    if not TRANSCRIPTS_DIR.exists():
        print(f"ERROR: Transcripts directory not found: {TRANSCRIPTS_DIR}")
        return

    for course_dir in sorted(TRANSCRIPTS_DIR.iterdir()):
        if not course_dir.is_dir():
            continue

        # Convert folder name (100_01) to course code (100.01)
        course_code = course_dir.name.replace("_", ".")

        course_segments = {}

        for vtt_file in sorted(course_dir.glob("*.vtt")):
            cues = parse_vtt_file(vtt_file)
            if not cues:
                continue

            segments = group_cues_into_segments(cues)
            if not segments:
                continue

            video_key = extract_video_key(vtt_file.name)
            course_segments[video_key] = segments
            total_files += 1
            total_segments += len(segments)

        if course_segments:
            index[course_code] = course_segments

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    file_size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"Built transcript index:")
    print(f"  Courses: {len(index)}")
    print(f"  VTT files: {total_files}")
    print(f"  Segments: {total_segments}")
    print(f"  Output: {OUTPUT_FILE} ({file_size_kb:.1f} KB)")


if __name__ == "__main__":
    build_index()
