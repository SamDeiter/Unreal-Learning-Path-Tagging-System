"""fetch_epic_transcripts.py — Phase 2c: Video Transcript Extraction

Two-pass approach:
  Pass 1: yt-dlp downloads auto-generated subtitles (fast, no video download)
  Pass 2: For videos without subs, download audio → local Whisper transcription

Usage:
  pip install yt-dlp openai-whisper
  python scripts/fetch_epic_transcripts.py              # Both passes
  python scripts/fetch_epic_transcripts.py --subs-only  # Skip Whisper
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────
EXTRACTED_DIR = Path("content/epic_learning/extracted")
MANIFEST_PATH = Path("content/epic_learning/video_manifest.json")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
AUDIO_DIR = Path("content/epic_learning/_audio_tmp")
BATCH_DELAY = 1.0
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large


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


def find_youtube_from_manifest():
    """Load YouTube video IDs from discover_epic_videos.py manifest."""
    if not MANIFEST_PATH.exists():
        print(f"  ERROR: Manifest not found at {MANIFEST_PATH}")
        print("  Run: python scripts/discover_epic_videos.py")
        return []

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    videos = []
    for yt in manifest.get("youtube_videos", []):
        videos.append({
            "hash_id": yt.get("article_hash", ""),
            "title": yt.get("article_title", "Unknown"),
            "youtube_id": yt["id"],
        })
    return videos


# ── Pass 1: Subtitle Download ──────────────────────────────────────────
def download_subtitle(youtube_id, output_path):
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
        subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        vtt_files = list(output_path.parent.glob(f"{output_path.stem}*.vtt"))
        if vtt_files:
            vtt_path = vtt_files[0]
            text = vtt_to_text(vtt_path)
            txt_path = output_path.with_suffix(".txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(text)
            vtt_path.unlink()
            return txt_path, len(text.split())
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

    content = re.sub(r"^WEBVTT.*?\n\n", "", content, flags=re.DOTALL)
    content = re.sub(r"\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*?\n", "", content)
    content = re.sub(r"<[^>]+>", "", content)

    seen = set()
    lines = []
    for line in content.split("\n"):
        line = line.strip()
        if line and line not in seen and not re.match(r"^\d+$", line):
            seen.add(line)
            lines.append(line)
    return " ".join(lines)


# ── Pass 2: Whisper Transcription ───────────────────────────────────────
def download_audio(youtube_id, audio_path):
    """Download audio-only via yt-dlp for Whisper transcription."""
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    cmd = [
        "yt-dlp",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "5",  # Lower quality = smaller file, Whisper doesn't need HQ
        "--output", str(audio_path),
        url,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        # yt-dlp may add extension, check for the file
        if audio_path.exists():
            return audio_path
        # Check for auto-added extension
        mp3_path = audio_path.with_suffix(".mp3")
        if mp3_path.exists():
            return mp3_path
        return None
    except subprocess.TimeoutExpired:
        return None
    except FileNotFoundError:
        return None


def whisper_transcribe(audio_path, output_txt_path):
    """Transcribe audio using local Whisper model."""
    try:
        import whisper
    except ImportError:
        print("  ERROR: openai-whisper not installed. Run: pip install openai-whisper")
        return None, 0

    model = whisper.load_model(WHISPER_MODEL)
    result = model.transcribe(str(audio_path), language="en")
    text = result.get("text", "").strip()

    if text:
        with open(output_txt_path, "w", encoding="utf-8") as f:
            f.write(text)
        return output_txt_path, len(text.split())
    return None, 0


def cleanup_audio(audio_path):
    """Delete intermediate audio file after transcription."""
    try:
        if audio_path and audio_path.exists():
            audio_path.unlink()
    except Exception:
        pass


# ── Main ────────────────────────────────────────────────────────────────
def main():
    global WHISPER_MODEL

    parser = argparse.ArgumentParser(description="Fetch transcripts for Epic Learning videos")
    parser.add_argument("--subs-only", action="store_true", help="Only download subtitles, skip Whisper")
    parser.add_argument("--from-manifest", action="store_true",
                        help="Read YouTube IDs from video_manifest.json (from discover_epic_videos.py)")
    parser.add_argument("--whisper-model", default=WHISPER_MODEL,
                        help="Whisper model size: tiny, base, small, medium, large (default: base)")
    args = parser.parse_args()

    WHISPER_MODEL = args.whisper_model

    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)

    # Find all YouTube references
    if args.from_manifest:
        print("Loading YouTube videos from manifest...")
        videos = find_youtube_from_manifest()
    else:
        print("Scanning extracted metadata for YouTube videos...")
        videos = find_youtube_videos()
    print(f"  Found {len(videos)} YouTube video references")

    if not videos:
        print("  No YouTube videos to process.")
        return

    # Filter already-downloaded
    pending = []
    for vid in videos:
        txt_path = TRANSCRIPT_DIR / f"{vid['youtube_id']}.txt"
        if not txt_path.exists():
            pending.append(vid)

    cached = len(videos) - len(pending)
    print(f"  {len(pending)} to download ({cached} already cached)")

    if not pending:
        print("  All transcripts already downloaded!")
        return

    # ── Pass 1: Subtitle download ──
    print(f"\n{'='*60}")
    print(f" Pass 1: Downloading subtitles ({len(pending)} videos)")
    print(f"{'='*60}")

    sub_success = 0
    no_subs = []

    for i, vid in enumerate(pending):
        yt_id = vid["youtube_id"]
        title = vid["title"][:40]
        output_path = TRANSCRIPT_DIR / yt_id

        txt_path, word_count = download_subtitle(yt_id, output_path)
        if txt_path:
            sub_success += 1
            print(f"  [{i+1}/{len(pending)}] ✓ {title}... ({word_count} words)")
        else:
            no_subs.append(vid)
            print(f"  [{i+1}/{len(pending)}] ○ {title}... (no subs — queued for Whisper)")

        time.sleep(BATCH_DELAY)

    print(f"\n  Pass 1 results: {sub_success} subtitles downloaded, {len(no_subs)} need Whisper")

    # ── Pass 2: Whisper transcription ──
    if no_subs and not args.subs_only:
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)

        print(f"\n{'='*60}")
        print(f" Pass 2: Whisper transcription ({len(no_subs)} videos, model={WHISPER_MODEL})")
        print(f"{'='*60}")

        whisper_success = 0
        whisper_failed = 0

        for i, vid in enumerate(no_subs):
            yt_id = vid["youtube_id"]
            title = vid["title"][:40]
            audio_path = AUDIO_DIR / f"{yt_id}.mp3"
            txt_path = TRANSCRIPT_DIR / f"{yt_id}.txt"

            print(f"  [{i+1}/{len(no_subs)}] Downloading audio for {title}...")
            downloaded = download_audio(yt_id, audio_path)

            if downloaded:
                print(f"    Transcribing with Whisper ({WHISPER_MODEL})...")
                result_path, word_count = whisper_transcribe(downloaded, txt_path)
                cleanup_audio(downloaded)

                if result_path:
                    whisper_success += 1
                    print(f"    ✓ {word_count} words transcribed")
                else:
                    whisper_failed += 1
                    print(f"    ✗ Whisper returned empty result")
            else:
                whisper_failed += 1
                print(f"    ✗ Audio download failed")

        # Clean up audio temp dir
        if AUDIO_DIR.exists() and not any(AUDIO_DIR.iterdir()):
            AUDIO_DIR.rmdir()

        print(f"\n  Pass 2 results: {whisper_success} transcribed, {whisper_failed} failed")
    elif no_subs:
        print(f"\n  Skipping Whisper pass (--subs-only). {len(no_subs)} videos without transcripts.")

    # Summary
    total_transcripts = len(list(TRANSCRIPT_DIR.glob("*.txt")))
    print(f"\n{'='*60}")
    print(f"  Total transcripts: {total_transcripts}")
    print(f"  → Output: {TRANSCRIPT_DIR}")
    print(f"{'='*60}")


if __name__ == "__main__":
    start = time.time()
    main()
    print(f"\nTotal time: {time.time() - start:.1f}s")
