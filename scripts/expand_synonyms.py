"""
expand_synonyms.py — Expands synonym coverage across tags.json for better matching recall.

Adds common UE5 community terms, natural language phrases, and related search terms
to each tag's synonyms array. Only adds new entries (no duplicates).

Usage:
  python scripts/expand_synonyms.py
"""

import json
import os
import shutil
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS_PATH = os.path.join(ROOT, "tags", "tags.json")
SAMPLE_TAGS = os.path.join(ROOT, "sample_data", "tags.json")

# ---- Synonym expansions keyed by tag_id ----
# Each list contains new synonyms to ADD (existing ones are preserved)
SYNONYM_EXPANSIONS = {
    # ── Scripting ──
    "scripting.cpp": [
        "unreal c++ programming", "native code", "source code", "header files",
        "gameplay classes", "UCLASS", "UPROPERTY", "UFUNCTION",
    ],
    "scripting.blueprint": [
        "visual scripting", "node graph", "event graph", "blueprint graph",
        "blueprint editor", "BP node", "visual programming", "node-based",
    ],
    "scripting.anim_blueprint": [
        "animation blueprint", "ABP", "anim graph", "state machine",
        "blend space", "animation logic",
    ],
    "scripting.python": [
        "python scripting", "python editor", "editor utility", "automation",
        "batch processing", "editor script",
    ],
    "scripting.gameplay_tags": [
        "gameplay tag", "tag container", "tag query", "game tag",
        "native gameplay tag",
    ],

    # ── Rendering ──
    "rendering.lumen": [
        "global illumination", "gi", "indirect lighting", "path tracing",
        "lumen reflections", "screen traces", "hardware ray tracing gi",
        "software ray tracing", "final gather",
    ],
    "rendering.nanite": [
        "virtual geometry", "micro polygon", "mesh optimization",
        "nanite mesh", "virtualized geometry", "high poly rendering",
        "triangle streaming",
    ],
    "rendering.niagara": [
        "particle system", "vfx", "visual effects", "cascade replacement",
        "particle emitter", "GPU particles", "niagara emitter",
        "niagara system", "particle simulation",
    ],
    "rendering.material": [
        "shader", "material editor", "material instance", "PBR material",
        "material function", "material parameter", "shader graph",
        "surface shader", "material expression",
    ],
    "rendering.lighting": [
        "light source", "point light", "spot light", "directional light",
        "light baking", "lightmass", "volumetric lighting",
        "light function", "IES profile",
    ],
    "rendering.raytracing": [
        "ray tracing", "RTX", "DXR", "hardware ray tracing",
        "ray traced shadows", "ray traced reflections",
        "path tracing mode",
    ],
    "rendering.vsm": [
        "virtual shadow map", "shadow rendering", "shadow quality",
        "shadow cascades", "contact shadows",
    ],

    # ── Animation ──
    "animation.general": [
        "skeletal mesh", "animation montage", "anim sequence", "motion",
        "skeletal animation", "character animation", "animation asset",
        "anim notify", "animation curve",
    ],
    "animation.control_rig": [
        "control rig", "procedural animation", "full body IK",
        "rig setup", "bone manipulation", "runtime rigging",
    ],
    "animation.epic_skeleton": [
        "epic skeleton", "mannequin", "UE5 mannequin", "Manny",
        "Quinn", "SK_Mannequin", "default skeleton",
    ],
    "animation.state_machine": [
        "state machine", "anim state", "transition rule",
        "animation transition", "conduit", "state graph",
    ],

    # ── Environment ──
    "environment.landscape": [
        "terrain", "heightmap", "landscape material", "world machine",
        "landscape splines", "landscape layer", "terrain sculpting",
    ],
    "environment.level_design": [
        "level design", "game level", "world building", "map design",
        "level layout", "BSP", "geometry editing",
    ],
    "environment.pcg": [
        "procedural content generation", "procedural generation",
        "PCG graph", "rule-based generation", "procedural placement",
    ],
    "environment.foliage": [
        "foliage painting", "instanced foliage", "vegetation",
        "grass rendering", "tree placement", "foliage LOD",
    ],

    # ── Multiplayer ──
    "multiplayer.replication": [
        "networking", "net code", "replication graph", "dedicated server",
        "client server", "server authoritative", "multiplayer networking",
        "replicated variable", "network relevancy",
    ],
    "multiplayer.rpc": [
        "remote procedure call", "server RPC", "client RPC",
        "multicast", "reliable RPC", "unreliable RPC",
    ],

    # ── AI ──
    "ai.behavior_tree": [
        "AI controller", "blackboard", "EQS", "environment query",
        "AI task", "behavior tree node", "decorator", "service node",
        "AI perception", "AI logic",
    ],
    "ai.navigation": [
        "navmesh", "navigation mesh", "pathfinding", "nav link",
        "navigation volume", "AI movement", "crowd simulation",
    ],

    # ── Build / Packaging ──
    "build.packaging": [
        "cooking", "pak files", "shipping", "distribution",
        "build configuration", "target platform", "content cooking",
        "staged build", "packaged game",
    ],

    # ── Crashes / Symptoms ──
    "crash.d3d_device_lost": [
        "GPU crash", "D3D device lost", "graphics device removed",
        "TDR", "driver timeout", "gpu hang",
    ],
    "crash.access_violation": [
        "crash", "null pointer", "segfault", "memory corruption",
        "unhandled exception", "fatal error",
    ],
    "crash.gpu": [
        "GPU error", "graphics crash", "video memory", "VRAM",
        "out of video memory", "GPU timeout",
    ],

    # ── Blueprint Errors ──
    "blueprint.accessed_none": [
        "accessed none", "null reference", "invalid object",
        "object not valid", "blueprint error",
    ],
    "blueprint.infinite_loop": [
        "infinite loop", "script timeout", "recursion",
        "execution halted", "runaway loop",
    ],

    # ── UI ──
    "ui.umg": [
        "UMG", "user interface", "widget", "UI design",
        "widget blueprint", "HUD widget", "slate",
    ],
    "ui.hud": [
        "heads up display", "in-game UI", "game HUD",
        "gameplay UI", "screen overlay",
    ],

    # ── Characters ──
    "character.metahuman": [
        "MetaHuman", "digital human", "realistic character",
        "MetaHuman Creator", "photo realistic face",
    ],

    # ── Cinematic ──
    "cinematic.sequencer": [
        "sequencer", "cutscene", "cinematic", "movie render queue",
        "level sequence", "camera animation", "matinee replacement",
    ],

    # ── Platforms ──
    "platform.vr": [
        "virtual reality", "VR headset", "VR development",
        "XR", "head mounted display", "HMD",
    ],
    "platform.quest": [
        "Meta Quest", "Oculus Quest", "Quest 2", "Quest 3",
        "Quest Pro", "standalone VR", "mobile VR",
    ],
    "platform.windows": [
        "Windows", "PC", "desktop", "Win64",
        "Windows build",
    ],
    "platform.mobile": [
        "mobile", "iOS", "Android", "mobile game",
        "mobile optimization", "touch input",
    ],

    # ── Tools ──
    "tool.uat": [
        "Unreal Automation Tool", "UAT", "build automation",
        "RunUAT", "automation tool",
    ],
    "tool.ubt": [
        "Unreal Build Tool", "UBT", "build tool",
        "compilation", "build system",
    ],

    # ── Debug ──
    "debug.callstack": [
        "call stack", "stack trace", "backtrace",
        "crash log", "minidump",
    ],
    "debug.symbols": [
        "debug symbols", "PDB files", "symbol files",
        "debugging info", "debug build",
    ],
    "debug.output_log": [
        "output log", "log file", "UE_LOG",
        "print string", "console output", "log message",
    ],

    # ── Genres ──
    "genre.fps": [
        "first person shooter", "FPS game", "shooter",
        "first person", "gun game",
    ],
    "genre.rpg": [
        "role playing game", "RPG game", "inventory system",
        "quest system", "dialogue system",
    ],
    "genre.survival": [
        "survival game", "crafting", "resource gathering",
        "base building", "survival mechanics",
    ],
    "genre.rts": [
        "real time strategy", "strategy game", "RTS game",
        "unit selection", "fog of war",
    ],

    # ── Styles ──
    "style.realistic": [
        "photorealistic", "realistic graphics", "AAA visuals",
        "film quality", "realistic rendering",
    ],
    "style.stylized": [
        "stylized art", "toon shading", "cel shading",
        "cartoon style", "non-photorealistic",
    ],
    "style.low_poly": [
        "low poly", "low polygon", "simple geometry",
        "mobile friendly", "performance art",
    ],

    # ── XR ──
    "xr.openxr": [
        "OpenXR", "XR runtime", "cross-platform VR",
        "XR plugin", "VR API",
    ],

    # ── Specialty ──
    "specialty.archviz": [
        "architectural visualization", "arch viz", "real estate",
        "interior design", "building walkthrough",
    ],
    "specialty.dmx": [
        "DMX lighting", "stage lighting", "live events",
        "virtual production", "LED wall",
    ],

    # ── Physics ──
    "physics.chaos": [
        "chaos physics", "destruction", "physics simulation",
        "rigid body", "chaos destruction", "physics solver",
    ],

    # ── Templates ──
    "template.lyra": [
        "Lyra", "Lyra starter", "sample project",
        "Lyra game", "Epic sample",
    ],

    # ── Symptoms ──
    "symptom.lumen_noise": [
        "lumen noise", "flickering", "lumen artifacts",
        "GI noise", "reflection noise", "fireflies",
    ],
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main():
    print("📝 Expanding synonym coverage in tags.json\n")

    tags_data = load_json(TAGS_PATH)
    tags = tags_data["tags"]

    tag_map = {t["tag_id"]: t for t in tags}

    total_added = 0
    tags_updated = 0

    for tag_id, new_synonyms in SYNONYM_EXPANSIONS.items():
        tag = tag_map.get(tag_id)
        if not tag:
            print(f"  ⚠️  Tag '{tag_id}' not found — skipping")
            continue

        existing = set(s.lower() for s in tag.get("synonyms", []))
        added = []

        for syn in new_synonyms:
            if syn.lower() not in existing:
                tag.setdefault("synonyms", []).append(syn)
                existing.add(syn.lower())
                added.append(syn)

        if added:
            tags_updated += 1
            total_added += len(added)
            print(f"  ✅ {tag_id}: +{len(added)} synonyms")

    # Update timestamp
    tags_data["generated_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Save
    save_json(TAGS_PATH, tags_data)
    print(f"\n  💾 Saved tags/tags.json")

    shutil.copy2(TAGS_PATH, SAMPLE_TAGS)
    print(f"  📋 Synced → sample_data/tags.json")

    print(f"\n✅ Done! {total_added} synonyms added across {tags_updated} tags")


if __name__ == "__main__":
    main()
