"""
Generate Quiz Questions per Video using Gemini API.

For each video, generates 2-3 multiple-choice questions from transcript content.

Usage:
  set GOOGLE_API_KEY=your_key
  python scripts/generate_quiz_questions.py
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
OUTPUT_FILE = REPO_ROOT / "path-builder" / "src" / "data" / "quiz_questions.json"

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

REQUESTS_PER_MINUTE = 14
DELAY_BETWEEN_REQUESTS = 60.0 / REQUESTS_PER_MINUTE


def generate_quiz(client, video_key, segments):
    """Generate 2-3 MCQs from a video's transcript segments."""
    # Combine all segment text (limit to avoid token overflow)
    full_text = " ".join(seg["text"][:200] for seg in segments)[:2000]

    prompt = f"""You are creating quiz questions for a UE5 video tutorial.

Video: "{video_key}"
Transcript excerpt:
{full_text}

Generate 2-3 multiple-choice questions that test comprehension of this video content.

Rules:
- Each question should test practical UE5 knowledge from the transcript
- Provide exactly 4 answer options (A-D)
- Include the correct answer index (0-3)
- Include a brief explanation (1 sentence)
- Questions should be specific, not generic

Return ONLY a JSON array like this:
[
  {{
    "question": "What setting controls Lumen reflection quality?",
    "options": ["Reflection Quality", "Screen Percentage", "Shadow Bias", "Exposure"],
    "correct": 0,
    "explanation": "Reflection Quality directly controls the fidelity of Lumen reflections."
  }}
]"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"temperature": 0.4, "max_output_tokens": 2048},
        )

        text = response.text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        questions = json.loads(text.strip())
        if isinstance(questions, list) and len(questions) > 0:
            # Validate structure
            for q in questions:
                if not all(k in q for k in ("question", "options", "correct")):
                    return None
            return questions
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

    # Load existing for resume
    quiz_data = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            quiz_data = json.load(f)

    total_videos = sum(len(v) for v in index.values())
    processed = 0
    skipped = 0
    failed = 0
    total_questions = 0

    print(f"📝 Generating quiz questions for {total_videos} videos\n")

    for course_code, videos in index.items():
        if course_code not in quiz_data:
            quiz_data[course_code] = {}

        print(f"📂 Course {course_code} ({len(videos)} videos)")

        for video_key, segments in videos.items():
            if video_key in quiz_data[course_code]:
                skipped += 1
                continue

            print(f"  🎬 {video_key}...", end=" ", flush=True)

            questions = generate_quiz(client, video_key, segments)
            if questions:
                quiz_data[course_code][video_key] = questions
                processed += 1
                total_questions += len(questions)
                print(f"✅ {len(questions)} questions")
            else:
                failed += 1
                print("❌")

            time.sleep(DELAY_BETWEEN_REQUESTS)

            # Save progress every 10 videos
            if (processed + failed) % 10 == 0:
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(quiz_data, f, ensure_ascii=False, indent=2)
                print(f"   💾 Saved ({processed} done, {total_questions} Qs)")

    # Final write
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(quiz_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done!")
    print(f"   Videos processed: {processed}")
    print(f"   Total questions: {total_questions}")
    print(f"   Skipped: {skipped}, Failed: {failed}")
    print(f"   Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
