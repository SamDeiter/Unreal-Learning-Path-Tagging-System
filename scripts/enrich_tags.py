#!/usr/bin/env python3
"""
enrich_tags.py — Clean up and expand tags.json
  1. Remove junk entries (crash codes, error messages)
  2. Mine all tags from course canonical_tags / extracted_tags / gemini_system_tags
  3. Merge, deduplicate, auto-generate metadata
  4. Write updated tags.json
"""

import json
import os
import re
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
TAGS_PATH = os.path.join(ROOT, "path-builder", "src", "data", "tags.json")
COURSES_PATH = os.path.join(ROOT, "path-builder", "src", "data", "video_library_enriched.json")

# ── Junk tag_ids to remove (generic / non-searchable only) ────────────
# NOTE: crash codes like ExitCode, D3D Device Lost, Access Violation are
# KEPT because users search for troubleshooting help on those topics.
JUNK_IDS = {
    "error.call_stack", "error.editor_symbols", "error.output_log",
    "error.accessed_none", "error.infinite_loop",
    "troubleshoot.call_stack", "troubleshoot.editor_symbols",
    "troubleshoot.output_log", "troubleshoot.accessed_none",
    "troubleshoot.infinite_loop",
}

JUNK_DISPLAY_NAMES = {
    "call stack / debugging", "editor symbols", "output log",
    "accessed none", "infinite loop",
    "unreal build tool (ubt)", "automation tool (uat)", "windows",
}

# ── Category descriptions ─────────────────────────────────────────────
CATEGORY_META = {
    "rendering":    "Rendering & Visual",
    "animation":    "Animation",
    "scripting":    "Scripting & Programming",
    "cinematic":    "Cinematics & Sequencer",
    "environment":  "Environment & World Building",
    "ui":           "User Interface",
    "audio":        "Audio & Sound",
    "physics":      "Physics & Simulation",
    "ai":           "AI & Navigation",
    "character":    "Character & Avatar",
    "optimization": "Optimization & Performance",
    "performance":  "Optimization & Performance",
    "platform":     "Platform & Deployment",
    "build":        "Platform & Deployment",
    "xr":           "XR / VR / AR",
    "vfx":          "Visual Effects",
    "world":        "World & Level",
    "worldbuilding":"World & Level",
    "procedural":   "Procedural Generation",
    "industry":     "Industry & Vertical",
    "tools":        "Tools & Pipeline",
    "datasmith":    "Tools & Pipeline",
    "motiondesign": "Motion Design",
    "automation":   "Tools & Pipeline",
    "blueprints":   "Scripting & Programming",
    "topic":        "Topic",
}

# ── Map plain names → canonical tag_ids ───────────────────────────────
PLAIN_TO_CANONICAL = {
    "blueprint":          "scripting.blueprint",
    "blueprints":         "scripting.blueprint",
    "c++":                "scripting.cpp",
    "python":             "scripting.python",
    "lumen":              "rendering.lumen",
    "nanite":             "rendering.nanite",
    "niagara":            "vfx.niagara",
    "materials":          "rendering.material",
    "material":           "rendering.material",
    "lighting":           "rendering.lighting",
    "ray tracing":        "rendering.raytracing",
    "post process":       "rendering.postprocess",
    "landscape":          "environment.landscape",
    "foliage":            "environment.foliage",
    "sequencer":          "cinematic.sequencer",
    "metahuman":          "character.metahuman",
    "control rig":        "animation.control_rig",
    "animation":          "animation.general",
    "metasound":          "audio.metasound",
    "metasounds":         "audio.metasound",
    "audio":              "audio.general",
    "umg":                "ui.umg",
    "ui":                 "ui.umg",
    "hud":                "ui.hud",
    "vr":                 "xr.vr",
    "ar":                 "xr.ar",
    "physics":            "physics.general",
    "chaos":              "physics.chaos",
    "pcg":                "procedural.pcg",
    "world partition":    "world.partition",
    "multiplayer":        "networking.multiplayer",
    "replication":        "networking.replication",
    "networking":         "networking.general",
    "network":            "networking.general",
    "packaging":          "build.packaging",
    "optimization":       "optimization.general",
    "profiling":          "optimization.profiling",
    "performance":        "optimization.general",
    "rendering":          "rendering.general",
    "virtual production": "cinematic.virtual_production",
    "icvfx":              "cinematic.icvfx",
    "live link":          "cinematic.live_link",
    "path tracer":        "rendering.path_tracer",
    "behavior tree":      "ai.behavior_tree",
    "ai":                 "ai.navigation",
    "datasmith":          "datasmith.general",
    "editor":             "tools.editor",
    "unreal editor":      "tools.editor",
    "unreal engine 5":    "topic.ue5_general",
    "level design":       "world.level_design",
    "viewport":           "tools.viewport",
    "texture":            "rendering.texture",
    "skeletal mesh":      "animation.skeletal_mesh",
    "static mesh":        "rendering.static_mesh",
    "mesh":               "rendering.mesh",
    "actor":              "scripting.actor",
    "component":          "scripting.component",
    "pawn":               "scripting.pawn",
    "player controller":  "scripting.player_controller",
    "spawn":              "scripting.spawn",
    "event":              "scripting.event",
    "delegate":           "scripting.delegate",
    "function":           "scripting.function",
    "variable":           "scripting.variable",
    "struct":             "scripting.struct",
    "interface":          "scripting.interface",
    "tick":               "scripting.tick",
    "timer":              "scripting.timer",
    "destroy":            "scripting.destroy",
    "reference":          "scripting.reference",
    "collision":          "physics.collision",
    "gameplay":           "scripting.gameplay",
    "plugin":             "tools.plugin",
    "character":          "character.general",
    "runtime":            "animation.runtime",
}

# ── Auto-generate display_name from tag_id ────────────────────────────
def tag_id_to_display(tag_id: str) -> str:
    """Convert 'rendering.lumen' → 'Lumen', 'ai.behavior_tree' → 'Behavior Tree'."""
    part = tag_id.split(".")[-1]  # take portion after the dot
    return part.replace("_", " ").title()

def tag_id_to_category(tag_id: str) -> str:
    prefix = tag_id.split(".")[0]
    return CATEGORY_META.get(prefix, prefix.title())

def generate_description(display_name: str, category: str) -> str:
    return f"{display_name} concepts and techniques in Unreal Engine 5 ({category})."

def main():
    # Load existing data
    with open(TAGS_PATH, "r", encoding="utf-8") as f:
        tags_data = json.load(f)
    with open(COURSES_PATH, "r", encoding="utf-8") as f:
        courses_data = json.load(f)

    existing_tags = tags_data.get("tags", [])
    courses = courses_data.get("courses", [])

    print(f"Existing tags: {len(existing_tags)}")
    print(f"Courses: {len(courses)}")

    # ── Step 1: Index existing tags, remove junk ──────────────────────
    kept_tags = {}  # tag_id → tag dict
    removed = 0
    for tag in existing_tags:
        tid = tag.get("tag_id", "").lower()
        dname = tag.get("display_name", "").lower()
        if tid in JUNK_IDS or dname in JUNK_DISPLAY_NAMES:
            print(f"  REMOVE junk: {tag.get('display_name')} ({tid})")
            removed += 1
            continue
        kept_tags[tid] = tag

    print(f"Removed {removed} junk tags, kept {len(kept_tags)}")

    # ── Step 2: Mine all tags from courses ────────────────────────────
    canonical_set = set()
    plain_set = set()
    for course in courses:
        for ct in (course.get("canonical_tags") or []):
            if isinstance(ct, str):
                canonical_set.add(ct.lower())
        for field in ("extracted_tags", "gemini_system_tags"):
            for t in (course.get(field) or []):
                if isinstance(t, str) and len(t) > 1:
                    plain_set.add(t)

    print(f"Canonical tags in courses: {len(canonical_set)}")
    print(f"Plain-name tags in courses: {len(plain_set)}")

    # ── Step 3: Generate missing tags ─────────────────────────────────
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    added = 0

    # 3a. From canonical tags
    for cid in sorted(canonical_set):
        if cid not in kept_tags:
            display = tag_id_to_display(cid)
            category = tag_id_to_category(cid)
            kept_tags[cid] = {
                "tag_id": cid,
                "display_name": display,
                "tag_type": "system",
                "category": category,
                "description": generate_description(display, category),
                "synonyms": [],
                "relevance": {
                    "global_weight": 0.7,
                    "freshness_bias_days": 180,
                    "confidence": 0.8,
                },
                "governance": {
                    "status": "active",
                    "owner": "system",
                    "created_utc": now,
                    "updated_utc": now,
                },
            }
            added += 1
            print(f"  ADD canonical: {display} ({cid})")

    # 3b. From plain names (only if no canonical match exists)
    for name in sorted(plain_set):
        lower = name.lower()
        cid = PLAIN_TO_CANONICAL.get(lower)
        if cid and cid in kept_tags:
            # Already covered by canonical — add as synonym if not present
            existing_syns = [s.lower() for s in kept_tags[cid].get("synonyms", [])]
            if lower not in existing_syns and lower != kept_tags[cid]["display_name"].lower():
                kept_tags[cid].setdefault("synonyms", []).append(name)
            continue
        if cid and cid not in kept_tags:
            # Map to canonical but it wasn't in course canonical_tags
            display = name
            category = tag_id_to_category(cid)
            kept_tags[cid] = {
                "tag_id": cid,
                "display_name": display,
                "tag_type": "extracted",
                "category": category,
                "description": generate_description(display, category),
                "synonyms": [],
                "relevance": {
                    "global_weight": 0.6,
                    "freshness_bias_days": 180,
                    "confidence": 0.7,
                },
                "governance": {
                    "status": "active",
                    "owner": "system",
                    "created_utc": now,
                    "updated_utc": now,
                },
            }
            added += 1
            print(f"  ADD mapped: {display} ({cid})")
            continue

        # No canonical mapping — skip generic single-word script concepts
        # (Actor, Variable, Event, etc. are too generic for the tag cloud)
        if not cid and lower in PLAIN_TO_CANONICAL:
            # Has a mapping but already covered above
            continue

    print(f"Added {added} new tags")

    # ── Step 4: Sort and write ────────────────────────────────────────
    final_tags = sorted(kept_tags.values(), key=lambda t: t["tag_id"])

    # Remove exact duplicates that differ only in display_name case
    seen_ids = set()
    deduped = []
    for tag in final_tags:
        if tag["tag_id"] not in seen_ids:
            deduped.append(tag)
            seen_ids.add(tag["tag_id"])

    output = {
        "$schema": tags_data.get("$schema", ""),
        "version": tags_data.get("version", "1.0.0"),
        "generated_utc": now,
        "tags": deduped,
    }

    with open(TAGS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Wrote {len(deduped)} tags to {TAGS_PATH}")
    print(f"   Removed: {removed} junk | Added: {added} new | Kept: {len(kept_tags) - added}")


if __name__ == "__main__":
    main()
