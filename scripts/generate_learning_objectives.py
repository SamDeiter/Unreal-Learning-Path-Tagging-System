"""Generate Learning Objectives per Course using Gemini API.

For each course, sends representative transcript segments to Gemini
and generates 3-5 learning objectives.

Phase 8B: Batches 5 courses per Gemini call to reduce API usage.

Usage:
  set GOOGLE_API_KEY=your_key
  python scripts/generate_learning_objectives.py
  python scripts/generate_learning_objectives.py --dry-run
"""

import argparse
import json
import os
import re
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

# Phase 8B: Batch size — number of courses per Gemini call
BATCH_SIZE = 5


def generate_objectives_batch(client, courses_batch):
    """Send multiple courses in one Gemini call.

    Args:
        client: Gemini client
        courses_batch: dict of {course_code: {video_key: segments_list, ...}}

    Returns:
        dict of {course_code: ["obj1", "obj2", ...]} or None on error
    """
    all_sections = []
    for course_code, videos in courses_batch.items():
        sample_texts = []
        for video_key, segments in list(videos.items())[:8]:
            for seg in segments[:2]:
                sample_texts.append(f"  [{video_key}] {seg['text'][:200]}")
        section = f"=== COURSE: {course_code} ({len(videos)} videos) ===\n" + "\n".join(sample_texts)
        all_sections.append(section)

    courses_text = "\n\n".join(all_sections)
    course_keys = list(courses_batch.keys())

    prompt = f"""You are an instructional designer creating learning objectives for Unreal Engine 5 video courses.

For EACH course below, generate 3-5 specific, measurable learning objectives.
- Start each with an action verb (Configure, Create, Implement, Understand, Apply, etc.)
- Be specific to UE5 concepts mentioned in the transcripts
- Keep each objective under 15 words
- Focus on practical skills the learner will gain

Return a JSON object where each key is the course code and the value is an array of objective strings.

Courses:
{courses_text}

Return format: {{"course_code": ["objective1", "objective2", ...], ...}}
Expected keys: {json.dumps(course_keys)}"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"temperature": 0.3, "max_output_tokens": 2048},
        )

        text = response.text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        result = json.loads(text.strip())

        if not isinstance(result, dict):
            print(f"⚠️ Expected dict, got {type(result).__name__}")
            return None

        # Validate
        validated = {}
        for course_code in course_keys:
            objs = result.get(course_code)
            if isinstance(objs, list) and len(objs) > 0:
                validated[course_code] = objs
        return validated

    except Exception as e:
        print(f"    ❌ API error: {e}")
        return None


# Legacy single-course function kept for fallback
def generate_objectives(client, course_code, videos):
    """Send representative segments from a course to Gemini for objectives."""
    result = generate_objectives_batch(client, {course_code: videos})
    if result and course_code in result:
        return result[course_code]
    return None


def main():
    parser = argparse.ArgumentParser(description="Generate learning objectives with Gemini")
    parser.add_argument("--dry-run", action="store_true", help="Preview batches without calling API")
    args = parser.parse_args()

    if not args.dry_run and not API_KEY:
        print("ERROR: API key not set")
        print("Set with: set GOOGLE_API_KEY=your_key")
        return

    if not SEGMENTS_FILE.exists():
        print(f"ERROR: Segments file not found: {SEGMENTS_FILE}")
        return

    client = None if args.dry_run else genai.Client(api_key=API_KEY)

    with open(SEGMENTS_FILE, encoding="utf-8") as f:
        index = json.load(f)

    # Load existing output for resume support
    objectives = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            objectives = json.load(f)

    # Collect pending courses
    pending = []
    skipped = 0
    for course_code, videos in index.items():
        if course_code in objectives:
            skipped += 1
            continue
        pending.append((course_code, videos))

    batches_needed = (len(pending) + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"📝 Generating learning objectives for {len(pending)} courses ({skipped} already done)")
    print(f"   Batch size: {BATCH_SIZE} courses/call → ~{batches_needed} Gemini calls")
    if args.dry_run:
        print("   🏜️ DRY RUN — no API calls will be made")
    print()

    processed = 0
    failed = 0

    for batch_idx in range(0, len(pending), BATCH_SIZE):
        batch_items = pending[batch_idx : batch_idx + BATCH_SIZE]
        batch_dict = dict(batch_items)
        batch_num = batch_idx // BATCH_SIZE + 1

        print(f"  📦 Batch {batch_num}/{batches_needed} ({len(batch_items)} courses: {[cc for cc, _ in batch_items]})")

        if args.dry_run:
            for cc, vids in batch_items:
                print(f"     {cc}: {len(vids)} videos")
            processed += len(batch_items)
            continue

        result = generate_objectives_batch(client, batch_dict)
        if result:
            for cc, _ in batch_items:
                if cc in result:
                    objectives[cc] = result[cc]
                    processed += 1
                    print(f"     ✅ {cc}: {len(result[cc])} objectives")
                else:
                    failed += 1
                    print(f"     ❌ {cc} (missing from response)")
        else:
            failed += len(batch_items)
            print("     ❌ Entire batch failed")

        time.sleep(DELAY_BETWEEN_REQUESTS)

        # Save progress every 2 batches
        if batch_num % 2 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(objectives, f, ensure_ascii=False, indent=2)
            print(f"   💾 Saved ({processed} done)")

    # Final write
    if not args.dry_run:
        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(objectives, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done! {processed} courses, {skipped} skipped, {failed} failed")
    print(f"   Gemini calls: ~{batches_needed} (was ~{len(pending)} without batching)")
    if not args.dry_run:
        print(f"   Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
