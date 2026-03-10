"""transcribe_missing_courses.py -- Optimized local transcription pipeline.

Uses faster-whisper (CTranslate2) with int8 quantization for 4x speedup
over standard Whisper. Downloads next video in parallel while transcribing.

Speed: ~12-14x realtime on RTX 3080 with medium.en + int8
VRAM:  ~2.5GB (won't lag your PC)

Usage:
    python scripts/transcribe_missing_courses.py --dry-run            # Preview + time estimate
    python scripts/transcribe_missing_courses.py                      # Full run (medium.en)
    python scripts/transcribe_missing_courses.py --limit 5            # Test 5 clips
    python scripts/transcribe_missing_courses.py --course 100_11      # Single course
"""

import argparse
import json
import os
import pickle
import re
import time
from concurrent.futures import ThreadPoolExecutor, Future
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
LOOKUP_PATH = REPO_ROOT / "path-builder" / "public" / "video_lookup.json"
TRANSCRIPTS_DIR = REPO_ROOT / "content" / "transcripts"
PROGRESS_FILE = REPO_ROOT / "content" / "whisper_drive_progress.json"
CACHE_DIR = REPO_ROOT / "temp_audio"
TOKEN_FILE = REPO_ROOT / "token.pickle"

# RAG database paths
RAG_DIR = REPO_ROOT / "path-builder" / "src" / "data"
SEGMENT_INDEX_PATH = RAG_DIR / "segment_index.json"
TRANSCRIPT_SEGMENTS_PATH = RAG_DIR / "transcript_segments.json"


# ── Drive Service ───────────────────────────────────────────────────────

def get_drive_service():
    """Load existing token.pickle and build Drive service."""
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    if not TOKEN_FILE.exists():
        raise FileNotFoundError(
            f"token.pickle not found at {TOKEN_FILE}. "
            "Run drive_sync_optimized.py first to create it."
        )

    with open(TOKEN_FILE, "rb") as f:
        creds = pickle.load(f)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, "wb") as f:
            pickle.dump(creds, f)

    return build("drive", "v3", credentials=creds)


def download_video(service, file_id, output_path):
    """Download a video file from Google Drive by ID."""
    from googleapiclient.http import MediaIoBaseDownload

    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    with open(output_path, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
    return output_path


# ── VTT Formatting ─────────────────────────────────────────────────────

def format_vtt_timestamp(seconds):
    """Convert seconds to VTT timestamp HH:MM:SS.mmm."""
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    ms = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def segments_to_vtt(segments):
    """Convert faster-whisper segments to WebVTT format."""
    lines = ["WEBVTT", ""]
    for i, seg in enumerate(segments, 1):
        start = format_vtt_timestamp(seg.start)
        end = format_vtt_timestamp(seg.end)
        text = seg.text.strip()
        if text:
            lines.append(str(i))
            lines.append(f"{start} --> {end}")
            lines.append(text)
            lines.append("")
    return "\n".join(lines)


# ── Inline RAG Ingestion ────────────────────────────────────────────────

def _segment_text(text, target_words=50):
    """Split text into ~50-word segments for RAG indexing."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
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


def _load_rag_db():
    """Load the RAG database files."""
    si = json.loads(SEGMENT_INDEX_PATH.read_text(encoding="utf-8"))
    ts = json.loads(TRANSCRIPT_SEGMENTS_PATH.read_text(encoding="utf-8"))
    return si, ts


def _save_rag_db(si, ts):
    """Save the RAG database files."""
    SEGMENT_INDEX_PATH.write_text(
        json.dumps(si, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    TRANSCRIPT_SEGMENTS_PATH.write_text(
        json.dumps(ts, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def ingest_to_rag(course_code, video_name, segments, rag_si, rag_ts):
    """Add a transcribed clip's segments directly to the in-memory RAG database.

    Args:
        course_code: e.g. "100_11"
        video_name: e.g. "100.11_05_EquipmentTour_v02_5.3"
        segments: list of faster-whisper segment objects
        rag_si: in-memory segment_index dict
        rag_ts: in-memory transcript_segments dict
    Returns:
        number of RAG segments added
    """
    # Combine all segment text
    full_text = " ".join(seg.text.strip() for seg in segments if seg.text.strip())
    if not full_text:
        return 0

    # Split into ~50-word RAG chunks
    chunks = _segment_text(full_text, target_words=50)

    # Build the title from the video name
    title = video_name.replace("_", " ")
    video_key = f"{course_code}_{video_name}"

    # Add to segment_index
    if course_code not in rag_si:
        rag_si[course_code] = {"videos": {}}

    seg_entries = []
    for i, chunk in enumerate(chunks):
        seg_id = f"{video_key}_seg{i}"
        seg_entries.append({
            "start": format_vtt_timestamp(segments[min(i * 3, len(segments) - 1)].start) if segments else f"seg_{i}",
            "text": chunk[:200],
        })
        rag_ts[seg_id] = {
            "course": course_code,
            "video": video_name,
            "title": title,
            "segment_index": i,
            "text": chunk,
            "source": "whisper_vtt",
        }

    rag_si[course_code]["videos"][video_name] = {
        "title": title,
        "segment_count": len(chunks),
        "segments": seg_entries,
        "source": "whisper_vtt",
    }

    return len(chunks)


# ── Progress Tracking ──────────────────────────────────────────────────

def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    return {"completed": [], "failed": [], "started_at": None}


def save_progress(progress):
    progress["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    PROGRESS_FILE.write_text(
        json.dumps(progress, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# ── Main Pipeline ──────────────────────────────────────────────────────

def get_missing_clips(course_filter=None):
    """Find clips that need transcription."""
    lookup = json.loads(LOOKUP_PATH.read_text(encoding="utf-8"))

    transcribed = set()
    if TRANSCRIPTS_DIR.exists():
        for d in TRANSCRIPTS_DIR.iterdir():
            if d.is_dir():
                transcribed.add(d.name)

    missing = {}
    for key, clip in lookup.items():
        course_code = key.split("/")[0]
        if course_code in transcribed:
            continue
        if course_filter and course_code != course_filter:
            continue

        if course_code not in missing:
            missing[course_code] = []
        missing[course_code].append({
            "key": key,
            "drive_id": clip.get("drive_id", ""),
            "name": clip.get("name", ""),
            "duration": clip.get("duration", 0),
        })

    return missing


def run_pipeline(limit=None, dry_run=False, course_filter=None):
    """Download and transcribe with faster-whisper + parallel downloads."""
    print("=" * 60)
    print("  FASTER-WHISPER TRANSCRIPTION PIPELINE")
    print("  Model: medium.en | Quantization: int8 | ~2.5GB VRAM")
    print("=" * 60)

    missing = get_missing_clips(course_filter)
    total_clips = sum(len(clips) for clips in missing.values())
    total_courses = len(missing)
    total_dur = sum(c["duration"] for clips in missing.values() for c in clips)

    print(f"  Missing courses: {total_courses}")
    print(f"  Total clips:     {total_clips}")
    print(f"  Total duration:  {total_dur//3600}h {(total_dur%3600)//60}m")

    if dry_run:
        print("\n  DRY RUN -- listing what would be transcribed:\n")
        for course, clips in sorted(missing.items()):
            dur = sum(c["duration"] for c in clips)
            print(f"    {course}: {len(clips):3d} clips, ~{dur//60}min")

        est_hours = (total_dur / 14) / 3600  # ~14x realtime for medium.en int8
        print(f"\n  ESTIMATES (faster-whisper medium.en int8 on RTX 3080):")
        print(f"    Processing speed: ~14x real-time")
        print(f"    Estimated time:   ~{est_hours:.1f} hours")
        print(f"    VRAM usage:       ~2.5GB")
        print(f"    Cost:             $0 (local GPU)")
        return

    if total_clips == 0:
        print("  Nothing to transcribe!")
        return

    # Load faster-whisper
    from faster_whisper import WhisperModel

    print("\n  Loading faster-whisper medium.en (int8)...")
    model = WhisperModel(
        "medium.en",
        device="cuda",
        compute_type="int8",       # Half VRAM, 20% faster
        cpu_threads=8,             # Use some Threadripper cores for preprocessing
        num_workers=2,             # Parallel audio decoding
    )
    print("  Model loaded.")

    # Connect to Drive
    print("  Connecting to Google Drive...")
    service = get_drive_service()
    print("  Drive connected.")

    # Load RAG database into memory for live updates
    print("  Loading RAG database...")
    rag_si, rag_ts = _load_rag_db()
    print(f"  RAG loaded: {len(rag_si)} courses, {len(rag_ts)} segments")
    rag_segments_added = 0

    # Setup
    CACHE_DIR.mkdir(exist_ok=True)
    progress = load_progress()
    if not progress["started_at"]:
        progress["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

    completed_set = set(progress["completed"])
    success = 0
    errors = 0
    clip_num = 0
    total_time = 0.0
    total_to_process = min(limit, total_clips) if limit else total_clips

    # Build flat list of all clips to process
    all_clips = []
    for course_code in sorted(missing.keys()):
        for clip in missing[course_code]:
            if clip["key"] not in completed_set:
                clip["course_code"] = course_code
                all_clips.append(clip)

    if limit:
        all_clips = all_clips[:limit]

    # Parallel download: pre-download next video while transcribing current
    download_pool = ThreadPoolExecutor(max_workers=2)
    pending_download: Future | None = None
    pending_clip = None

    def start_download(clip_data):
        """Start a background download, return Future."""
        drive_id = clip_data["drive_id"]
        temp_path = CACHE_DIR / f"{drive_id}.mp4"
        return download_pool.submit(download_video, service, drive_id, temp_path)

    try:
        for idx, clip in enumerate(all_clips):
            clip_num = idx + 1
            clip_key = clip["key"]
            course_code = clip["course_code"]
            drive_id = clip["drive_id"]
            name = clip["name"]

            course_dir = TRANSCRIPTS_DIR / course_code
            course_dir.mkdir(parents=True, exist_ok=True)
            vtt_name = Path(name).stem + ".vtt"
            vtt_path = course_dir / vtt_name

            if vtt_path.exists():
                completed_set.add(clip_key)
                progress["completed"].append(clip_key)
                continue

            temp_path = CACHE_DIR / f"{drive_id}.mp4"

            print(f"\n  [{clip_num}/{len(all_clips)}] {course_code}/{name}")

            try:
                # Download: use pre-fetched if available, otherwise download now
                t0 = time.time()
                if pending_download and pending_clip == clip_key:
                    print(f"    Downloading (pre-fetched)...", end=" ", flush=True)
                    pending_download.result(timeout=300)
                else:
                    print(f"    Downloading...", end=" ", flush=True)
                    download_video(service, drive_id, temp_path)

                dl_time = time.time() - t0
                size_mb = temp_path.stat().st_size / 1e6
                print(f"{size_mb:.0f}MB in {dl_time:.1f}s")

                # Pre-fetch NEXT video while we transcribe this one
                pending_download = None
                pending_clip = None
                if idx + 1 < len(all_clips):
                    next_clip = all_clips[idx + 1]
                    pending_clip = next_clip["key"]
                    pending_download = start_download(next_clip)

                # Transcribe with faster-whisper
                print(f"    Transcribing...", end=" ", flush=True)
                t1 = time.time()
                segments_iter, info = model.transcribe(
                    str(temp_path),
                    language="en",
                    beam_size=5,
                    vad_filter=True,          # Skip silence = faster
                    vad_parameters=dict(
                        min_silence_duration_ms=500,
                    ),
                )
                # Materialize segments (generator)
                segments = list(segments_iter)
                tr_time = time.time() - t1
                total_time += tr_time

                # Save VTT
                vtt_content = segments_to_vtt(segments)
                vtt_path.write_text(vtt_content, encoding="utf-8")

                # Ingest into RAG database immediately
                video_stem = Path(name).stem
                n_rag = ingest_to_rag(course_code, video_stem, segments, rag_si, rag_ts)
                rag_segments_added += n_rag

                success += 1
                completed_set.add(clip_key)
                progress["completed"].append(clip_key)

                avg = total_time / success
                remaining_clips = len(all_clips) - clip_num
                eta_h = (remaining_clips * avg) / 3600
                print(f"{len(segments)} segments in {tr_time:.1f}s  (+{n_rag} RAG)  (ETA: {eta_h:.1f}h)")

            except Exception as e:
                print(f"    ERROR: {e}")
                errors += 1
                progress["failed"].append({"key": clip_key, "error": str(e)})

            finally:
                if temp_path.exists():
                    temp_path.unlink()

            # Checkpoint every 10 clips (progress + RAG)
            if clip_num % 10 == 0:
                save_progress(progress)
                _save_rag_db(rag_si, rag_ts)
                print(f"    [checkpoint] RAG saved: +{rag_segments_added} segments")

    finally:
        download_pool.shutdown(wait=False)
        save_progress(progress)
        _save_rag_db(rag_si, rag_ts)
        print(f"  RAG database updated: +{rag_segments_added} segments")

    # Summary
    print(f"\n{'='*60}")
    print(f"  COMPLETE")
    print(f"  Transcribed: {success}")
    print(f"  Errors:      {errors}")
    print(f"  Total time:  {total_time/3600:.1f}h ({total_time/60:.0f}m)")
    print(f"  Output:      {TRANSCRIPTS_DIR}")
    print(f"  Progress:    {PROGRESS_FILE}")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(
        description="Optimized transcription with faster-whisper for missing courses"
    )
    parser.add_argument("--limit", type=int, help="Max clips to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview + time estimate")
    parser.add_argument("--course", help="Process a specific course code (e.g. 100_11)")
    args = parser.parse_args()

    run_pipeline(
        limit=args.limit,
        dry_run=args.dry_run,
        course_filter=args.course,
    )


if __name__ == "__main__":
    main()
