#!/usr/bin/env python3
"""Phase 2: Industry Assignment Rules
Auto-assign industries to courses based on title and tag patterns.
Reduces "General" (unclassified) courses.
"""
import json
import re
from collections import Counter
from pathlib import Path

CONTENT_DIR = Path("content")
VIDEO_LIBRARY = CONTENT_DIR / "video_library_enriched.json"

# Industry patterns - keywords in title/tags -> industry assignment
# Order matters: more specific patterns first
INDUSTRY_PATTERNS = {
    "Architecture": [
        r"\bAEC\b", r"\bArchitecture\b", r"\bArchitectural\b",
        r"\bRevit\b", r"\bBIM\b", r"\bDatasmith\b",
        r"\bCAD\b", r"\bBuilding\b", r"\bInterior\b",
        r"\bReal Estate\b", r"\bConstruction\b",
    ],
    "Automotive": [
        r"\bAutomotive\b", r"\bHMI\b", r"\bVehicle\b",
        r"\bCar\b", r"\bConfigurator\b", r"\bDashboard\b",
        r"\bCockpit\b", r"\bAerospace\b",
    ],
    "Media & Entertainment": [
        r"\bVirtual Production\b", r"\bICVFX\b", r"\bLED Wall\b",
        r"\bFilm\b", r"\bCinematic\b", r"\bSequencer\b",
        r"\bVCam\b", r"\bStage\b", r"\bLive Link\b",
        r"\bBroadcast\b", r"\bStreaming\b",
        r"\bPerformance Capture\b", r"\bMoCap\b",
    ],
    "Games": [
        r"\bGames?\b", r"\bGameplay\b", r"\bMultiplayer\b",
        r"\bMobile App\b", r"\bMobile Game\b", r"\bAI\b",
        r"\bBehavior Tree\b", r"\bNavigation\b", r"\bEQS\b",
        r"\bState Tree\b", r"\bMass\b", r"\bReplication\b",
    ],
}

# Cross-industry topics - assign to ALL industries or leave as General
CROSS_INDUSTRY_TOPICS = {
    "Niagara", "Materials", "Animation", "Lighting", "Blueprint",
    "Optimization", "Audio", "MetaHuman", "Control Rig", "Landscape",
}


def load_library():
    with open(VIDEO_LIBRARY, encoding="utf-8") as f:
        return json.load(f)


def save_library(library):
    with open(VIDEO_LIBRARY, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)


def get_searchable_text(course):
    """Combine title, tags, and topics into searchable text."""
    parts = [course.get("title", "")]

    # Add topic
    topic = course.get("topic") or (course.get("tags") or {}).get("topic", "")
    if topic:
        parts.append(topic)

    # Add topics array
    if course.get("topics"):
        parts.extend(course["topics"])

    # Add extracted_tags
    if course.get("extracted_tags") and isinstance(course["extracted_tags"], list):
        parts.extend(course["extracted_tags"])

    return " ".join(str(p) for p in parts)


def find_industry(course):
    """Find matching industry based on patterns."""
    text = get_searchable_text(course)

    # Check each industry's patterns
    for industry, patterns in INDUSTRY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return industry

    # Check if it's a cross-industry topic (should stay General for now)
    topic = course.get("topic") or (course.get("tags") or {}).get("topic", "")
    if topic in CROSS_INDUSTRY_TOPICS:
        return None  # Leave as General - applies to all industries

    return None


def main():
    library = load_library()
    courses = library.get("courses", [])

    updated = 0
    industry_counts = Counter()

    for course in courses:
        # Get current industry
        current = course.get("industry")
        if current and current != "General":
            # Already has industry
            industry_counts[current] += 1
            continue

        # Also check tags.industry
        if isinstance(course.get("tags"), dict):
            tags_industry = course["tags"].get("industry")
            if tags_industry and tags_industry != "General":
                # Copy to top-level
                course["industry"] = tags_industry
                industry_counts[tags_industry] += 1
                updated += 1
                print(f"✓ '{course.get('title', '?')[:45]}' → {tags_industry} (from tags)")
                continue

        # Try to match patterns
        new_industry = find_industry(course)
        if new_industry:
            course["industry"] = new_industry
            # Also update tags.industry if it exists
            if isinstance(course.get("tags"), dict):
                course["tags"]["industry"] = new_industry
            industry_counts[new_industry] += 1
            updated += 1
            print(f"✓ '{course.get('title', '?')[:45]}' → {new_industry}")
        else:
            industry_counts["General"] += 1

    # Save updated library
    save_library(library)

    print(f"\n{'='*60}")
    print(f"SUMMARY: Updated {updated} courses with industries")
    print("\nIndustry Distribution:")
    for industry, count in industry_counts.most_common():
        print(f"  {industry}: {count}")


if __name__ == "__main__":
    main()
