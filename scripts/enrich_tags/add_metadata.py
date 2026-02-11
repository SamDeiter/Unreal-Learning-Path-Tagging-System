"""Add Duration and Difficulty Metadata.

Enhances course data with:
1. duration_minutes: Total video duration (estimated from video count)
2. difficulty: 1-5 scale based on course code series
3. prerequisites: Basic dependency mapping
"""

import json
from pathlib import Path

CONTENT_DIR = Path("content")
DATA_DIR = Path("path-builder/src/data")

# Difficulty mapping based on course code series
# 1xx = Beginner, 2xx = Intermediate, 3xx = Advanced
def get_difficulty(code: str) -> int:
    """Determine difficulty level from course code."""
    try:
        series = int(code.split('.')[0][0])  # First digit
        if series == 1:
            return 1  # Beginner
        elif series == 2:
            return 3  # Intermediate
        elif series == 3:
            return 5  # Advanced
        else:
            return 2  # Default
    except:
        return 2

# Prerequisite suggestions based on topic/difficulty
PREREQUISITE_MAP = {
    # Advanced courses require intermediate
    '311.01': ['211.02'],  # Landscape Materials requires Layout
    '311.03': ['111.00'],  # Landscape Foliage requires Quickstart
    '311.04': ['111.00'],  # World Partition requires basics
    # Animation chain
    '204': ['104'],  # Advanced animation needs basics
    '304': ['204'],  # Pro animation needs advanced
    # Blueprint chain
    '201': ['101'],  # Intermediate BP needs basics
    '301': ['201'],  # Advanced BP needs intermediate
}

def get_prerequisites(code: str) -> list:
    """Get basic prerequisite suggestions."""
    prereqs = []

    # Direct mapping
    if code in PREREQUISITE_MAP:
        prereqs.extend(PREREQUISITE_MAP[code])

    # Series-based: 2xx/3xx suggest 1xx equivalent
    try:
        parts = code.split('.')
        series = int(parts[0][0])
        topic = parts[0][1:]

        if series == 2:
            prereqs.append(f"1{topic}.00")
        elif series == 3:
            prereqs.append(f"2{topic}.00")
    except:
        pass

    return prereqs

def estimate_duration(video_count: int) -> int:
    """Estimate course duration in minutes.

    Assumes average video is ~8-12 minutes.
    """
    if video_count == 0:
        return 0
    return video_count * 10  # 10 min average per video


def main():
    print("=" * 60)
    print("ADDING DURATION & DIFFICULTY METADATA")
    print("=" * 60)

    # Load data
    path = CONTENT_DIR / "video_library_enriched.json"
    data = json.loads(path.read_text(encoding='utf-8'))
    courses = data.get('courses', [])

    print(f"\n📂 Loaded {len(courses)} courses")

    # Add metadata
    for course in courses:
        code = course.get('code', '')
        video_count = course.get('video_count', 0)

        # Duration
        duration = estimate_duration(video_count)
        course['duration_minutes'] = duration

        # Difficulty
        difficulty = get_difficulty(code)
        course['difficulty'] = difficulty

        # Prerequisites
        prereqs = get_prerequisites(code)
        if prereqs:
            course['prerequisites'] = prereqs

    # Stats
    by_difficulty = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    total_duration = 0

    for c in courses:
        by_difficulty[c.get('difficulty', 2)] += 1
        total_duration += c.get('duration_minutes', 0)

    print("\n📊 Difficulty Distribution:")
    print(f"   Beginner (1): {by_difficulty[1]}")
    print(f"   Intermediate (2-3): {by_difficulty[2] + by_difficulty[3]}")
    print(f"   Advanced (4-5): {by_difficulty[4] + by_difficulty[5]}")

    print(f"\n⏱️  Total Estimated Content: {total_duration // 60} hours {total_duration % 60} minutes")

    # Save
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    DATA_DIR.joinpath("video_library.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8'
    )
    DATA_DIR.joinpath("video_library_enriched.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8'
    )

    print("\n💾 Saved to content/ and path-builder/src/data/")
    print("\n" + "=" * 60)
    print("✅ COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
