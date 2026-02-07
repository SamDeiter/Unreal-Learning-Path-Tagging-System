"""
Detect Course Prerequisites using Gemini API.

Analyzes transcript content across courses to suggest prerequisite relationships.

Usage:
  set GOOGLE_API_KEY=your_key
  python scripts/detect_prerequisites.py
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
OUTPUT_FILE = REPO_ROOT / "path-builder" / "src" / "data" / "course_prerequisites.json"

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

REQUESTS_PER_MINUTE = 14
DELAY_BETWEEN_REQUESTS = 60.0 / REQUESTS_PER_MINUTE


def detect_prereqs(client, course_code, videos, all_course_codes):
    """Analyze a course's content and suggest prerequisites from available courses."""
    # Build a sample of this course's content
    sample_texts = []
    for video_key, segments in list(videos.items())[:6]:
        for seg in segments[:2]:
            sample_texts.append(seg["text"][:150])
    course_sample = " ".join(sample_texts)[:1500]

    other_courses = [c for c in all_course_codes if c != course_code]

    prompt = f"""You are an instructional designer analyzing Unreal Engine 5 course content.

Course being analyzed: {course_code}
Transcript sample from this course:
{course_sample}

Available courses that could be prerequisites: {json.dumps(other_courses)}

Based on the transcript content, determine which courses (if any) should be taken BEFORE this one.

Consider:
- Does this course reference concepts that would be taught in earlier courses?
- Does it assume prior knowledge of specific UE5 tools or workflows?
- Course codes with lower numbers are generally more foundational

Return ONLY a JSON object like this:
{{
  "prerequisites": ["100.00", "200.01"],
  "difficulty": "intermediate",
  "reason": "References Nanite mesh import workflows covered in 100.00"
}}

If no prerequisites are needed, return:
{{
  "prerequisites": [],
  "difficulty": "beginner",
  "reason": "Self-contained introductory content"
}}"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"temperature": 0.3, "max_output_tokens": 512},
        )

        text = response.text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        result = json.loads(text.strip())
        if isinstance(result, dict) and "prerequisites" in result:
            return result
        return None

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

    all_course_codes = sorted(index.keys())

    # Load existing for resume
    prereqs = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            prereqs = json.load(f)

    processed = 0
    skipped = 0
    failed = 0

    print(f"📝 Detecting prerequisites for {len(index)} courses\n")

    for course_code, videos in index.items():
        if course_code in prereqs:
            skipped += 1
            continue

        print(f"  📂 {course_code} ({len(videos)} videos)...", end=" ", flush=True)

        result = detect_prereqs(client, course_code, videos, all_course_codes)
        if result:
            prereqs[course_code] = result
            processed += 1
            n_prereqs = len(result.get("prerequisites", []))
            diff = result.get("difficulty", "?")
            print(f"✅ {n_prereqs} prereqs, {diff}")
        else:
            failed += 1
            print("❌")

        time.sleep(DELAY_BETWEEN_REQUESTS)

    # Final write
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(prereqs, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done! {processed} courses, {skipped} skipped, {failed} failed")
    print(f"   Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
