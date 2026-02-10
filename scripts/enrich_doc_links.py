"""
enrich_doc_links.py — Add 'description' field to doc_links.json entries.
Derives descriptions from URL slugs + labels without network calls.
"""
import json
import re
from pathlib import Path

DOC_LINKS_PATH = Path(__file__).parent.parent / "path-builder" / "src" / "data" / "doc_links.json"

# Manual overrides for important/common topics where slug-derived text is insufficient
MANUAL_DESCRIPTIONS = {
    "nanite": "Nanite is UE5's virtualized geometry system that intelligently streams and renders billions of polygons in real time with automatic LOD management.",
    "lumen": "Lumen provides fully dynamic global illumination and reflections, enabling realistic lighting that reacts to scene and geometry changes in real time.",
    "blueprint": "Blueprints are UE5's node-based visual scripting system, allowing designers and artists to create gameplay logic without writing C++ code.",
    "niagara": "Niagara is UE5's modular VFX system for creating particle effects, simulations, and data-driven visual effects with full GPU acceleration.",
    "world_partition": "World Partition is UE5's streaming system for managing large open worlds, automatically loading and unloading level regions based on distance.",
    "mass_entity": "Mass Entity is a lightweight ECS (Entity Component System) framework in UE5 for managing large numbers of entities efficiently.",
    "chaos_physics": "Chaos is UE5's built-in physics and destruction system, handling rigid body simulation, cloth, vehicles, and real-time destruction.",
    "metasound": "MetaSounds is a high-performance, node-based audio system for procedural sound design and dynamic music in UE5.",
    "pcg": "The Procedural Content Generation (PCG) framework enables rule-based, data-driven generation of environments, props, and landscape features.",
    "virtual_shadow_maps": "Virtual Shadow Maps provide high-resolution, efficient shadow rendering that works with Nanite geometry for consistent shadow quality.",
    "control_rig": "Control Rig is a node-based rigging system for creating procedural and runtime skeletal animation controls.",
    "landscape": "Covers UE5's terrain system for creating and sculpting large outdoor environments with multiple material layers and LOD support.",
    "material_editor": "The Material Editor is a node-based tool for creating shader graphs that define surface appearance, from simple colors to complex PBR effects.",
    "animation_blueprint": "Animation Blueprints drive skeletal mesh animation using state machines, blend spaces, and layered animation logic.",
    "umg": "Unreal Motion Graphics (UMG/UMG UI) is UE5's widget-based system for building in-game HUDs, menus, and interactive UI elements.",
    "gameplay_ability_system": "The Gameplay Ability System (GAS) is a flexible framework for implementing abilities, attributes, effects, and gameplay tags.",
    "enhanced_input": "Enhanced Input is UE5's modern input mapping system that replaces the legacy input system with context-based, rebindable actions.",
    "data_assets": "Data Assets are standalone blueprint-like objects for storing game configuration, item databases, and reusable data tables.",
    "sequencer": "Sequencer is UE5's cinematic editor for creating cutscenes, in-game cinematics, and timeline-based animations.",
    "level_streaming": "Level Streaming allows portions of a map to be loaded and unloaded dynamically, managing memory and performance in large worlds.",
    "subsystem": "Subsystems are auto-instanced singletons scoped to Engine, Editor, GameInstance, World, or LocalPlayer lifecycles.",
    "smart_object": "Smart Objects define interaction points in the world that AI agents and players can discover and use through defined behaviors.",
    "state_tree": "State Tree is a flexible, hierarchical state machine for AI decision-making that combines behavior tree and state machine patterns.",
    "motion_matching": "Motion Matching selects the best animation pose from a database at runtime, producing fluid, responsive character movement.",
    "geometry_scripting": "Geometry Scripting provides Blueprint and Python access to mesh editing operations for runtime and editor-time geometry manipulation.",
}


def slug_to_description(key, entry):
    """Derive a human-readable description from the doc entry's metadata."""
    # Check manual overrides first
    if key in MANUAL_DESCRIPTIONS:
        return MANUAL_DESCRIPTIONS[key]

    label = entry.get("label", key)
    url = entry.get("url", "")
    tier = entry.get("tier", "intermediate")
    subsystem = entry.get("subsystem", "")

    # Extract meaningful words from URL slug
    slug = url.split("/")[-1] if "/" in url else ""
    slug_words = slug.replace("-", " ").replace("_", " ").strip()

    # Remove "in unreal engine" suffix from slug
    slug_words = re.sub(r"\s+in\s+unreal\s+engine.*$", "", slug_words, flags=re.IGNORECASE)
    slug_words = re.sub(r"\s+for\s+unreal\s+engine.*$", "", slug_words, flags=re.IGNORECASE)

    # Build description
    # If label and slug are very similar, just use label-based description
    label_lower = label.lower().replace(" ", "")
    slug_lower = slug_words.lower().replace(" ", "")

    if slug_lower and label_lower != slug_lower and len(slug_words) > len(label) * 0.5:
        # Slug has additional info — combine
        desc = f"Official documentation covering {slug_words}."
    else:
        desc = f"Official documentation on {label}."

    # Add tier context
    tier_context = {
        "beginner": " Suitable for beginners getting started with this system.",
        "intermediate": "",
        "advanced": " Covers advanced concepts and implementation details.",
    }
    desc += tier_context.get(tier, "")

    # Add subsystem context if different from key
    if subsystem and subsystem != key and subsystem.lower() not in desc.lower():
        desc = desc.rstrip(".") + f" (part of the {subsystem} subsystem)."

    return desc


def main():
    with open(DOC_LINKS_PATH, "r", encoding="utf-8") as f:
        doc_links = json.load(f)

    print(f"Processing {len(doc_links)} doc entries...")

    enriched = 0
    for key, entry in doc_links.items():
        if "description" not in entry or not entry["description"]:
            entry["description"] = slug_to_description(key, entry)
            enriched += 1

    with open(DOC_LINKS_PATH, "w", encoding="utf-8") as f:
        json.dump(doc_links, f, indent=2, ensure_ascii=False)

    print(f"✅ Enriched {enriched} / {len(doc_links)} entries with descriptions.")

    # Validate
    missing = [k for k, v in doc_links.items() if not v.get("description")]
    if missing:
        print(f"⚠️  {len(missing)} entries still missing descriptions: {missing[:5]}")
    else:
        print("✅ All entries have descriptions.")

    # Show some samples
    print("\nSample descriptions:")
    for key in list(doc_links.keys())[:5]:
        desc = doc_links[key].get("description", "")
        print(f"  {key}: {desc[:100]}...")


if __name__ == "__main__":
    main()
