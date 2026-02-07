"""
Build Segment Index — Parse VTT transcript files to create a keyword→timestamp index.

Reads all .vtt files in content/transcripts/ and groups consecutive cues
into ~30-second segments. Outputs a JSON index that maps course codes to
searchable segments with real timestamps.

Output: path-builder/src/data/segment_index.json
"""

import os
import re
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
TRANSCRIPT_DIR = ROOT / "content" / "transcripts"
OUTPUT_PATH = ROOT / "path-builder" / "src" / "data" / "segment_index.json"

# Also load course library for playability filter
LIBRARY_PATH = ROOT / "path-builder" / "src" / "data" / "video_library_enriched.json"

# Segment duration target (seconds) — group cues into chunks of this size
SEGMENT_DURATION = 30


def parse_vtt_timestamp(ts_str):
    """Convert VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to total seconds."""
    parts = ts_str.strip().split(":")
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return 0.0


def format_timestamp(total_seconds):
    """Format total seconds into M:SS or H:MM:SS."""
    total_seconds = int(total_seconds)
    if total_seconds >= 3600:
        h = total_seconds // 3600
        m = (total_seconds % 3600) // 60
        s = total_seconds % 60
        return f"{h}:{m:02d}:{s:02d}"
    else:
        m = total_seconds // 60
        s = total_seconds % 60
        return f"{m}:{s:02d}"


def parse_vtt_file(filepath):
    """Parse a VTT file and return a list of cues with timestamps and text."""
    cues = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except (UnicodeDecodeError, OSError):
        return cues

    # Remove WEBVTT header and NOTE blocks
    content = re.sub(r"^WEBVTT.*?\n", "", content, flags=re.MULTILINE)
    content = re.sub(r"NOTE.*?\n\n", "", content, flags=re.DOTALL)

    # Split into blocks separated by blank lines
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
                # Lines after the timestamp are text
                text_lines.append(line.strip())

        if ts_line and text_lines:
            match = re.match(
                r"([\d:.]+)\s*-->\s*([\d:.]+)", ts_line
            )
            if match:
                start = parse_vtt_timestamp(match.group(1))
                end = parse_vtt_timestamp(match.group(2))
                text = " ".join(text_lines)
                # Strip HTML tags
                text = re.sub(r"<[^>]+>", "", text)
                cues.append({
                    "start": start,
                    "end": end,
                    "text": text,
                })

    return cues


def group_into_segments(cues, segment_duration=SEGMENT_DURATION):
    """Group consecutive cues into segments of approximately SEGMENT_DURATION seconds."""
    if not cues:
        return []

    segments = []
    current_start = cues[0]["start"]
    current_texts = []
    current_end = cues[0]["end"]

    for cue in cues:
        # If this cue would push us past the segment duration, finalize current segment
        if cue["start"] - current_start >= segment_duration and current_texts:
            segments.append({
                "start": format_timestamp(current_start),
                "start_seconds": int(current_start),
                "end": format_timestamp(current_end),
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
            "start_seconds": int(current_start),
            "end": format_timestamp(current_end),
            "text": " ".join(current_texts),
        })

    return segments


def extract_video_title(filename):
    """Extract a clean video title from the VTT filename."""
    # Remove extension and course code prefix
    name = Path(filename).stem
    # Remove trailing _500, _55, etc (version numbers)
    name = re.sub(r"_\d+$", "", name)
    # Remove course code prefix (e.g., "102.03_02_")
    name = re.sub(r"^\d+\.\d+_\d+_", "", name)
    # Replace underscores with spaces
    return name.replace("_", " ").strip()


def get_playable_codes():
    """Load playable course codes from the enriched library."""
    if not LIBRARY_PATH.exists():
        return set()

    with open(LIBRARY_PATH, "r", encoding="utf-8") as f:
        lib = json.load(f)

    courses = lib if isinstance(lib, list) else lib.get("courses", [])
    return {
        c["code"]
        for c in courses
        if c.get("videos") and c["videos"][0].get("drive_id")
    }


def build_segment_index():
    """Main: parse all VTT files and build the segment index."""
    if not TRANSCRIPT_DIR.exists():
        print(f"Transcript directory not found: {TRANSCRIPT_DIR}")
        return

    playable_codes = get_playable_codes()
    print(f"Playable courses: {len(playable_codes)}")

    index = {}
    total_files = 0
    total_segments = 0
    skipped_unplayable = 0

    # Iterate through course directories
    for course_dir in sorted(TRANSCRIPT_DIR.iterdir()):
        if not course_dir.is_dir():
            continue

        # Extract course code from directory name (e.g., "102_03" → "102.03")
        code = course_dir.name.replace("_", ".")
        if code not in playable_codes:
            skipped_unplayable += 1
            continue

        videos = {}
        for vtt_file in sorted(course_dir.glob("*.vtt")):
            cues = parse_vtt_file(vtt_file)
            if not cues:
                continue

            segments = group_into_segments(cues)
            if not segments:
                continue

            video_title = extract_video_title(vtt_file.name)
            video_key = vtt_file.stem

            videos[video_key] = {
                "title": video_title,
                "segment_count": len(segments),
                "segments": segments,
            }
            total_files += 1
            total_segments += len(segments)

        if videos:
            index[code] = {"videos": videos}

    # Save the index
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=1)

    print(f"Processed {total_files} VTT files → {total_segments} segments")
    print(f"Skipped {skipped_unplayable} unplayable course directories")
    print(f"Courses indexed: {len(index)}")
    print(f"Saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_segment_index()
