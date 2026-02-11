#!/usr/bin/env python3
"""Auto-assign topics to courses based on title and tag analysis.
Reduces "Other" category by intelligently categorizing unlabeled courses.
"""
import json
from collections import Counter
from pathlib import Path

CONTENT_DIR = Path("content")
VIDEO_LIBRARY = CONTENT_DIR / "video_library_enriched.json"

# Topic keyword mappings - keywords in title/tags -> topic assignment
TOPIC_KEYWORDS = {
    "Niagara": [
        "niagara", "particle", "vfx", "visual effect", "fx", "emitter",
        "ribbon", "sprite", "gpu particles"
    ],
    "Materials": [
        "material", "shader", "texture", "pbr", "substance", "uv",
        "normal map", "roughness", "metallic", "subsurface"
    ],
    "Blueprints": [
        "blueprint", "bp_", "visual script", "node graph", "event graph",
        "function library", "macro", "interface"
    ],
    "Animation": [
        "animation", "anim", "skeletal", "rigging", "ik", "retarget",
        "montage", "blend space", "state machine", "control rig"
    ],
    "Landscape": [
        "landscape", "terrain", "foliage", "grass", "procedural", "pcg",
        "world partition", "level streaming", "world building"
    ],
    "Lighting": [
        "light", "lumen", "global illumination", "gi", "ray tracing",
        "reflection", "shadow", "exposure", "hdri", "skylight"
    ],
    "Sequencer": [
        "sequencer", "cinematic", "movie", "render queue", "camera",
        "cutscene", "film", "virtual production", "take recorder"
    ],
    "Optimization": [
        "optimiz", "performance", "profil", "lod", "culling", "occlusion",
        "nanite", "virtual texture", "streaming", "memory", "gpu"
    ],
    "Audio": [
        "audio", "sound", "metasound", "music", "sfx", "reverb",
        "attenuation", "spatialization"
    ],
    "AI": [
        "ai", "behavior tree", "blackboard", "navigation", "pathfinding",
        "perception", "eqs", "mass", "smart object"
    ],
    "Physics": [
        "physics", "collision", "rigid body", "chaos", "destruction",
        "cloth", "simulation", "constraint"
    ],
    "UI/UMG": [
        "ui", "umg", "widget", "hud", "menu", "user interface", "slate",
        "common ui"
    ],
    "Networking": [
        "network", "multiplayer", "replication", "rpc", "server", "client",
        "dedicated server", "online"
    ],
    "Data Pipeline": [
        "datasmith", "import", "export", "fbx", "gltf", "cad", "revit",
        "interchange", "pipeline"
    ],
    "Foundation": [
        "introduction", "intro", "getting started", "overview", "basics",
        "fundamentals", "quickstart", "beginner", "first", "101"
    ],
    "Control Rig": [
        "control rig", "rigging", "ik rig", "full body ik", "procedural rig"
    ],
    "Unreal Motion Graphics": [
        "motion graphics", "umg", "motion design"
    ],
}

def normalize(text):
    """Normalize text for matching."""
    return text.lower().strip() if text else ""

def find_topic(course):
    """Find the best topic match for a course based on title and tags."""
    title = normalize(course.get("title", ""))

    # Also check extracted_tags if available
    tags = course.get("tags", [])
    if isinstance(tags, list):
        tag_text = " ".join(normalize(t) for t in tags)
    elif isinstance(tags, dict):
        tag_text = " ".join(normalize(str(v)) for v in tags.values())
    else:
        tag_text = ""

    # Check topics array
    topics = course.get("topics", [])
    topics_text = " ".join(normalize(t) for t in topics)

    # Combine all searchable text
    search_text = f"{title} {tag_text} {topics_text}"

    # Score each topic
    scores = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if kw in search_text:
                # Title matches weighted more heavily
                if kw in title:
                    score += 3
                else:
                    score += 1
        if score > 0:
            scores[topic] = score

    if scores:
        # Return highest scoring topic
        return max(scores, key=scores.get)

    return None

def main():
    # Load library
    with open(VIDEO_LIBRARY, encoding="utf-8") as f:
        library = json.load(f)

    courses = library.get("courses", [])

    # Find courses without topics
    updated = 0
    topic_counts = Counter()

    for course in courses:
        existing_topic = course.get("topic")
        if existing_topic:
            topic_counts[existing_topic] += 1
            continue

        # Try to assign a topic
        new_topic = find_topic(course)
        if new_topic:
            course["topic"] = new_topic
            topic_counts[new_topic] += 1
            updated += 1
            print(f"✓ '{course.get('title', '?')[:50]}' → {new_topic}")
        else:
            topic_counts["Other"] += 1
            print(f"✗ No match: '{course.get('title', '?')[:50]}'")

    # Save updated library
    with open(VIDEO_LIBRARY, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"SUMMARY: Updated {updated} courses with topics")
    print("\nTopic Distribution:")
    for topic, count in topic_counts.most_common():
        print(f"  {topic}: {count}")

if __name__ == "__main__":
    main()
