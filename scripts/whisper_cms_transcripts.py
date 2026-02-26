"""whisper_cms_transcripts.py — Phase 4b: Audio download + Whisper transcription
for CMS videos that lack VTT subtitles.

Two phases:
  A) Playwright visits article pages, intercepts CDN manifest JSON,
     decodes base64 MPD XML
  B) ffmpeg reads MPD to download audio, Whisper transcribes

Usage:
  python scripts/whisper_cms_transcripts.py                # Full run
  python scripts/whisper_cms_transcripts.py --max-videos 3 # Test subset
  python scripts/whisper_cms_transcripts.py --phase a      # URL extraction only
  python scripts/whisper_cms_transcripts.py --phase b      # Transcribe only
  python scripts/whisper_cms_transcripts.py --model base   # Whisper model
"""

import argparse
import asyncio
import base64
import json
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

# ── Config ──────────────────────────────────────────────────────────────
PRIORITY_PATH = Path("content/epic_learning/whisper_priority.json")
MANIFEST_PATH = Path("content/epic_learning/video_manifest.json")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
AUDIO_DIR = Path("temp_audio")
MPD_DIR = Path("temp_mpd")
STREAM_URLS_PATH = Path("content/epic_learning/cms_stream_urls.json")

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")
ANTI_DETECT = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"


# ── Phase A: Extract stream URLs via Playwright ────────────────────────

async def extract_stream_urls(max_videos=None):
    """Visit article pages and intercept CDN manifest JSON with base64 MPD."""
    from playwright.async_api import async_playwright

    priority = json.load(open(PRIORITY_PATH))["videos"]
    if max_videos:
        priority = priority[:max_videos]

    # Load existing stream URLs
    existing_urls = {}
    if STREAM_URLS_PATH.exists():
        existing_urls = json.load(open(STREAM_URLS_PATH))

    # Group by article URL (visit each page once)
    by_url = {}
    for v in priority:
        url = v["article_url"]
        vid = v["id"]
        if vid in existing_urls:
            continue
        if url not in by_url:
            by_url[url] = {"title": v["article_title"], "video_ids": []}
        by_url[url]["video_ids"].append(vid)

    if not by_url:
        print("  All stream URLs already extracted!")
        return existing_urls

    total = len(by_url)
    print(f"\n  Phase A: Extracting stream URLs from {total} pages")
    print(f"  {'='*50}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 720},
        )
        await context.add_init_script(ANTI_DETECT)

        for i, (url, info) in enumerate(by_url.items(), 1):
            title_short = info["title"][:50]
            captured = {}

            page = await context.new_page()

            async def on_response(response):
                resp_url = response.url
                try:
                    # Capture the QSTV CDN manifest (JSON with base64 MPD)
                    if "cdn.qstv.on.epicgames.com" in resp_url and response.status == 200:
                        ct = response.headers.get("content-type", "")
                        if "json" in ct:
                            body = await response.text()
                            data = json.loads(body)
                            # Extract base64-encoded MPD playlist
                            playlist_b64 = data.get("playlist", "")
                            playlist_type = data.get("playlistType", "")
                            if playlist_b64 and "dash" in playlist_type:
                                mpd_xml = base64.b64decode(playlist_b64).decode("utf-8")
                                captured["mpd_xml"] = mpd_xml
                                captured["manifest_url"] = resp_url
                except Exception:
                    pass

            page.on("response", on_response)

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(8000)
            except Exception as e:
                print(f"  [{i}/{total}] ✗ ERROR  {title_short}: {e}")
                page.remove_listener("response", on_response)
                await page.close()
                continue

            page.remove_listener("response", on_response)
            await page.close()

            if captured.get("mpd_xml"):
                for vid in info["video_ids"]:
                    existing_urls[vid] = {
                        "mpd_xml": captured["mpd_xml"],
                        "article_title": info["title"],
                    }
                print(f"  [{i}/{total}] ✓ captured  {title_short}")
            else:
                print(f"  [{i}/{total}] ○ no stream  {title_short}")

            await asyncio.sleep(1)

        await context.close()
        await browser.close()

    # Save stream URLs
    with open(STREAM_URLS_PATH, "w", encoding="utf-8") as f:
        json.dump(existing_urls, f, indent=2, ensure_ascii=False)
    print(f"\n  Stream URLs saved: {len(existing_urls)} → {STREAM_URLS_PATH}")

    return existing_urls


# ── Phase B: Download audio + Whisper transcribe ───────────────────────

def download_audio_from_mpd(mpd_xml, vid, output_path):
    """Write MPD XML to temp file, use ffmpeg to extract audio."""
    MPD_DIR.mkdir(exist_ok=True)
    mpd_path = MPD_DIR / f"{vid}.mpd"

    # Write MPD to temp file
    with open(mpd_path, "w", encoding="utf-8") as f:
        f.write(mpd_xml)

    cmd = [
        "ffmpeg", "-y",
        "-loglevel", "warning",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto,data",
        "-i", str(mpd_path),
        "-vn",                    # no video
        "-acodec", "pcm_s16le",   # WAV for Whisper
        "-ar", "16000",           # 16kHz sample rate
        "-ac", "1",               # mono
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    # Cleanup MPD
    if mpd_path.exists():
        mpd_path.unlink()

    if result.returncode != 0:
        return False, result.stderr[:200]
    return True, ""


def run_phase_b(stream_urls, max_videos=None, model_name="base"):
    """Download audio and transcribe for all videos with stream URLs."""
    AUDIO_DIR.mkdir(exist_ok=True)
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)

    priority = json.load(open(PRIORITY_PATH))["videos"]

    # Filter to videos that have stream URLs but no transcript
    to_process = []
    for v in priority:
        vid = v["id"]
        if vid not in stream_urls:
            continue
        if not stream_urls[vid].get("mpd_xml"):
            continue
        # Check if transcript already exists
        existing = any(vid in t.stem for t in TRANSCRIPT_DIR.glob("*.txt"))
        if existing:
            continue
        to_process.append((vid, v, stream_urls[vid]))

    if max_videos:
        to_process = to_process[:max_videos]

    if not to_process:
        print("  All videos already transcribed!")
        return

    total = len(to_process)
    print(f"\n  Phase B: Transcribing {total} videos with Whisper ({model_name})")
    print(f"  {'='*50}")

    # Load Whisper model once
    print(f"  Loading Whisper model '{model_name}'...")
    import whisper
    model = whisper.load_model(model_name)

    success = 0
    errors = 0

    for i, (vid, info, urls) in enumerate(to_process, 1):
        title = info.get("article_title", "")[:50]
        audio_path = AUDIO_DIR / f"{vid}.wav"
        transcript_path = TRANSCRIPT_DIR / f"whisper_{vid}.txt"

        # Step 1: Download audio from MPD
        print(f"  [{i}/{total}] ⬇ downloading  {title}")
        ok, err = download_audio_from_mpd(urls["mpd_xml"], vid, audio_path)
        if not ok:
            print(f"  [{i}/{total}] ✗ download failed: {err}")
            errors += 1
            continue

        audio_mb = audio_path.stat().st_size / (1024 * 1024)
        print(f"  [{i}/{total}] 🎙 transcribing ({audio_mb:.1f}MB)  {title}")

        # Step 2: Transcribe
        try:
            result = model.transcribe(str(audio_path), language="en")
            text = result["text"].strip()

            if len(text) > 20:
                with open(transcript_path, "w", encoding="utf-8") as f:
                    f.write(text)
                success += 1
                size_kb = transcript_path.stat().st_size / 1024
                print(f"  [{i}/{total}] ✓ {size_kb:.1f}KB  {title}")
            else:
                print(f"  [{i}/{total}] ○ too short ({len(text)} chars)  {title}")
                errors += 1
        except Exception as e:
            print(f"  [{i}/{total}] ✗ whisper error: {e}")
            errors += 1

        # Cleanup audio
        if audio_path.exists():
            audio_path.unlink()

    print(f"\n  {'='*50}")
    print(f"  Transcribed: {success}")
    print(f"  Errors:      {errors}")
    print(f"  Output:      {TRANSCRIPT_DIR}")


# ── Main ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Whisper CMS video transcription")
    parser.add_argument("--max-videos", type=int, help="Limit videos to process")
    parser.add_argument("--phase", choices=["a", "b", "both"], default="both",
                        help="Run phase A (URLs), B (transcribe), or both")
    parser.add_argument("--model", default="base",
                        help="Whisper model (tiny/base/small/medium/large)")
    args = parser.parse_args()

    start = time.time()

    stream_urls = {}
    if args.phase in ("a", "both"):
        stream_urls = asyncio.run(extract_stream_urls(
            max_videos=args.max_videos))
    elif STREAM_URLS_PATH.exists():
        stream_urls = json.load(open(STREAM_URLS_PATH))

    if args.phase in ("b", "both"):
        run_phase_b(stream_urls, max_videos=args.max_videos,
                    model_name=args.model)

    print(f"\nTotal time: {time.time() - start:.1f}s")


if __name__ == "__main__":
    main()
