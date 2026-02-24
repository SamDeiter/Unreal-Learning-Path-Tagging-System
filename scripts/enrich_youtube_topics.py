"""
Re-enrich YouTube courses in video_library_enriched.json
with better topic tags based on title and tag_ids.
"""
import json
import re
import os

INPUT = os.path.join(os.path.dirname(__file__), "..", "path-builder", "src", "data", "video_library_enriched.json")

# Topic mapping rules: (pattern, topic_name)
# Checked against title (case-insensitive) and tag_ids
TOPIC_RULES = [
    # Rendering subsystems
    (r"nanite", "Nanite"),
    (r"lumen", "Lumen"),
    (r"virtual shadow|vsm", "Virtual Shadow Maps"),
    (r"substrate|material\s*editor|pbr|texture|material", "Materials"),
    (r"niagara|particle|vfx|effect", "Niagara / VFX"),
    (r"post.?process|color.?grad", "Post Processing"),
    # Lighting
    (r"lighting|light|shadow|illumination|gi\b", "Lighting"),
    # Animation
    (r"sequencer|cinematic|movie", "Sequencer"),
    (r"control.?rig|ik\b|fk\b|retarget|skeleton", "Rigging"),
    (r"animation|anim\b|motion|mocap|metahuman", "Animation"),
    # Scripting
    (r"blueprint|bp\b|visual.?script", "Blueprints"),
    (r"c\+\+|cpp|programming|code|api", "C++ Programming"),
    (r"gameplay.?ability|gas\b", "Gameplay Ability System"),
    # World building
    (r"landscape|terrain|foliage|procedural.?content|pcg", "Landscape / PCG"),
    (r"world.?partition|open.?world|streaming", "World Building"),
    (r"level.?design|level\b.*editor", "Level Design"),
    # Networking
    (r"network|multiplayer|replication|dedicated.?server", "Networking"),
    # AI
    (r"ai\b|behavior.?tree|state.?tree|navigation|navmesh", "AI"),
    # Audio
    (r"audio|sound|metasound|music", "Audio"),
    # UI
    (r"ui\b|umg|widget|hud|menu|slate", "UI / UMG"),
    # Physics
    (r"physics|collision|chaos|destruction|ragdoll", "Physics"),
    # Input
    (r"enhanced.?input|input\b|gamepad|controller", "Input"),
    # Tools
    (r"editor.?utility|tool|plugin|automation", "Editor Tools"),
    (r"profil|debug|optimiz|performance|fps|frame", "Performance"),
    (r"packag|deploy|ship|build|platform", "Packaging / Deployment"),
    # Specific domains
    (r"automotiv|vehicle|car\b", "Automotive"),
    (r"archviz|architect|interior|building|real.?estate", "Architecture"),
    (r"film|virtual.?production|led.?wall|stage", "Virtual Production"),
    (r"digital.?twin|simulation|training|enterprise", "Simulation"),
    # General
    (r"getting.?started|your.?first|beginn|intro|overview|foundation|basic", "Getting Started"),
    (r"gameplay|game\b.*mechanic|interact|prototype", "Gameplay"),
]

def classify_topic(title, tag_ids):
    """Classify a course into a topic based on title and tag_ids."""
    combined = (title + " " + " ".join(tag_ids)).lower()
    for pattern, topic in TOPIC_RULES:
        if re.search(pattern, combined, re.IGNORECASE):
            return topic
    return "Other"

def main():
    with open(INPUT, "r", encoding="utf-8") as f:
        data = json.load(f)

    courses = data if isinstance(data, list) else data.get("courses", data.get("videos", []))

    yt_courses = [c for c in courses if c.get("source") == "youtube"]
    print(f"Total YouTube courses: {len(yt_courses)}")

    # Show current topic distribution
    old_topics = {}
    for c in yt_courses:
        t = (c.get("tags") or {}).get("topic", "NONE")
        old_topics[t] = old_topics.get(t, 0) + 1
    print(f"BEFORE topic distribution: {old_topics}")

    # Re-classify
    changed = 0
    new_topics = {}
    for c in yt_courses:
        title = c.get("title", c.get("name", ""))
        tag_ids = []
        tags = c.get("tags", {})
        if tags:
            # Collect all tag values
            for k, v in tags.items():
                if isinstance(v, list):
                    tag_ids.extend(v)
                elif isinstance(v, str):
                    tag_ids.append(v)

        new_topic = classify_topic(title, tag_ids)
        new_topics[new_topic] = new_topics.get(new_topic, 0) + 1

        old_topic = (c.get("tags") or {}).get("topic", "")
        if new_topic != old_topic:
            if "tags" not in c:
                c["tags"] = {}
            c["tags"]["topic"] = new_topic
            changed += 1

    print(f"AFTER topic distribution: {dict(sorted(new_topics.items(), key=lambda x: -x[1]))}")
    print(f"Changed: {changed} courses")

    # Write back
    with open(INPUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved to {INPUT}")

if __name__ == "__main__":
    main()
