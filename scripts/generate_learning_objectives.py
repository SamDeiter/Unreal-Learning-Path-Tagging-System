"""
Generate Learning Objectives per Course using Gemini API.

For each course, sends representative transcript segments to Gemini
and generates 3-5 learning objectives.

Usage:
  set GOOGLE_API_KEY=your_key
  python scripts/generate_learning_objectives.py
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
OUTPUT_FILE = REPO_ROOT / "path-builder" / "src" / "data" / "learning_objectives.json"

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

REQUESTS_PER_MINUTE = 14
DELAY_BETWEEN_REQUESTS = 60.0 / REQUESTS_PER_MINUTE


def generate_objectives(client, course_code, videos):
    """Send representative segments from a course to Gemini for objectives."""
    # Collect a sample of transcript text from the course
    sample_texts = []
    for video_key, segments in list(videos.items())[:8]:  # max 8 videos
        for seg in segments[:2]:  # first 2 segments per video
            sample_texts.append(f"[{video_key}] {seg['text'][:200]}")

    course_sample = "\n".join(sample_texts)

    prompt = f"""You are an instructional designer creating learning objectives for an Unreal Engine 5 video course.

Course code: {course_code}
Number of videos: {len(videos)}

Below are sample transcript excerpts from this course:
{course_sample}

Generate 3-5 specific, measurable learning objectives for this course.
- Start each with an action verb (Configure, Create, Implement, Understand, Apply, etc.)
- Be specific to UE5 concepts mentioned in the transcripts
- Keep each objective under 15 words
- Focus on practical skills the learner will gain

Return ONLY a JSON array of strings.
Example: ["Configure Lumen global illumination settings for realistic scenes", "Set up and optimize different light types"]"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"temperature": 0.3, "max_output_tokens": 1024},
        )

        text = response.text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        objectives = json.loads(text.strip())
        return objectives if isinstance(objectives, list) else None

    except Exception as e:
        print(f"    ❌ API error: {e}")
        return None


def main():
    if not API_KEY:
        print("ERROR: API key not set")
        print("Set with: set GOOGLE_API_KEY=your_key")
        return

    if not SEGMENTS_FILE.exists():
        print(f"ERROR: Segments file not found: {SEGMENTS_FILE}")
        return

    client = genai.Client(api_key=API_KEY)

    with open(SEGMENTS_FILE, "r", encoding="utf-8") as f:
        index = json.load(f)

    # Load existing output for resume support
    objectives = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            objectives = json.load(f)

    processed = 0
    skipped = 0
    failed = 0

    print(f"📝 Generating learning objectives for {len(index)} courses\n")

    for course_code, videos in index.items():
        if course_code in objectives:
            skipped += 1
            continue

        print(f"  📂 {course_code} ({len(videos)} videos)...", end=" ", flush=True)

        result = generate_objectives(client, course_code, videos)
        if result:
            objectives[course_code] = result
            processed += 1
            print(f"✅ {len(result)} objectives")
        else:
            failed += 1
            print("❌")

        time.sleep(DELAY_BETWEEN_REQUESTS)

        # Save progress every 10 courses
        if (processed + failed) % 10 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(objectives, f, ensure_ascii=False, indent=2)
            print(f"   💾 Saved ({processed} done)")

    # Final write
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(objectives, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done! {processed} courses, {skipped} skipped, {failed} failed")
    print(f"   Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
