"""whisper_cms_transcripts_v2.py — Enhanced multi-video pipeline.

Strategy: Visit each video's embed page directly (not the article page)
to reliably trigger the DASH manifest load. This avoids iframe lazy-load
issues and captures one manifest per video with certainty.

Two phases:
  A) For each priority video, Playwright opens its embed URL directly,
     intercepts the CDN manifest JSON, decodes base64 MPD
  B) ffmpeg reads each MPD to download audio, Whisper transcribes

Usage:
  python scripts/whisper_cms_transcripts_v2.py                # Full run
  python scripts/whisper_cms_transcripts_v2.py --max-videos 5 # Test subset
  python scripts/whisper_cms_transcripts_v2.py --phase a      # URLs only
  python scripts/whisper_cms_transcripts_v2.py --phase b      # Transcribe
  python scripts/whisper_cms_transcripts_v2.py --model base   # Whisper model
"""

import argparse
import asyncio
import base64
import json
import os
import re
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
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
AUDIO_DIR = Path("temp_audio")
MPD_DIR = Path("temp_mpd")
STREAM_URLS_V2_PATH = Path("content/epic_learning/cms_stream_urls_v2.json")

# Embed URL template — each video has its own direct embed page
EMBED_URL_TEMPLATE = "https://dev.epicgames.com/community/api/cms/videos/{vid}/embed.html"

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")
ANTI_DETECT = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"


# ── Phase A: Direct embed page capture ─────────────────────────────────

async def extract_stream_urls_v2(max_videos=None):
    """Visit each video's embed page directly to capture its CDN manifest."""
    from playwright.async_api import async_playwright

    priority = json.load(open(PRIORITY_PATH))["videos"]

    # Load existing captures
    existing_urls = {}
    if STREAM_URLS_V2_PATH.exists():
        existing_urls = json.load(open(STREAM_URLS_V2_PATH))

    # Filter to videos that still need capture
    to_capture = []
    for v in priority:
        vid = v["id"]
        if vid in existing_urls and existing_urls[vid].get("mpd_xml"):
            continue
        to_capture.append(v)

    if max_videos:
        to_capture = to_capture[:max_videos]

    if not to_capture:
        print("  All stream URLs already extracted!")
        return existing_urls

    total = len(to_capture)
    print(f"\n  Phase A: Capturing DASH manifests for {total} videos (direct embed)")
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

        success = 0
        errors = 0
        page = await context.new_page()

        for i, v in enumerate(to_capture, 1):
            vid = v["id"]
            title = v["article_title"][:55]
            embed_url = EMBED_URL_TEMPLATE.format(vid=vid)

            mpd_xml = None

            async def on_response(response):
                nonlocal mpd_xml
                resp_url = response.url
                try:
                    if "cdn.qstv.on.epicgames.com" in resp_url and response.status == 200:
                        ct = response.headers.get("content-type", "")
                        if "json" in ct:
                            body = await response.text()
                            data = json.loads(body)
                            playlist_b64 = data.get("playlist", "")
                            playlist_type = data.get("playlistType", "")
                            if playlist_b64 and "dash" in playlist_type:
                                mpd_xml = base64.b64decode(playlist_b64).decode("utf-8")
                except Exception:
                    pass

            page.on("response", on_response)

            try:
                await page.goto(embed_url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(3000)

                # If no manifest yet, try clicking the play button
                if not mpd_xml:
                    try:
                        play_btn = await page.query_selector(".vjs-big-play-button")
                        if play_btn:
                            await play_btn.click()
                            await page.wait_for_timeout(4000)
                    except Exception:
                        pass

                # If still no manifest, wait a bit more
                if not mpd_xml:
                    await page.wait_for_timeout(3000)

            except Exception as e:
                print(f"  [{i}/{total}] ✗ {vid}: {e}")
                errors += 1
                page.remove_listener("response", on_response)
                continue

            page.remove_listener("response", on_response)

            if mpd_xml:
                existing_urls[vid] = {
                    "mpd_xml": mpd_xml,
                    "article_title": v["article_title"],
                }
                success += 1
                print(f"  [{i}/{total}] ✓ {vid}  {title}")
            else:
                print(f"  [{i}/{total}] ○ no manifest  {vid}  {title}")
                errors += 1

            # Checkpoint every 10 videos
            if i % 10 == 0:
                with open(STREAM_URLS_V2_PATH, "w", encoding="utf-8") as f:
                    json.dump(existing_urls, f, indent=2, ensure_ascii=False)
                print(f"    ... checkpoint: {success} captured so far")

            # Small delay between videos
            await asyncio.sleep(0.5)

        await page.close()
        await context.close()
        await browser.close()

    # Final save
    with open(STREAM_URLS_V2_PATH, "w", encoding="utf-8") as f:
        json.dump(existing_urls, f, indent=2, ensure_ascii=False)

    total_with_mpd = sum(1 for v in existing_urls.values() if v.get("mpd_xml"))
    print(f"\n  {'='*50}")
    print(f"  Captured: {success}/{total}")
    print(f"  Errors:   {errors}")
    print(f"  Total with MPD: {total_with_mpd}")
    print(f"  Output: {STREAM_URLS_V2_PATH}")

    return existing_urls


# ── Phase B: Download audio + Whisper transcribe ───────────────────────

def download_audio_from_mpd(mpd_xml, vid, output_path):
    """Write MPD XML to temp file, use ffmpeg to extract audio."""
    MPD_DIR.mkdir(exist_ok=True)
    mpd_path = MPD_DIR / f"{vid}.mpd"

    with open(mpd_path, "w", encoding="utf-8") as f:
        f.write(mpd_xml)

    cmd = [
        "ffmpeg", "-y",
        "-loglevel", "warning",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto,data",
        "-i", str(mpd_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)

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

    to_process = []
    for v in priority:
        vid = v["id"]
        if vid not in stream_urls:
            continue
        if not stream_urls[vid].get("mpd_xml"):
            continue
        transcript_path = TRANSCRIPT_DIR / f"whisper_{vid}.txt"
        if transcript_path.exists():
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

    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Loading Whisper model '{model_name}' on {device.upper()}...")
    import whisper
    model = whisper.load_model(model_name, device=device)

    success = 0
    errors = 0

    for i, (vid, info, urls) in enumerate(to_process, 1):
        title = info.get("article_title", "")[:50]
        audio_path = AUDIO_DIR / f"{vid}.wav"
        transcript_path = TRANSCRIPT_DIR / f"whisper_{vid}.txt"

        print(f"  [{i}/{total}] ⬇ downloading  {title}")
        ok, err = download_audio_from_mpd(urls["mpd_xml"], vid, audio_path)
        if not ok:
            print(f"  [{i}/{total}] ✗ download failed: {err}")
            errors += 1
            continue

        audio_mb = audio_path.stat().st_size / (1024 * 1024)
        print(f"  [{i}/{total}] 🎙 transcribing ({audio_mb:.1f}MB)  {title}")

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

        if audio_path.exists():
            audio_path.unlink()

    print(f"\n  {'='*50}")
    print(f"  Transcribed: {success}")
    print(f"  Errors:      {errors}")
    print(f"  Output:      {TRANSCRIPT_DIR}")


# ── Main ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Whisper CMS multi-video transcription v2")
    parser.add_argument("--max-videos", type=int, help="Limit videos to process")
    parser.add_argument("--phase", choices=["a", "b", "both"], default="both",
                        help="Run phase A (URLs), B (transcribe), or both")
    parser.add_argument("--model", default="base",
                        help="Whisper model (tiny/base/small/medium/large)")
    args = parser.parse_args()

    start = time.time()

    stream_urls = {}
    if args.phase in ("a", "both"):
        stream_urls = asyncio.run(extract_stream_urls_v2(
            max_videos=args.max_videos))
    elif STREAM_URLS_V2_PATH.exists():
        stream_urls = json.load(open(STREAM_URLS_V2_PATH))

    if args.phase in ("b", "both"):
        run_phase_b(stream_urls, max_videos=args.max_videos,
                    model_name=args.model)

    elapsed = time.time() - start
    print(f"\nTotal time: {elapsed:.1f}s ({elapsed/60:.1f}m)")


if __name__ == "__main__":
    main()
