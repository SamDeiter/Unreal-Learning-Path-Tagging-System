"""Tag Schema Cleanup Script.

Cleans up the tag system for better learning path decision-making:
1. Removes unused schema tags (error codes, debugging)
2. Expands synonym matching for AI tags
3. Adds video counts to tags
4. Filters noise AI tags
"""

import json
from collections import Counter
from pathlib import Path

# Paths
CONTENT_DIR = Path("content")
DATA_DIR = Path("path-builder/src/data")

# Noise AI tags to filter out (too generic to be useful)
NOISE_TAGS = {
    'button', 'tool', 'editor', 'level', 'actor', 'node', 'graph',
    'menu', 'component', 'function', 'volume', 'body', 'focus',
    'controller', 'build', 'console', 'plugin', 'density', 'setting',
    'pgt', '1', '2', '3', '4', '5', '00', '01', '02', '03', '04', '05',
    'thankyou', 'intro', 'outro', 'overview', 'introduction',
}

# Expanded synonym mappings (AI tag -> canonical tag)
EXPANDED_SYNONYMS = {
    # Rendering
    'camera': 'cinematic.sequencer',
    'lighting': 'rendering.lighting',
    'light': 'rendering.lighting',
    'nanite': 'rendering.nanite',
    'ray tracing': 'rendering.raytracing',
    'raytracing': 'rendering.raytracing',
    'post process': 'rendering.postprocess',
    'exposure': 'rendering.postprocess',
    'shadow': 'rendering.lighting',
    'virtual shadow': 'rendering.vsm',

    # Materials
    'material': 'rendering.material',
    'texture': 'rendering.material',
    'shader': 'rendering.material',

    # Animation
    'animation': 'animation.general',
    'skeletal': 'animation.general',
    'bone': 'animation.general',
    'control rig': 'animation.control_rig',
    'ik': 'animation.control_rig',
    'retarget': 'animation.retargeting',

    # Scripting
    'blueprint': 'scripting.blueprint',
    'bp': 'scripting.blueprint',
    'c++': 'scripting.cpp',
    'cpp': 'scripting.cpp',
    'python': 'scripting.python',

    # Cinematics
    'sequencer': 'cinematic.sequencer',
    'sequence': 'cinematic.sequencer',
    'movie render': 'cinematic.movie_render',

    # Environment
    'landscape': 'environment.landscape',
    'terrain': 'environment.landscape',
    'foliage': 'environment.foliage',
    'grass': 'environment.foliage',
    'water': 'environment.water',
    'ocean': 'environment.water',
    'river': 'environment.water',

    # VFX
    'niagara': 'vfx.niagara',
    'particle': 'vfx.niagara',
    'emitter': 'vfx.niagara',

    # Procedural
    'pcg': 'procedural.pcg',
    'procedural': 'procedural.pcg',

    # Audio
    'audio': 'audio.metasounds',
    'sound': 'audio.metasounds',
    'metasound': 'audio.metasounds',

    # UI
    'widget': 'ui.umg',
    'umg': 'ui.umg',
    'hud': 'ui.hud',
    'menu': 'ui.umg',

    # Physics
    'physics': 'physics.general',
    'collision': 'physics.general',
    'chaos': 'physics.chaos',

    # Gameplay
    'gameplay ability': 'gameplay.gas',
    'gas': 'gameplay.gas',
    'gameplay tag': 'gameplay.tags',

    # World
    'world partition': 'world.partition',
    'level streaming': 'world.streaming',
    'hlod': 'world.hlod',
    'lod': 'optimization.lod',

    # Platforms
    'android': 'platform.android',
    'ios': 'platform.ios',
    'console': 'platform.console',

    # Misc
    'lumen': 'rendering.lumen',
    'spline': 'scripting.blueprint',
}

# Tag types to remove from schema (not useful for course selection)
REMOVE_TAG_TYPES = {'error_code', 'symptom'}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def save_json(path: Path, data: dict):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')


def clean_schema_tags(schema: dict) -> tuple[dict, int]:
    """Remove unused tag types from schema."""
    original_count = len(schema.get('tags', []))

    # Filter out error codes and symptoms
    cleaned_tags = [
        t for t in schema.get('tags', [])
        if t.get('tag_type') not in REMOVE_TAG_TYPES
    ]

    schema['tags'] = cleaned_tags
    removed = original_count - len(cleaned_tags)
    return schema, removed


def filter_noise_tags(ai_tags: list) -> list:
    """Remove noise tags from AI tag list."""
    return [t for t in ai_tags if t.lower() not in NOISE_TAGS]


def expand_canonical_tags(ai_tags: list, existing_canonical: list) -> list:
    """Expand canonical tags using improved synonym matching."""
    canonical_set = set(existing_canonical)

    for ai_tag in ai_tags:
        ai_lower = ai_tag.lower()
        if ai_lower in EXPANDED_SYNONYMS:
            canonical_set.add(EXPANDED_SYNONYMS[ai_lower])

    return sorted(canonical_set)


def count_tags_per_course(courses: list) -> Counter:
    """Count how many courses use each canonical tag."""
    tag_counts = Counter()
    for course in courses:
        for tag in course.get('canonical_tags', []):
            tag_counts[tag] += 1
    return tag_counts


def add_counts_to_schema(schema: dict, tag_counts: Counter) -> dict:
    """Add video_count metadata to each schema tag."""
    for tag in schema.get('tags', []):
        tag_id = tag.get('tag_id')
        tag['video_count'] = tag_counts.get(tag_id, 0)
    return schema


def main():
    print("=" * 60)
    print("TAG SCHEMA CLEANUP")
    print("=" * 60)

    # Load data
    print("\n📂 Loading data...")
    enriched_path = CONTENT_DIR / "video_library_enriched.json"
    schema_path = DATA_DIR / "tags.json"

    enriched_data = load_json(enriched_path)
    schema = load_json(schema_path)

    courses = enriched_data.get('courses', [])
    print(f"   Loaded {len(courses)} courses")
    print(f"   Schema has {len(schema.get('tags', []))} tags")

    # Step 1: Clean schema tags
    print("\n🧹 Step 1: Removing unused tag types...")
    schema, removed = clean_schema_tags(schema)
    print(f"   Removed {removed} error/symptom tags")
    print(f"   Schema now has {len(schema.get('tags', []))} tags")

    # Step 2: Filter noise and expand canonical tags
    print("\n🔗 Step 2: Filtering noise and expanding matches...")
    total_filtered = 0
    total_expanded = 0

    for course in courses:
        original_ai = course.get('ai_tags', [])
        original_canonical = course.get('canonical_tags', [])

        # Filter noise
        filtered_ai = filter_noise_tags(original_ai)
        total_filtered += len(original_ai) - len(filtered_ai)
        course['ai_tags'] = filtered_ai

        # Expand canonical
        expanded_canonical = expand_canonical_tags(filtered_ai, original_canonical)
        total_expanded += len(expanded_canonical) - len(original_canonical)
        course['canonical_tags'] = expanded_canonical

    print(f"   Filtered {total_filtered} noise AI tags")
    print(f"   Expanded {total_expanded} new canonical tag matches")

    # Step 3: Count and add to schema
    print("\n📊 Step 3: Adding video counts to schema...")
    tag_counts = count_tags_per_course(courses)
    schema = add_counts_to_schema(schema, tag_counts)

    used_tags = sum(1 for t in schema.get('tags', []) if t.get('video_count', 0) > 0)
    print(f"   {used_tags} tags have video content")
    print("   Top 5 tags by count:")
    for tag_id, count in tag_counts.most_common(5):
        print(f"      {tag_id}: {count} courses")

    # Save results
    print("\n💾 Saving results...")
    save_json(enriched_path, enriched_data)
    save_json(schema_path, schema)

    # Copy to path-builder
    save_json(DATA_DIR / "video_library.json", enriched_data)

    print(f"   ✅ Saved: {enriched_path}")
    print(f"   ✅ Saved: {schema_path}")

    print("\n" + "=" * 60)
    print("✅ CLEANUP COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
