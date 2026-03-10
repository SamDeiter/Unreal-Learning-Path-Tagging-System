"""compare_stt_quality.py -- Side-by-side test: Cloud STT vs Local Whisper large-v3.

Downloads one video clip from Drive, transcribes it via both methods,
and compares speed + output quality.

Usage:
    python scripts/compare_stt_quality.py
"""

import json
import os
import pickle
import subprocess
import time
from datetime import timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LOOKUP_PATH = REPO_ROOT / "path-builder" / "public" / "video_lookup.json"
TRANSCRIPTS_DIR = REPO_ROOT / "content" / "transcripts"
CACHE_DIR = REPO_ROOT / "temp_audio"
TOKEN_FILE = REPO_ROOT / "token.pickle"
OUTPUT_DIR = REPO_ROOT / "content" / "stt_comparison"

GCP_PROJECT = "development-317819"
GCS_BUCKET = "epic-stt-temp-audio"


def get_drive_service():
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    with open(TOKEN_FILE, "rb") as f:
        creds = pickle.load(f)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, "wb") as f:
            pickle.dump(creds, f)
    return build("drive", "v3", credentials=creds)


def download_video(service, file_id, output_path):
    from googleapiclient.http import MediaIoBaseDownload
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    with open(output_path, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()


def extract_audio(video_path, audio_path):
    cmd = [
        "ffmpeg", "-y", "-loglevel", "warning",
        "-i", str(video_path),
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        str(audio_path),
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=600, check=True)


def run_cloud_stt(audio_path):
    """Transcribe via Google Cloud Speech-to-Text."""
    from google.cloud import storage
    from google.cloud import speech_v1p1beta1 as speech

    # Upload to GCS
    gcs_client = storage.Client(project=GCP_PROJECT)
    bucket = gcs_client.bucket(GCS_BUCKET)
    if not bucket.exists():
        bucket = gcs_client.create_bucket(GCS_BUCKET, location="us-central1")
        bucket.add_lifecycle_delete_rule(age=1)
        bucket.patch()

    blob_name = "test_comparison.wav"
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(str(audio_path))
    gcs_uri = f"gs://{GCS_BUCKET}/{blob_name}"

    # UE5 phrase hints
    ue5_terms = [
        "Unreal Engine", "UE5", "UE4", "Nanite", "Lumen", "Niagara",
        "Blueprint", "Blueprints", "C++", "World Partition", "PCG",
        "Sequencer", "Material Editor", "Skeletal Mesh", "Static Mesh",
        "Animation Blueprint", "Control Rig", "LOD", "HLOD",
        "Chaos", "MetaSounds", "Virtual Shadow Maps",
        "Ray Tracing", "Path Tracing", "Global Illumination",
        "Landscape", "Foliage", "Volumetric Clouds",
    ]
    phrase_hints = speech.SpeechContext(phrases=ue5_terms, boost=15.0)

    client = speech.SpeechClient()
    audio = speech.RecognitionAudio(uri=gcs_uri)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="en-US",
        model="latest_long",
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True,
        use_enhanced=True,
        speech_contexts=[phrase_hints],
    )

    t0 = time.time()
    operation = client.long_running_recognize(config=config, audio=audio)
    result = operation.result(timeout=600)
    elapsed = time.time() - t0

    # Extract full text
    full_text = ""
    for res in result.results:
        if res.alternatives:
            full_text += res.alternatives[0].transcript + " "

    # Cleanup GCS
    blob.delete()
    try:
        bucket.delete()
    except Exception:
        pass  # Will auto-delete via lifecycle

    return full_text.strip(), elapsed


def run_local_whisper(audio_path, model_name="large-v3"):
    """Transcribe via local Whisper."""
    import torch
    import whisper

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"    Loading Whisper '{model_name}' on {device.upper()}...")

    t_load = time.time()
    model = whisper.load_model(model_name, device=device)
    load_time = time.time() - t_load
    print(f"    Model loaded in {load_time:.1f}s")

    t0 = time.time()
    result = model.transcribe(
        str(audio_path), language="en",
        fp16=(device == "cuda"), verbose=False
    )
    elapsed = time.time() - t0

    return result["text"].strip(), elapsed


def main():
    print("=" * 70)
    print("  TRANSCRIPTION QUALITY COMPARISON")
    print("  Cloud STT (Google) vs Local Whisper (large-v3)")
    print("=" * 70)

    # Pick one clip from the missing courses
    lookup = json.loads(LOOKUP_PATH.read_text(encoding="utf-8"))
    transcribed = set()
    if TRANSCRIPTS_DIR.exists():
        transcribed = {d.name for d in TRANSCRIPTS_DIR.iterdir() if d.is_dir()}

    # Find first missing clip
    test_clip = None
    for key, clip in lookup.items():
        course = key.split("/")[0]
        if course not in transcribed:
            test_clip = (key, clip)
            break

    if not test_clip:
        print("  No missing clips to test!")
        return

    key, clip = test_clip
    drive_id = clip["drive_id"]
    name = clip["name"]
    print(f"\n  Test clip: {name}")
    print(f"  Drive ID:  {drive_id}")
    print(f"  Key:       {key}")

    # Setup
    CACHE_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    video_path = CACHE_DIR / f"test_{drive_id}.mp4"
    audio_path = CACHE_DIR / f"test_{drive_id}.wav"

    # Download
    print(f"\n  Step 1: Downloading from Drive...")
    t0 = time.time()
    service = get_drive_service()
    download_video(service, drive_id, video_path)
    size_mb = video_path.stat().st_size / 1e6
    print(f"    Downloaded {size_mb:.0f}MB in {time.time()-t0:.1f}s")

    # Extract audio
    print(f"\n  Step 2: Extracting audio...")
    t1 = time.time()
    extract_audio(video_path, audio_path)
    audio_mb = audio_path.stat().st_size / 1e6
    audio_duration = audio_mb / (16000 * 2 / 1e6)  # rough estimate from file size
    print(f"    Audio: {audio_mb:.1f}MB (~{audio_duration/60:.1f}min), took {time.time()-t1:.1f}s")

    # ── Test 1: Cloud STT ───────────────────────────────────────────
    print(f"\n  {'='*60}")
    print(f"  TEST 1: Google Cloud Speech-to-Text")
    print(f"  {'='*60}")
    try:
        cloud_text, cloud_time = run_cloud_stt(audio_path)
        cloud_words = len(cloud_text.split())
        print(f"    Time:  {cloud_time:.1f}s")
        print(f"    Words: {cloud_words}")
        print(f"    First 300 chars:")
        print(f"    {cloud_text[:300]}...")
    except Exception as e:
        cloud_text = f"ERROR: {e}"
        cloud_time = 0
        cloud_words = 0
        print(f"    ERROR: {e}")

    # ── Test 2: Local Whisper large-v3 ──────────────────────────────
    print(f"\n  {'='*60}")
    print(f"  TEST 2: Local Whisper large-v3 (RTX 3080)")
    print(f"  {'='*60}")
    try:
        whisper_text, whisper_time = run_local_whisper(audio_path, "large-v3")
        whisper_words = len(whisper_text.split())
        print(f"    Time:  {whisper_time:.1f}s")
        print(f"    Words: {whisper_words}")
        print(f"    First 300 chars:")
        print(f"    {whisper_text[:300]}...")
    except Exception as e:
        whisper_text = f"ERROR: {e}"
        whisper_time = 0
        whisper_words = 0
        print(f"    ERROR: {e}")

    # ── Summary ─────────────────────────────────────────────────────
    print(f"\n  {'='*60}")
    print(f"  COMPARISON SUMMARY")
    print(f"  {'='*60}")
    print(f"  {'Metric':<25} {'Cloud STT':>15} {'Whisper large-v3':>18}")
    print(f"  {'-'*58}")
    print(f"  {'Transcription time':<25} {cloud_time:>14.1f}s {whisper_time:>17.1f}s")
    print(f"  {'Word count':<25} {cloud_words:>15} {whisper_words:>18}")
    print(f"  {'Cost per clip':<25} {'~$0.006/min':>15} {'$0 (local)':>18}")

    if cloud_time > 0 and whisper_time > 0:
        speed_ratio = whisper_time / cloud_time if cloud_time > 0 else 0
        total_clips = 647
        est_cloud_total = (cloud_time * total_clips) / 3600
        est_whisper_total = (whisper_time * total_clips) / 3600
        print(f"\n  PROJECTED FOR ALL 647 CLIPS:")
        print(f"  {'Cloud STT total time':<25} {est_cloud_total:>14.1f}h")
        print(f"  {'Whisper total time':<25} {est_whisper_total:>14.1f}h")

    # Save output for manual review
    comparison = {
        "clip": name,
        "key": key,
        "cloud_stt": {
            "text": cloud_text,
            "time_seconds": cloud_time,
            "word_count": cloud_words,
        },
        "whisper_large_v3": {
            "text": whisper_text,
            "time_seconds": whisper_time,
            "word_count": whisper_words,
        },
    }
    out_path = OUTPUT_DIR / "comparison_result.json"
    out_path.write_text(json.dumps(comparison, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n  Full output saved to: {out_path}")

    # Cleanup
    video_path.unlink(missing_ok=True)
    audio_path.unlink(missing_ok=True)
    print("  Temp files cleaned up.")


if __name__ == "__main__":
    main()
