"""
Re-enrich YouTube courses in video_library_enriched.json
Fixes BOTH topic and level classifications.
"""
import json
import re
import os

INPUT = os.path.join(os.path.dirname(__file__), "..", "path-builder", "src", "data", "video_library_enriched.json")

# Topic mapping rules: (pattern, topic_name)
TOPIC_RULES = [
    (r"nanite", "Nanite"),
    (r"lumen", "Lumen"),
    (r"virtual shadow|vsm", "Virtual Shadow Maps"),
    (r"substrate|material\s*editor|pbr|texture|material", "Materials"),
    (r"niagara|particle|vfx|effect", "Niagara / VFX"),
    (r"post.?process|color.?grad", "Post Processing"),
    (r"lighting|light|shadow|illumination|gi\b", "Lighting"),
    (r"sequencer|cinematic|movie", "Sequencer"),
    (r"control.?rig|ik\b|fk\b|retarget|skeleton", "Rigging"),
    (r"animation|anim\b|motion|mocap|metahuman", "Animation"),
    (r"blueprint|bp\b|visual.?script", "Blueprints"),
    (r"c\+\+|cpp|programming|code|api", "C++ Programming"),
    (r"gameplay.?ability|gas\b", "Gameplay Ability System"),
    (r"landscape|terrain|foliage|procedural.?content|pcg", "Landscape / PCG"),
    (r"world.?partition|open.?world|streaming", "World Building"),
    (r"level.?design|level\b.*editor", "Level Design"),
    (r"network|multiplayer|replication|dedicated.?server", "Networking"),
    (r"ai\b|behavior.?tree|state.?tree|navigation|navmesh", "AI"),
    (r"audio|sound|metasound|music", "Audio"),
    (r"ui\b|umg|widget|hud|menu|slate", "UI / UMG"),
    (r"physics|collision|chaos|destruction|ragdoll", "Physics"),
    (r"enhanced.?input|input\b|gamepad|controller", "Input"),
    (r"editor.?utility|tool|plugin|automation", "Editor Tools"),
    (r"profil|debug|optimiz|performance|fps|frame", "Performance"),
    (r"packag|deploy|ship|build|platform", "Packaging / Deployment"),
    (r"automotiv|vehicle|car\b", "Automotive"),
    (r"archviz|architect|interior|building|real.?estate", "Architecture"),
    (r"film|virtual.?production|led.?wall|stage", "Virtual Production"),
    (r"digital.?twin|simulation|training|enterprise", "Simulation"),
    (r"getting.?started|your.?first|beginn|intro|overview|foundation|basic", "Getting Started"),
    (r"gameplay|game\b.*mechanic|interact|prototype", "Gameplay"),
]

# Level classification based on title keywords
ADVANCED_PATTERNS = [
    r"advanced", r"deep\s*dive", r"master\s*class", r"expert",
    r"architect", r"optimization", r"profiling", r"debugging",
    r"replication", r"dedicated\s*server", r"multiplayer",
    r"GAS\b", r"gameplay\s*ability", r"subsystem",
    r"custom\s*engine", r"plugin\s*development",
    r"state\s*tree", r"mass\s*entity", r"world\s*partition",
    r"procedural", r"pcg", r"hism",
    r"virtual\s*production", r"led\s*wall",
    r"data\s*layer", r"streaming",
    r"c\+\+\s*(?:class|module|system|framework)",
]

BEGINNER_PATTERNS = [
    r"beginner", r"getting\s*started", r"your\s*first",
    r"introduction\s*to", r"intro\s*to", r"basics?\b",
    r"overview\b", r"what\s*is", r"101\b", r"starter",
    r"first\s*hour", r"first\s*project", r"first\s*game",
    r"quick\s*start", r"crash\s*course",
    r"fundamentals", r"for\s*beginners",
]


def classify_topic(title, tag_ids):
    combined = (title + " " + " ".join(tag_ids)).lower()
    for pattern, topic in TOPIC_RULES:
        if re.search(pattern, combined, re.IGNORECASE):
            return topic
    return "Other"


def classify_level(title):
    title_lower = title.lower()
    for pattern in BEGINNER_PATTERNS:
        if re.search(pattern, title_lower):
            return "Beginner"
    for pattern in ADVANCED_PATTERNS:
        if re.search(pattern, title_lower):
            return "Advanced"
    return "Intermediate"


def main():
    with open(INPUT, "r", encoding="utf-8") as f:
        data = json.load(f)

    courses = data if isinstance(data, list) else data.get("courses", data.get("videos", []))
    yt_courses = [c for c in courses if isinstance(c, dict) and c.get("source") == "youtube"]
    print(f"Total YouTube courses: {len(yt_courses)}")

    # BEFORE stats
    old_topics = {}
    old_levels = {}
    for c in yt_courses:
        t = (c.get("tags") or {}).get("topic", "NONE")
        l = (c.get("tags") or {}).get("level", "NONE")
        old_topics[t] = old_topics.get(t, 0) + 1
        old_levels[l] = old_levels.get(l, 0) + 1
    print(f"BEFORE topics: {old_topics}")
    print(f"BEFORE levels: {old_levels}")

    # Re-classify
    topic_changed = 0
    level_changed = 0
    new_topics = {}
    new_levels = {}

    for c in yt_courses:
        title = c.get("title", c.get("name", ""))
        tags = c.get("tags", {}) or {}

        # Collect tag strings for topic classification
        tag_ids = []
        for k, v in tags.items():
            if isinstance(v, list):
                tag_ids.extend(v)
            elif isinstance(v, str):
                tag_ids.append(v)

        # Re-classify topic
        new_topic = classify_topic(title, tag_ids)
        new_topics[new_topic] = new_topics.get(new_topic, 0) + 1
        if new_topic != tags.get("topic", ""):
            if "tags" not in c:
                c["tags"] = {}
            c["tags"]["topic"] = new_topic
            topic_changed += 1

        # Re-classify level
        new_level = classify_level(title)
        new_levels[new_level] = new_levels.get(new_level, 0) + 1
        if new_level != tags.get("level", ""):
            if "tags" not in c:
                c["tags"] = {}
            c["tags"]["level"] = new_level
            level_changed += 1

    print(f"\nAFTER topics: {dict(sorted(new_topics.items(), key=lambda x: -x[1]))}")
    print(f"AFTER levels: {dict(sorted(new_levels.items(), key=lambda x: -x[1]))}")
    print(f"Topics changed: {topic_changed}")
    print(f"Levels changed: {level_changed}")

    # Write back
    with open(INPUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to {INPUT}")


if __name__ == "__main__":
    main()
