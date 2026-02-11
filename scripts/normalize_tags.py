#!/usr/bin/env python3
"""Phase 3: Tag Normalization
Creates a master tag registry with canonical names, synonyms, and hierarchy.
Normalizes existing tags in courses to use canonical forms.

Usage:
  python scripts/normalize_tags.py --dry-run
  python scripts/normalize_tags.py --apply
"""
import json
from collections import Counter
from pathlib import Path

CONTENT_DIR = Path("content")
VIDEO_LIBRARY = CONTENT_DIR / "video_library_enriched.json"
TAGS_FILE = CONTENT_DIR / "tags.json"

# Canonical tag mappings: variant -> canonical
TAG_SYNONYMS = {
    # Blueprint variations
    "blueprints": "Blueprint",
    "bp": "Blueprint",
    "visual scripting": "Blueprint",
    "event graph": "Blueprint",

    # Niagara variations
    "niagara vfx": "Niagara",
    "particle": "Niagara",
    "particles": "Niagara",
    "vfx": "Niagara",
    "fx": "Niagara",

    # Animation variations
    "animations": "Animation",
    "anim": "Animation",
    "skeletal": "Animation",

    # Materials variations
    "material": "Materials",
    "shader": "Materials",
    "shading": "Materials",
    "pbr": "Materials",

    # Landscape variations
    "landscapes": "Landscape",
    "terrain": "Landscape",

    # Sequencer variations
    "cinematics": "Sequencer",
    "cinematic": "Sequencer",

    # Lighting variations
    "lights": "Lighting",
    "light": "Lighting",
    "illumination": "Lighting",

    # UI variations
    "umg": "UMG",
    "widget": "UMG",
    "widgets": "UMG",
    "user interface": "UI",

    # Audio variations
    "metasound": "MetaSound",
    "sound": "Audio",
    "sounds": "Audio",

    # AI variations
    "behavior tree": "Behavior Tree",
    "bt": "Behavior Tree",
    "state tree": "State Tree",
    "eqs": "AI",

    # World building
    "world partition": "World Partition",
    "level streaming": "World Partition",
    "open world": "World Partition",

    # Physics
    "chaos": "Physics",
    "destruction": "Physics",
    "rigid body": "Physics",

    # Rendering
    "lumen gi": "Lumen",
    "global illumination": "Lumen",
    "ray tracing": "Ray Tracing",
    "rtx": "Ray Tracing",
    "path tracer": "Path Tracer",

    # Virtual Production
    "vp": "Virtual Production",
    "icvfx": "ICVFX",
    "led wall": "ICVFX",
    "live link": "Live Link",
    "ndisplay": "nDisplay",

    # MetaHuman
    "metahuman": "MetaHuman",
    "digital human": "MetaHuman",

    # Control Rig
    "control rig": "Control Rig",
    "rigging": "Control Rig",
    "ik": "Control Rig",

    # PCG
    "procedural": "PCG",
    "procedural content": "PCG",
}


def load_library():
    with open(VIDEO_LIBRARY, encoding="utf-8") as f:
        return json.load(f)


def save_library(library):
    with open(VIDEO_LIBRARY, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)


def normalize_tag(tag):
    """Normalize a single tag to canonical form."""
    if not tag or not isinstance(tag, str):
        return tag

    # Check synonym mapping (case-insensitive)
    lower = tag.lower().strip()
    if lower in TAG_SYNONYMS:
        return TAG_SYNONYMS[lower]

    # Title case if not found
    return tag.strip()


def normalize_course_tags(course, dry_run=False):
    """Normalize all tags in a course."""
    changes = []

    # Normalize extracted_tags
    if course.get("extracted_tags"):
        original = course["extracted_tags"]
        normalized = list({normalize_tag(t) for t in original if t})
        if set(original) != set(normalized):
            changes.append(("extracted_tags", original, normalized))
            if not dry_run:
                course["extracted_tags"] = normalized

    # Normalize gemini_system_tags
    if course.get("gemini_system_tags"):
        original = course["gemini_system_tags"]
        normalized = list({normalize_tag(t) for t in original if t})
        if set(original) != set(normalized):
            changes.append(("gemini_system_tags", original, normalized))
            if not dry_run:
                course["gemini_system_tags"] = normalized

    # Normalize topics
    if course.get("topics"):
        original = course["topics"]
        normalized = list({normalize_tag(t) for t in original if t})
        if set(original) != set(normalized):
            changes.append(("topics", original, normalized))
            if not dry_run:
                course["topics"] = normalized

    return changes


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Normalize tags to canonical forms")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without applying")
    parser.add_argument("--apply", action="store_true", help="Apply changes")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply")
        return

    library = load_library()
    courses = library.get("courses", [])

    total_changes = 0
    tag_counter = Counter()

    for course in courses:
        changes = normalize_course_tags(course, dry_run=args.dry_run)
        if changes:
            total_changes += len(changes)
            if args.dry_run:
                print(f"\n{course.get('title', 'Unknown')[:40]}:")
                for field, old, new in changes:
                    print(f"  {field}: {old} → {new}")

        # Count all unique tags
        for t in course.get("extracted_tags", []):
            tag_counter[normalize_tag(t)] += 1
        for t in course.get("gemini_system_tags", []):
            tag_counter[normalize_tag(t)] += 1

    if args.apply:
        save_library(library)

    print(f"\n{'='*60}")
    print(f"{'[DRY RUN] ' if args.dry_run else ''}Total changes: {total_changes}")
    print("\nTop 20 Tags After Normalization:")
    for tag, count in tag_counter.most_common(20):
        print(f"  {tag}: {count}")


if __name__ == "__main__":
    main()
