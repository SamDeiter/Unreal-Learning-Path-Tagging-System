"""
Summarize Transcript Segments using Gemini API.

Uses the google-genai Python SDK (same pattern as UE5QuestionGenerator).
Reads transcript_segments.json, sends video segments in BATCHES to Gemini,
and writes back a 'summary' field for each segment.

Phase 8B: Batches 4 videos per Gemini call to reduce API usage.

Usage:
  pip install google-genai
  set GOOGLE_API_KEY=your_key   (or GEMINI_API_KEY)
  python scripts/summarize_segments.py
  python scripts/summarize_segments.py --dry-run
"""

import os
import re
import json
import time
import argparse
from pathlib import Path

try:
    from google import genai
except ImportError:
    print("ERROR: google-genai package not installed")
    print("Install with: pip install google-genai")
    exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
SEGMENTS_FILE = REPO_ROOT / "path-builder" / "src" / "data" / "transcript_segments.json"

# API key: check both env var names
API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

# Rate limiting
REQUESTS_PER_MINUTE = 14  # stay under 15 RPM free-tier limit
DELAY_BETWEEN_REQUESTS = 60.0 / REQUESTS_PER_MINUTE

# Phase 8B: Batch size — number of videos per Gemini call
BATCH_SIZE = 4


def summarize_video_batch(client, batch):
    """
    Send multiple videos' segments in one Gemini call.

    Args:
        client: Gemini client
        batch: dict of {video_key: segments_list}

    Returns:
        dict of {video_key: [summary1, summary2, ...]} or None on error
    """
    all_sections = []
    for video_key, segments in batch.items():
        seg_list = []
        for i, seg in enumerate(segments):
            text_preview = seg["text"][:300]
            seg_list.append(f"  {i+1}. [{seg['start']}] {text_preview}")
        section = f"=== VIDEO: {video_key} ({len(segments)} segments) ===\n" + "\n".join(seg_list)
        all_sections.append(section)

    videos_text = "\n\n".join(all_sections)
    video_keys = list(batch.keys())

    prompt = f"""You are summarizing video tutorial segments for learners studying Unreal Engine 5.
For each video below, write ONE short sentence (8-15 words max) per segment describing what the learner will learn.

Rules:
- Write from the learner's perspective
- Use action verbs: "Learn", "Set up", "Configure", "Understand", "Explore", "Adjust", "Create", "Apply"
- Be specific about UE5 concepts (e.g., "Configure Lumen reflection quality settings" not "Learn about settings")
- Do NOT mention the video title
- Do NOT use filler words
- Keep each summary under 15 words

Return a JSON object where each key is the video name and the value is an array of summary strings.

Videos:
{videos_text}

Return format: {{"video_name": ["summary1", "summary2", ...], ...}}
Expected keys: {json.dumps(video_keys)}"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={
                "temperature": 0.3,
                "max_output_tokens": 4096,
            },
        )

        text = response.text.strip()

        # Parse JSON from response (handle markdown code blocks)
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        result = json.loads(text.strip())

        if not isinstance(result, dict):
            print(f"⚠️ Expected dict, got {type(result).__name__}")
            return None

        # Validate and pad results
        validated = {}
        for video_key, segments in batch.items():
            summaries = result.get(video_key, [])
            if not isinstance(summaries, list):
                summaries = []
            while len(summaries) < len(segments):
                summaries.append("Continue learning in this section")
            validated[video_key] = summaries[: len(segments)]

        return validated

    except Exception as e:
        print(f"❌ API error: {e}")
        return None


# Legacy single-video function kept for fallback
def summarize_video_segments(client, video_key, segments):
    """
    Send all segments for one video to Gemini and get back
    a one-line learning-focused summary for each.
    """
    result = summarize_video_batch(client, {video_key: segments})
    if result and video_key in result:
        return result[video_key]
    return None


def main():
    parser = argparse.ArgumentParser(description="Summarize segments with Gemini")
    parser.add_argument("--dry-run", action="store_true", help="Preview batches without calling API")
    args = parser.parse_args()

    if not args.dry_run and not API_KEY:
        print("ERROR: API key not set")
        print("Set with: set GOOGLE_API_KEY=your_key")
        print("  (or)  : set GEMINI_API_KEY=your_key")
        return

    if not SEGMENTS_FILE.exists():
        print(f"ERROR: Segments file not found: {SEGMENTS_FILE}")
        print("Run build_transcript_index.py first")
        return

    client = None if args.dry_run else genai.Client(api_key=API_KEY)

    with open(SEGMENTS_FILE, "r", encoding="utf-8") as f:
        index = json.load(f)

    # Collect all videos needing summaries
    pending = []
    skipped = 0
    for course_code, videos in index.items():
        for video_key, segments in videos.items():
            if segments and "summary" in segments[0]:
                skipped += 1
                continue
            pending.append((course_code, video_key, segments))

    total = len(pending) + skipped
    batches_needed = (len(pending) + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"📝 Summarizing {len(pending)} videos ({skipped} already done, {total} total)")
    print(f"   Batch size: {BATCH_SIZE} videos/call → ~{batches_needed} Gemini calls")
    if args.dry_run:
        print(f"   🏜️ DRY RUN — no API calls will be made")
    print(f"   Estimated time: ~{batches_needed * DELAY_BETWEEN_REQUESTS / 60:.1f} minutes\n")

    processed = 0
    failed = 0

    # Process in batches
    for batch_idx in range(0, len(pending), BATCH_SIZE):
        batch_items = pending[batch_idx : batch_idx + BATCH_SIZE]
        batch_dict = {video_key: segments for _, video_key, segments in batch_items}
        batch_num = batch_idx // BATCH_SIZE + 1

        course_codes = set(cc for cc, _, _ in batch_items)
        print(f"  📦 Batch {batch_num}/{batches_needed} ({len(batch_items)} videos from {course_codes})")

        if args.dry_run:
            for _, vk, segs in batch_items:
                print(f"     {vk}: {len(segs)} segments")
            processed += len(batch_items)
            continue

        result = summarize_video_batch(client, batch_dict)
        if result:
            for course_code, video_key, segments in batch_items:
                if video_key in result:
                    for seg, summary in zip(segments, result[video_key]):
                        seg["summary"] = summary
                    processed += 1
                    print(f"     ✅ {video_key}")
                else:
                    failed += 1
                    print(f"     ❌ {video_key} (missing from response)")
        else:
            failed += len(batch_items)
            print(f"     ❌ Entire batch failed")

        # Rate limit
        time.sleep(DELAY_BETWEEN_REQUESTS)

        # Save progress every 3 batches
        if batch_num % 3 == 0:
            with open(SEGMENTS_FILE, "w", encoding="utf-8") as f:
                json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
            print(f"   💾 Progress saved ({processed} done, {failed} failed)")

    if not args.dry_run:
        # Final write
        with open(SEGMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    file_size_kb = os.path.getsize(SEGMENTS_FILE) / 1024 if SEGMENTS_FILE.exists() else 0
    print(f"\n✅ Done!")
    print(f"   Processed: {processed} videos")
    print(f"   Skipped (already done): {skipped}")
    print(f"   Failed: {failed}")
    print(f"   Gemini calls: ~{batches_needed} (was ~{len(pending)} without batching)")
    if not args.dry_run:
        print(f"   Output: {SEGMENTS_FILE} ({file_size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
