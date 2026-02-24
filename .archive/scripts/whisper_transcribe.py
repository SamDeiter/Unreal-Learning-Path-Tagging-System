"""Stream videos from Google Drive and transcribe with GPU-accelerated Whisper.
Maximizes RTX 3080 utilization for fast transcription.
"""
import json
import pickle
import time
from pathlib import Path

import torch
import whisper
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# =============================================================================
# CONFIGURATION - MAX PERFORMANCE
# =============================================================================
WHISPER_MODEL = "medium"     # Fast + accurate, ~10x realtime on RTX 3080
MAX_CONCURRENT_DOWNLOADS = 4  # Parallel downloads
CONTENT_DIR = Path("content")
OUTPUT_DIR = CONTENT_DIR / "transcripts"
CACHE_DIR = Path("temp_audio")


def get_drive_service():
    """Load Drive credentials and build service."""
    with open("token.pickle", "rb") as f:
        creds = pickle.load(f)
    return build("drive", "v3", credentials=creds)


def download_video(service, file_id, output_path):
    """Download video from Drive."""
    request = service.files().get_media(fileId=file_id)
    with open(output_path, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    return output_path


def transcribe_video(model, video_path, output_json):
    """Transcribe video and save to JSON."""
    try:
        result = model.transcribe(
            str(video_path),
            language="en",
            fp16=torch.cuda.is_available(),
            verbose=False,
        )

        # Save transcript
        Path(output_json).write_text(json.dumps({
            "text": result["text"],
            "segments": result["segments"],
            "language": result["language"],
        }, indent=2))

        return True, result["text"][:100]
    except Exception as e:
        return False, str(e)


def main():
    print("=" * 60)
    print("WHISPER TRANSCRIPTION PIPELINE")
    print("RTX 3080 + Google Drive Streaming")
    print("=" * 60)

    # Check GPU
    if torch.cuda.is_available():
        print(f"🔥 GPU: {torch.cuda.get_device_name(0)}")
        print(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    else:
        print("⚠️ No GPU - using CPU")

    # Load Whisper
    print(f"\n📥 Loading Whisper '{WHISPER_MODEL}'...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = whisper.load_model(WHISPER_MODEL, device=device)
    print(f"   ✅ Model loaded on {device.upper()}")

    # Load Drive service
    print("\n🔗 Connecting to Google Drive...")
    service = get_drive_service()
    print("   ✅ Connected")

    # Get videos
    videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())

    # Filter: reasonable size, not already transcribed
    OUTPUT_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(exist_ok=True)

    existing = {p.stem for p in OUTPUT_DIR.glob("*.json")}
    to_process = [
        v for v in videos
        if v["id"] not in existing
        and v.get("duration_seconds", 0) > 60  # > 1 min
        and v.get("size_bytes", 0) < 500_000_000  # < 500MB
    ]  # Process ALL remaining videos

    print(f"\n📹 Videos to process: {len(to_process)}")
    print(f"   Already transcribed: {len(existing)}")

    # Process videos
    completed = 0
    failed = 0
    start_time = time.time()

    for i, video in enumerate(to_process, 1):
        video_name = video["name"]
        video_id = video["id"]
        duration = video.get("duration_seconds", 0)

        print(f"\n[{i}/{len(to_process)}] {video_name[:50]}...")
        print(f"   Duration: {duration // 60}m {duration % 60}s")

        # Download
        temp_path = CACHE_DIR / f"{video_id}.mp4"
        try:
            print("   ⬇️ Downloading...", end=" ", flush=True)
            download_video(service, video_id, temp_path)
            print("done")

            # Transcribe
            output_json = OUTPUT_DIR / f"{video_id}.json"
            print("   🎙️ Transcribing...", end=" ", flush=True)
            success, preview = transcribe_video(model, temp_path, output_json)

            if success:
                print("done")
                print(f"   📝 \"{preview}...\"")
                completed += 1
            else:
                print(f"FAILED: {preview}")
                failed += 1

            # Cleanup
            temp_path.unlink(missing_ok=True)

        except Exception as e:
            print(f"   ❌ Error: {e}")
            failed += 1
            temp_path.unlink(missing_ok=True)

    # Summary
    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print("TRANSCRIPTION COMPLETE")
    print("=" * 60)
    print(f"✅ Completed: {completed}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Time: {elapsed / 60:.1f} minutes")
    print(f"📂 Transcripts saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
