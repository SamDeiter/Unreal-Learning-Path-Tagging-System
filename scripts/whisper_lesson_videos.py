"""whisper_lesson_videos.py — Extract and transcribe course lesson videos.

Combined pipeline:
  Phase A: Visit each lesson embed page, capture CMS stream URL (DASH MPD)
  Phase B: Download audio via ffmpeg, transcribe with Whisper (GPU)

Prerequisite: Run extract_lesson_urls.py first to discover lesson URLs.

Usage:
    python scripts/whisper_lesson_videos.py                    # Full run
    python scripts/whisper_lesson_videos.py --limit 5          # Test 5
    python scripts/whisper_lesson_videos.py --phase a          # URLs only
    python scripts/whisper_lesson_videos.py --phase b          # Transcribe only
    python scripts/whisper_lesson_videos.py --model small      # Higher quality
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
LESSON_URLS_PATH = Path("content/epic_learning/lesson_urls.json")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
AUDIO_DIR = Path("temp_audio")
MPD_DIR = Path("temp_mpd")
LESSON_STREAMS_PATH = Path("content/epic_learning/lesson_stream_urls.json")

# Each lesson page has a CMS video embed
EMBED_URL_TEMPLATE = "https://dev.epicgames.com/community/api/cms/videos/{vid}/embed.html"

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")
ANTI_DETECT = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"

# JS to extract video ID from the lesson page
JS_EXTRACT_VIDEO_ID = """
() => {
    // Look for CMS video embeds — they use iframes or video elements 
    // with URLs like /community/api/cms/videos/VIDEO_ID/embed.html
    const iframes = document.querySelectorAll('iframe[src*="cms/videos"]');
    for (const iframe of iframes) {
        const match = iframe.src.match(/cms\\/videos\\/([^/]+)/);
        if (match) return match[1];
    }
    
    // Also check for direct video elements with data attributes
    const videos = document.querySelectorAll('[data-video-id], [data-cms-video]');
    for (const v of videos) {
        const vid = v.getAttribute('data-video-id') || v.getAttribute('data-cms-video');
        if (vid) return vid;
    }
    
    // Check page source for video ID patterns
    const html = document.documentElement.innerHTML;
    const match = html.match(/cms\\/videos\\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    
    return null;
}
"""


# ── Phase A: Discover video IDs from lesson pages ──────────────────────

async def phase_a_discover_videos(lessons_flat, max_videos=None):
    """Visit each lesson page and extract its CMS video ID."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: pip install playwright && python -m playwright install chromium")
        sys.exit(1)

    # Load existing stream URLs (resume support)
    stream_urls = {}
    if LESSON_STREAMS_PATH.exists():
        stream_urls = json.load(open(LESSON_STREAMS_PATH, "r", encoding="utf-8"))

    # Filter out already-captured lessons
    pending = [l for l in lessons_flat if l["lessonHash"] not in stream_urls]
    if max_videos:
        pending = pending[:max_videos]

    print(f"\n  Phase A: Discovering video IDs for {len(pending)} lessons")
    print(f"  Already captured: {len(stream_urls)}")
    print(f"  {'=' * 50}")

    if not pending:
        print("  All lessons already captured!")
        return stream_urls

    captured_mpds = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=USER_AGENT)

        success = 0
        no_video = 0
        errors = 0

        for i, lesson in enumerate(pending):
            lesson_hash = lesson["lessonHash"]
            course_hash = lesson["courseHash"]
            title = lesson.get("title", "")[:50]
            href = lesson.get("href", "")

            # Build full URL
            url = f"https://dev.epicgames.com{href}" if href.startswith("/") else href

            try:
                page = await context.new_page()

                # Intercept network requests to capture MPD manifests
                mpd_data = {}

                async def on_response(response):
                    try:
                        resp_url = response.url
                        if "manifest" in resp_url and response.status == 200:
                            body = await response.text()
                            if "adaptationset" in body.lower() or "mpd" in body.lower():
                                mpd_data["mpd_xml"] = body
                                mpd_data["mpd_url"] = resp_url
                        elif resp_url.endswith(".json") and "cms" in resp_url and response.status == 200:
                            body = await response.text()
                            try:
                                data = json.loads(body)
                                # CMS API returns manifest as base64 in JSON
                                if isinstance(data, dict):
                                    for key in ["dashManifest", "manifest", "dash"]:
                                        if key in data:
                                            decoded = base64.b64decode(data[key]).decode("utf-8")
                                            if "adaptationset" in decoded.lower():
                                                mpd_data["mpd_xml"] = decoded
                                                mpd_data["source"] = "cms_json"
                            except:
                                pass
                    except:
                        pass

                page.on("response", on_response)
                await page.add_init_script(ANTI_DETECT)

                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(6000)

                # Try to extract video ID from the page
                video_id = await page.evaluate(JS_EXTRACT_VIDEO_ID)

                if video_id and not mpd_data:
                    # Visit embed page directly to trigger manifest load
                    embed_url = EMBED_URL_TEMPLATE.format(vid=video_id)
                    embed_page = await context.new_page()
                    embed_page.on("response", on_response)
                    await embed_page.add_init_script(ANTI_DETECT)
                    try:
                        await embed_page.goto(embed_url, wait_until="domcontentloaded", timeout=20000)
                        await embed_page.wait_for_timeout(5000)
                    except:
                        pass
                    await embed_page.close()

                if mpd_data.get("mpd_xml"):
                    stream_urls[lesson_hash] = {
                        "lesson_hash": lesson_hash,
                        "course_hash": course_hash,
                        "title": lesson.get("title", ""),
                        "video_id": video_id,
                        "mpd_xml": mpd_data["mpd_xml"],
                        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    }
                    success += 1
                    print(f"  [{i+1}/{len(pending)}] ✓ {title}")
                elif video_id:
                    stream_urls[lesson_hash] = {
                        "lesson_hash": lesson_hash,
                        "course_hash": course_hash,
                        "title": lesson.get("title", ""),
                        "video_id": video_id,
                        "mpd_xml": None,
                        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    }
                    no_video += 1
                    print(f"  [{i+1}/{len(pending)}] ○ vid={video_id} no MPD  {title}")
                else:
                    no_video += 1
                    print(f"  [{i+1}/{len(pending)}] ○ no video found  {title}")

                await page.close()

            except Exception as e:
                print(f"  [{i+1}/{len(pending)}] ✗ {title} — {e}")
                errors += 1

            # Checkpoint every 50
            if (i + 1) % 50 == 0:
                with open(LESSON_STREAMS_PATH, "w", encoding="utf-8") as f:
                    json.dump(stream_urls, f, indent=2, ensure_ascii=False)
                print(f"  [checkpoint] {success} ok, {no_video} no-video, {errors} errors")

            await asyncio.sleep(2)  # Polite delay

        await browser.close()

    # Final save
    with open(LESSON_STREAMS_PATH, "w", encoding="utf-8") as f:
        json.dump(stream_urls, f, indent=2, ensure_ascii=False)

    print(f"\n  {'=' * 50}")
    print(f"  Captured: {success}")
    print(f"  No video: {no_video}")
    print(f"  Errors:   {errors}")

    return stream_urls


# ── Phase B: Download audio + Whisper transcribe ──────────────────────

def download_audio_from_mpd(mpd_xml, vid, output_path):
    """Write MPD XML to temp file, use ffmpeg to extract audio."""
    MPD_DIR.mkdir(exist_ok=True)
    mpd_path = MPD_DIR / f"{vid}.mpd"
    with open(mpd_path, "w", encoding="utf-8") as f:
        f.write(mpd_xml)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(mpd_path),
        "-vn",                # no video
        "-acodec", "pcm_s16le",
        "-ar", "16000",       # 16kHz for Whisper
        "-ac", "1",           # mono
        str(output_path),
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            return False, result.stderr[:200]
        return True, None
    except subprocess.TimeoutExpired:
        return False, "ffmpeg timeout"
    except FileNotFoundError:
        return False, "ffmpeg not found — install from https://ffmpeg.org"
    finally:
        if mpd_path.exists():
            mpd_path.unlink()


def run_phase_b(stream_urls, max_videos=None, model_name="base"):
    """Download audio and transcribe with Whisper."""
    AUDIO_DIR.mkdir(exist_ok=True)
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)

    # Filter to lessons with MPD XML and no existing transcript
    to_process = []
    for lesson_hash, info in stream_urls.items():
        if not info.get("mpd_xml"):
            continue
        transcript_path = TRANSCRIPT_DIR / f"lesson_{lesson_hash}.txt"
        if transcript_path.exists():
            continue
        to_process.append((lesson_hash, info))

    if max_videos:
        to_process = to_process[:max_videos]

    if not to_process:
        print("  All lessons already transcribed!")
        return

    print(f"\n  Phase B: Transcribing {len(to_process)} lessons with Whisper ({model_name})")
    print(f"  {'=' * 50}")

    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Loading Whisper model '{model_name}' on {device.upper()}...")
    import whisper
    model = whisper.load_model(model_name, device=device)

    if device == "cuda":
        gpu_name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_mem / (1024**3)
        print(f"  GPU: {gpu_name} ({vram:.1f} GB VRAM)")

    success = 0
    errors = 0
    total_time = 0

    for i, (lesson_hash, info) in enumerate(to_process, 1):
        title = info.get("title", "")[:50]
        audio_path = AUDIO_DIR / f"lesson_{lesson_hash}.wav"
        transcript_path = TRANSCRIPT_DIR / f"lesson_{lesson_hash}.txt"

        # Download audio
        print(f"  [{i}/{len(to_process)}] ⬇ downloading  {title}")
        ok, err = download_audio_from_mpd(info["mpd_xml"], lesson_hash, audio_path)
        if not ok:
            print(f"  [{i}/{len(to_process)}] ✗ download failed: {err}")
            errors += 1
            continue

        audio_mb = audio_path.stat().st_size / (1024 * 1024)
        print(f"  [{i}/{len(to_process)}] 🎙 transcribing ({audio_mb:.1f}MB)  {title}")

        try:
            t0 = time.time()
            result = model.transcribe(str(audio_path), language="en")
            elapsed = time.time() - t0
            total_time += elapsed
            text = result["text"].strip()

            if len(text) > 20:
                with open(transcript_path, "w", encoding="utf-8") as f:
                    f.write(text)
                success += 1
                size_kb = transcript_path.stat().st_size / 1024
                avg_speed = total_time / success
                remaining = (len(to_process) - i) * avg_speed
                eta = time.strftime("%H:%M", time.localtime(time.time() + remaining))
                print(f"  [{i}/{len(to_process)}] ✓ {size_kb:.1f}KB in {elapsed:.1f}s  ETA:{eta}  {title}")
            else:
                print(f"  [{i}/{len(to_process)}] ○ too short ({len(text)} chars)  {title}")
                # Save as marker to avoid re-processing
                with open(transcript_path, "w", encoding="utf-8") as f:
                    f.write(f"[NO_DIALOG_SHORT_CLIP] {text}")
                errors += 1

        except Exception as e:
            print(f"  [{i}/{len(to_process)}] ✗ whisper error: {e}")
            errors += 1

        # Cleanup audio file
        if audio_path.exists():
            audio_path.unlink()

    print(f"\n  {'=' * 50}")
    print(f"  Transcribed: {success}")
    print(f"  Errors:      {errors}")
    print(f"  Total time:  {total_time/60:.1f} min")
    print(f"  Output:      {TRANSCRIPT_DIR}")


# ── Main ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Extract and transcribe course lesson videos")
    parser.add_argument("--phase", choices=["a", "b", "ab"], default="ab",
                        help="Which phase to run (default: both)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max videos to process")
    parser.add_argument("--model", default="base",
                        help="Whisper model: tiny, base, small, medium, large-v3")
    args = parser.parse_args()

    # Load lesson URLs
    if not LESSON_URLS_PATH.exists():
        print(f"ERROR: {LESSON_URLS_PATH} not found.")
        print("Run extract_lesson_urls.py first!")
        sys.exit(1)

    lesson_data = json.load(open(LESSON_URLS_PATH, "r", encoding="utf-8"))

    # Flatten all lessons across all courses
    lessons_flat = []
    for course_hash, lessons in lesson_data.items():
        for l in lessons:
            l["courseHash"] = course_hash  # ensure courseHash is set
            lessons_flat.append(l)

    print("=" * 60)
    print(f" Lesson Video Pipeline")
    print(f" {len(lesson_data)} courses, {len(lessons_flat)} total lessons")
    print(f" Whisper model: {args.model}")
    print("=" * 60)

    stream_urls = {}

    if args.phase in ("a", "ab"):
        stream_urls = asyncio.run(phase_a_discover_videos(lessons_flat, args.limit))

    if args.phase in ("b", "ab"):
        if not stream_urls:
            if LESSON_STREAMS_PATH.exists():
                stream_urls = json.load(open(LESSON_STREAMS_PATH, "r", encoding="utf-8"))
            else:
                print("ERROR: No stream URLs found. Run phase A first.")
                sys.exit(1)
        run_phase_b(stream_urls, args.limit, args.model)


if __name__ == "__main__":
    start = time.time()
    main()
    elapsed = time.time() - start
    hrs = int(elapsed // 3600)
    mins = int((elapsed % 3600) // 60)
    print(f"\nTotal time: {hrs}h {mins}m")
