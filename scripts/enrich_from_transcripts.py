#!/usr/bin/env python3
"""Phase 1: Transcript-Based Tag Enrichment via Gemini AI
Uses existing transcripts + Gemini to extract rich tags from video content.
Processes in batches with rate limiting to manage API costs.

Usage:
  python scripts/enrich_from_transcripts.py --limit 10  # Process 10 courses
  python scripts/enrich_from_transcripts.py --all       # Process all (careful!)
"""
import argparse
import json
import time
from pathlib import Path

# Configuration
CONTENT_DIR = Path("content")
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"
VIDEO_LIBRARY = CONTENT_DIR / "video_library_enriched.json"
TAGS_FILE = CONTENT_DIR / "tags.json"

# Rate limiting
RATE_LIMIT_DELAY = 0.5  # seconds between API calls

# Gemini prompt for tag extraction
ENRICHMENT_PROMPT = """Analyze this UE5 training video transcript and extract:

1. **Technical Tags** (3-8): Specific UE5 systems, tools, or concepts covered
   Examples: Blueprint, Niagara, Sequencer, Material Editor, Control Rig, Lumen

2. **Industry Tags** (1-3): Which industries would benefit
   Options: Games, Architecture, Automotive, Media & Entertainment, All

3. **Skill Level**: Beginner, Intermediate, or Advanced

4. **Key Learning Topics** (2-5): Main concepts taught

5. **Prerequisites** (0-3): What should learner know first

TRANSCRIPT (first 2000 chars):
{transcript}

Respond as JSON only:
{{
  "technical_tags": ["tag1", "tag2"],
  "industry_tags": ["Games"],
  "skill_level": "Intermediate",
  "learning_topics": ["topic1", "topic2"],
  "prerequisites": ["Blueprint fundamentals"]
}}"""


def load_library():
    with open(VIDEO_LIBRARY, encoding="utf-8") as f:
        return json.load(f)


def save_library(library):
    with open(VIDEO_LIBRARY, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)


def load_transcript(video_id):
    """Load transcript for a video by ID."""
    transcript_file = TRANSCRIPTS_DIR / f"{video_id}.json"
    if not transcript_file.exists():
        return None

    with open(transcript_file, encoding="utf-8") as f:
        data = json.load(f)

    # Handle different transcript formats
    if isinstance(data, dict):
        return data.get("text") or data.get("transcript") or ""
    return str(data)


def get_videos_needing_enrichment(courses, limit=None):
    """Find videos with transcripts that haven't been AI-enriched yet."""
    videos_to_process = []

    for course in courses:
        if not course.get("videos"):
            continue

        for video in course["videos"]:
            video_id = video.get("id") or video.get("video_id")
            if not video_id:
                continue

            # Check if already enriched
            if video.get("ai_enriched"):
                continue

            # Check if transcript exists
            transcript = load_transcript(video_id)
            if not transcript or len(transcript) < 100:
                continue

            videos_to_process.append({
                "course": course,
                "video": video,
                "video_id": video_id,
                "transcript": transcript[:2000],  # First 2000 chars
            })

            if limit and len(videos_to_process) >= limit:
                return videos_to_process

    return videos_to_process


def call_gemini_api(prompt):
    """Call Gemini API for enrichment.
    NOTE: This is a placeholder - you need to implement actual API call
    or use the Cloud Function if running from client.
    """
    # TODO: Implement actual Gemini API call
    # For now, return a mock response for testing
    print("  [MOCK] Gemini API call - implement actual call")
    return {
        "technical_tags": [],
        "industry_tags": [],
        "skill_level": "Intermediate",
        "learning_topics": [],
        "prerequisites": [],
    }


def enrich_video(video_data):
    """Enrich a single video using Gemini."""
    video = video_data["video"]
    transcript = video_data["transcript"]

    prompt = ENRICHMENT_PROMPT.format(transcript=transcript)

    try:
        result = call_gemini_api(prompt)

        # Merge extracted data into video
        video["ai_enriched"] = True
        video["ai_tags"] = result.get("technical_tags", [])
        video["ai_industry"] = result.get("industry_tags", [])
        video["ai_level"] = result.get("skill_level")
        video["ai_topics"] = result.get("learning_topics", [])
        video["ai_prerequisites"] = result.get("prerequisites", [])

        return True
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Enrich courses from transcripts via Gemini")
    parser.add_argument("--limit", type=int, default=5, help="Max videos to process")
    parser.add_argument("--all", action="store_true", help="Process all videos (careful!)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed")
    args = parser.parse_args()

    limit = None if args.all else args.limit

    library = load_library()
    courses = library.get("courses", [])

    videos = get_videos_needing_enrichment(courses, limit=limit)

    print(f"Found {len(videos)} videos needing enrichment")

    if args.dry_run:
        for v in videos[:20]:
            print(f"  - {v['video'].get('title', 'Unknown')[:50]}")
        return

    enriched = 0
    for i, video_data in enumerate(videos):
        title = video_data["video"].get("title", "Unknown")[:40]
        print(f"[{i+1}/{len(videos)}] {title}...")

        if enrich_video(video_data):
            enriched += 1

        time.sleep(RATE_LIMIT_DELAY)

    # Save updated library
    save_library(library)

    print(f"\nSUMMARY: Enriched {enriched}/{len(videos)} videos")


if __name__ == "__main__":
    main()
