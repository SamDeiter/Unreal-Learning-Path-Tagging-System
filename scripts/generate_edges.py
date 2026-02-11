#!/usr/bin/env python3
"""Phase 4: Edge Generation (Prerequisites)
Generates course prerequisite edges based on:
1. Course skill levels (Beginner → Intermediate → Advanced)
2. Gemini-suggested prerequisites
3. Topic/system tag relationships.

Usage:
  python scripts/generate_edges.py --dry-run
  python scripts/generate_edges.py --apply
"""
import json
from collections import defaultdict
from pathlib import Path

CONTENT_DIR = Path("content")
VIDEO_LIBRARY = CONTENT_DIR / "video_library_enriched.json"
EDGES_FILE = CONTENT_DIR / "edges.json"

# Skill progression hierarchy
SKILL_LEVELS = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}


def load_library():
    with open(VIDEO_LIBRARY, encoding="utf-8") as f:
        return json.load(f)


def load_edges():
    if EDGES_FILE.exists():
        with open(EDGES_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_edges(edges):
    with open(EDGES_FILE, "w", encoding="utf-8") as f:
        json.dump(edges, f, indent=2, ensure_ascii=False)


def get_course_tags(course):
    """Get all tags from a course."""
    tags = set()
    for t in course.get("extracted_tags", []):
        tags.add(t)
    for t in course.get("gemini_system_tags", []):
        tags.add(t)
    return tags


def find_related_courses(courses):
    """Find courses that share tags and create prerequisite edges."""
    # Group courses by primary tag
    tag_courses = defaultdict(list)
    for course in courses:
        for tag in get_course_tags(course):
            tag_courses[tag].append(course)

    edges = []
    seen = set()

    for tag, related in tag_courses.items():
        if len(related) < 2:
            continue

        # Sort by skill level
        sorted_courses = sorted(
            related,
            key=lambda c: SKILL_LEVELS.get(
                c.get("gemini_skill_level") or c.get("difficulty") or "Intermediate", 1
            )
        )

        # Create edges from easier to harder courses
        for i in range(len(sorted_courses) - 1):
            source = sorted_courses[i]
            target = sorted_courses[i + 1]

            source_id = source.get("code") or source.get("id")
            target_id = target.get("code") or target.get("id")

            if not source_id or not target_id:
                continue

            edge_key = f"{source_id}→{target_id}"
            if edge_key in seen:
                continue
            seen.add(edge_key)

            source_level = source.get("gemini_skill_level") or source.get("difficulty") or "Intermediate"
            target_level = target.get("gemini_skill_level") or target.get("difficulty") or "Intermediate"

            # Only create edge if levels are different (progression)
            if source_level != target_level:
                edges.append({
                    "source": source_id,
                    "target": target_id,
                    "relationship": "prerequisite",
                    "shared_tag": tag,
                    "source_level": source_level,
                    "target_level": target_level,
                })

    return edges


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate prerequisite edges")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without applying")
    parser.add_argument("--apply", action="store_true", help="Apply changes")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply")
        return

    library = load_library()
    courses = library.get("courses", [])

    # Generate new edges
    new_edges = find_related_courses(courses)

    print(f"Generated {len(new_edges)} prerequisite edges")

    if args.dry_run:
        for edge in new_edges[:20]:
            print(f"  {edge['source']} → {edge['target']} ({edge['shared_tag']})")
        if len(new_edges) > 20:
            print(f"  ... and {len(new_edges) - 20} more")
        return

    # Load existing edges and merge
    existing = load_edges()
    existing_set = {f"{e.get('source')}→{e.get('target')}" for e in existing}

    added = 0
    for edge in new_edges:
        key = f"{edge['source']}→{edge['target']}"
        if key not in existing_set:
            existing.append(edge)
            added += 1

    save_edges(existing)
    print(f"Added {added} new edges (total: {len(existing)})")


if __name__ == "__main__":
    main()
