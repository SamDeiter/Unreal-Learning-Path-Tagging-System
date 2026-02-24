"""Download videos from a Google Drive folder and transcribe to .txt files for NotebookLLM.

Uses GPU-accelerated Whisper for transcription. Outputs plain-text files
with the video title as the first line, followed by the full transcript.

Usage:
    python scripts/drive_to_txt.py
    python scripts/drive_to_txt.py --folder-id YOUR_FOLDER_ID
    python scripts/drive_to_txt.py --model medium   # whisper model: tiny/base/small/medium/large
"""
import argparse
import json
import pickle
import time
from pathlib import Path

import torch
import whisper
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# =============================================================================
# DEFAULTS
# =============================================================================
DEFAULT_FOLDER_ID = "1kQto-ZYHefU0VtKrxffIBhBg0x7rSsH4"
DEFAULT_MODEL = "medium"
OUTPUT_DIR = Path("transcripts_txt")
CACHE_DIR = Path("temp_audio")
VIDEO_MIMES = {
    "video/mp4", "video/quicktime", "video/x-msvideo",
    "video/x-matroska", "video/webm", "video/mpeg",
}


def get_drive_service():
    """Load and refresh Google Drive credentials, then build the service."""
    token_path = Path("token.pickle")
    if not token_path.exists():
        raise FileNotFoundError(
            "token.pickle not found. Run the Google OAuth flow first."
        )

    with open(token_path, "rb") as f:
        creds = pickle.load(f)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(token_path, "wb") as f:
            pickle.dump(creds, f)

    return build("drive", "v3", credentials=creds)


def list_videos_in_folder(service, folder_id):
    """List all video files in a Google Drive folder (including subfolders)."""
    videos = []
    page_token = None

    while True:
        q = f"'{folder_id}' in parents and trashed = false"
        resp = service.files().list(
            q=q,
            fields="nextPageToken, files(id, name, mimeType, size)",
            pageSize=100,
            pageToken=page_token,
        ).execute()

        for f in resp.get("files", []):
            mime = f.get("mimeType", "")
            if mime in VIDEO_MIMES:
                videos.append(f)
            elif mime == "application/vnd.google-apps.folder":
                videos.extend(list_videos_in_folder(service, f["id"]))

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return videos


def download_video(service, file_id, output_path):
    """Download a video file from Drive."""
    request = service.files().get_media(fileId=file_id)
    with open(output_path, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                print(f"      {pct}%", end="\r", flush=True)
    print("      100%  ")


def transcribe_to_txt(model, video_path, output_txt, video_name):
    """Transcribe video with Whisper and save as .txt for NotebookLLM."""
    result = model.transcribe(
        str(video_path),
        language="en",
        fp16=torch.cuda.is_available(),
        verbose=False,
    )

    lines = [
        f"# {video_name}",
        f"# Transcribed: {time.strftime('%Y-%m-%d %H:%M')}",
        "",
        result["text"].strip(),
        "",
        "---",
        "",
        "## Timestamped Segments",
        "",
    ]

    for seg in result.get("segments", []):
        start = seg["start"]
        mins = int(start // 60)
        secs = int(start % 60)
        text = seg["text"].strip()
        lines.append(f"[{mins:02d}:{secs:02d}] {text}")

    output_txt.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Drive -> Whisper -> .txt for NotebookLLM")
    parser.add_argument("--folder-id", default=DEFAULT_FOLDER_ID, help="Google Drive folder ID")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Whisper model size")
    args = parser.parse_args()

    print("=" * 60)
    print("  GOOGLE DRIVE -> TXT TRANSCRIPTION")
    print("  Output: .txt files for NotebookLLM")
    print("=" * 60)

    # GPU check
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"[GPU] {gpu_name} ({vram:.1f} GB VRAM)")
    else:
        print("[WARN] No GPU detected -- using CPU (will be slower)")

    # Load Whisper
    print(f"\n[LOAD] Loading Whisper '{args.model}'...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = whisper.load_model(args.model, device=device)
    print(f"[OK]   Loaded on {device.upper()}")

    # Connect to Drive
    print("\n[LINK] Connecting to Google Drive...")
    service = get_drive_service()
    print("[OK]   Connected")

    # List videos
    print(f"\n[SCAN] Scanning folder {args.folder_id}...")
    videos = list_videos_in_folder(service, args.folder_id)
    print(f"[OK]   Found {len(videos)} video(s)")

    if not videos:
        print("\n[ERR]  No video files found in that folder.")
        return

    for v in videos:
        size_mb = int(v.get("size", 0)) / 1e6
        print(f"       - {v['name']} ({size_mb:.0f} MB)")

    # Setup dirs
    OUTPUT_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(exist_ok=True)

    # Check for already-done transcripts
    existing = {p.stem for p in OUTPUT_DIR.glob("*.txt")}

    # Process
    completed = 0
    failed = 0
    skipped = 0
    start_time = time.time()

    for i, video in enumerate(videos, 1):
        name = video["name"]
        file_id = video["id"]
        stem = Path(name).stem

        if stem in existing:
            print(f"\n[{i}/{len(videos)}] SKIP {name} (already done)")
            skipped += 1
            continue

        size_mb = int(video.get("size", 0)) / 1e6
        print(f"\n[{i}/{len(videos)}] {name} ({size_mb:.0f} MB)")

        temp_path = CACHE_DIR / f"{file_id}.mp4"

        try:
            print("   [DL]  Downloading...")
            download_video(service, file_id, temp_path)

            print("   [TR]  Transcribing...")
            output_txt = OUTPUT_DIR / f"{stem}.txt"
            transcribe_to_txt(model, temp_path, output_txt, stem)

            print(f"   [OK]  Saved: {output_txt}")
            completed += 1

        except Exception as e:
            print(f"   [ERR] {e}")
            failed += 1

        finally:
            temp_path.unlink(missing_ok=True)

    # Summary
    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print("  DONE!")
    print("=" * 60)
    print(f"  Transcribed: {completed}")
    print(f"  Skipped:     {skipped}")
    print(f"  Failed:      {failed}")
    print(f"  Time:        {elapsed / 60:.1f} minutes")
    print(f"  Output:      {OUTPUT_DIR.resolve()}")
    print(f"\n  Upload the .txt files from '{OUTPUT_DIR}/' to NotebookLLM!")


if __name__ == "__main__":
    main()
