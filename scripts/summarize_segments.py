"""
Summarize Transcript Segments using Gemini API.

Uses the google-genai Python SDK (same pattern as UE5QuestionGenerator).
Reads transcript_segments.json, sends video segments in batches to Gemini,
and writes back a 'summary' field for each segment.

Usage:
  pip install google-genai
  set GOOGLE_API_KEY=your_key   (or GEMINI_API_KEY)
  python scripts/summarize_segments.py
"""

import os
import re
import json
import time
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


def summarize_video_segments(client, video_key, segments):
    """
    Send all segments for one video to Gemini and get back
    a one-line learning-focused summary for each.
    """
    seg_list = []
    for i, seg in enumerate(segments):
        text_preview = seg["text"][:300]
        seg_list.append(f"{i+1}. [{seg['start']}] {text_preview}")

    segments_text = "\n".join(seg_list)

    prompt = f"""You are summarizing video tutorial segments for learners studying Unreal Engine 5.
For each numbered segment below from the video "{video_key}", write ONE short sentence (8-15 words max) describing what the learner will learn or do in that segment.

Rules:
- Write from the learner's perspective
- Use action verbs: "Learn", "Set up", "Configure", "Understand", "Explore", "Adjust", "Create", "Apply"
- Be specific about UE5 concepts (e.g. "Configure Lumen reflection quality settings" not "Learn about settings")
- Do NOT mention the video title
- Do NOT use filler words
- Keep each summary under 15 words

Return ONLY a JSON array of strings, one summary per segment, in order.

Segments:
{segments_text}

Return format: ["summary1", "summary2", ...]"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={
                "temperature": 0.3,
                "max_output_tokens": 2048,
            },
        )

        text = response.text.strip()

        # Parse JSON array from response (handle markdown code blocks)
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        summaries = json.loads(text.strip())

        if len(summaries) == len(segments):
            return summaries
        else:
            print(f"⚠️ Got {len(summaries)} summaries for {len(segments)} segments")
            while len(summaries) < len(segments):
                summaries.append("Continue learning in this section")
            return summaries[: len(segments)]

    except Exception as e:
        print(f"❌ API error: {e}")
        return None


def main():
    if not API_KEY:
        print("ERROR: API key not set")
        print("Set with: set GOOGLE_API_KEY=your_key")
        print("  (or)  : set GEMINI_API_KEY=your_key")
        return

    if not SEGMENTS_FILE.exists():
        print(f"ERROR: Segments file not found: {SEGMENTS_FILE}")
        print("Run build_transcript_index.py first")
        return

    client = genai.Client(api_key=API_KEY)

    with open(SEGMENTS_FILE, "r", encoding="utf-8") as f:
        index = json.load(f)

    total_videos = sum(len(videos) for videos in index.values())
    processed = 0
    failed = 0
    skipped = 0

    print(f"📝 Summarizing {total_videos} videos across {len(index)} courses")
    print(f"   Using google-genai SDK at ~{REQUESTS_PER_MINUTE} req/min")
    print(f"   Estimated time: ~{total_videos / REQUESTS_PER_MINUTE:.0f} minutes\n")

    for course_code, videos in index.items():
        print(f"📂 Course {course_code} ({len(videos)} videos)")

        for video_key, segments in videos.items():
            # Skip if already has summaries
            if segments and "summary" in segments[0]:
                skipped += 1
                continue

            print(f"  🎬 {video_key} ({len(segments)} segments)...", end=" ", flush=True)

            summaries = summarize_video_segments(client, video_key, segments)
            if summaries:
                for seg, summary in zip(segments, summaries):
                    seg["summary"] = summary
                processed += 1
                print("✅")
            else:
                failed += 1
                print("❌")

            # Rate limit
            time.sleep(DELAY_BETWEEN_REQUESTS)

            # Save progress every 10 videos
            if (processed + failed) % 10 == 0:
                with open(SEGMENTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
                print(f"   💾 Progress saved ({processed} done, {failed} failed)")

    # Final write
    with open(SEGMENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    file_size_kb = os.path.getsize(SEGMENTS_FILE) / 1024
    print(f"\n✅ Done!")
    print(f"   Processed: {processed} videos")
    print(f"   Skipped (already done): {skipped}")
    print(f"   Failed: {failed}")
    print(f"   Output: {SEGMENTS_FILE} ({file_size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
