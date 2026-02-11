"""Fix Data Quality Issues.

Fixes:
1. Missing canonical tags (24 courses)
2. Duplicate course codes
3. Re-runs synonym matching for sparse courses
"""

import json
from pathlib import Path

# Expanded synonym mappings
EXPANDED_SYNONYMS = {
    # Rendering
    'camera': 'cinematic.sequencer', 'lighting': 'rendering.lighting', 'light': 'rendering.lighting',
    'nanite': 'rendering.nanite', 'ray tracing': 'rendering.raytracing', 'raytracing': 'rendering.raytracing',
    'post process': 'rendering.postprocess', 'exposure': 'rendering.postprocess', 'shadow': 'rendering.lighting',
    'virtual shadow': 'rendering.vsm', 'material': 'rendering.material', 'texture': 'rendering.material',
    'shader': 'rendering.material', 'lumen': 'rendering.lumen',
    # Animation
    'animation': 'animation.general', 'skeletal': 'animation.general', 'bone': 'animation.general',
    'control rig': 'animation.control_rig', 'controlrig': 'animation.control_rig', 'ik': 'animation.control_rig',
    'retarget': 'animation.retargeting', 'mocap': 'animation.mocap',
    # Scripting
    'blueprint': 'scripting.blueprint', 'bp': 'scripting.blueprint', 'c++': 'scripting.cpp',
    'cpp': 'scripting.cpp', 'python': 'scripting.python',
    # Cinematics
    'sequencer': 'cinematic.sequencer', 'sequence': 'cinematic.sequencer', 'movie render': 'cinematic.movie_render',
    'render queue': 'cinematic.movie_render',
    # Environment
    'landscape': 'environment.landscape', 'terrain': 'environment.landscape', 'foliage': 'environment.foliage',
    'grass': 'environment.foliage', 'water': 'environment.water', 'ocean': 'environment.water',
    'river': 'environment.water',
    # VFX
    'niagara': 'vfx.niagara', 'particle': 'vfx.niagara', 'emitter': 'vfx.niagara', 'vfx': 'vfx.niagara',
    'fx': 'vfx.niagara',
    # Procedural
    'pcg': 'procedural.pcg', 'procedural': 'procedural.pcg',
    # Audio
    'audio': 'audio.metasounds', 'sound': 'audio.metasounds', 'metasound': 'audio.metasounds',
    # UI
    'widget': 'ui.umg', 'umg': 'ui.umg', 'hud': 'ui.hud', 'hmi': 'ui.umg', 'ui': 'ui.umg',
    # Physics
    'physics': 'physics.general', 'collision': 'physics.general', 'chaos': 'physics.chaos',
    # World
    'world partition': 'world.partition', 'level streaming': 'world.streaming', 'hlod': 'world.hlod',
    'lod': 'optimization.lod',
    # Optimization
    'optimization': 'optimization.general', 'profiling': 'optimization.profiling', 'mobile': 'platform.mobile',
    'performance': 'optimization.general',
    # Platforms
    'android': 'platform.android', 'ios': 'platform.ios', 'console': 'platform.console', 'aec': 'industry.aec',
    'automotive': 'industry.automotive',
}

def expand_canonical(ai_tags: list, existing: list) -> list:
    """Generate canonical tags from AI tags."""
    canonical = set(existing)

    for tag in ai_tags:
        tag_lower = tag.lower()
        if tag_lower in EXPANDED_SYNONYMS:
            canonical.add(EXPANDED_SYNONYMS[tag_lower])
        # Check partial matches
        for key, value in EXPANDED_SYNONYMS.items():
            if key in tag_lower:
                canonical.add(value)

    return sorted(canonical)


def main():
    print("=" * 60)
    print("FIXING DATA QUALITY ISSUES")
    print("=" * 60)

    path = Path("content/video_library_enriched.json")
    data = json.loads(path.read_text())
    courses = data.get('courses', [])

    # 1. Remove duplicates
    print("\n🔧 Removing duplicates...")
    seen_codes = set()
    unique_courses = []
    duplicates_removed = 0

    for course in courses:
        code = course.get('code')
        if code not in seen_codes:
            seen_codes.add(code)
            unique_courses.append(course)
        else:
            duplicates_removed += 1
            print(f"   Removed duplicate: {code}")

    print(f"   Removed {duplicates_removed} duplicates")
    data['courses'] = unique_courses
    courses = unique_courses

    # 2. Fix missing canonical tags
    print("\n🔧 Expanding canonical tags for all courses...")
    fixed_count = 0

    for course in courses:
        ai_tags = course.get('ai_tags', [])
        existing = course.get('canonical_tags', [])
        title = course.get('title', '').lower()

        # Add title words to matching pool
        title_words = title.replace('-', ' ').replace('_', ' ').split()
        all_tags = ai_tags + title_words

        new_canonical = expand_canonical(all_tags, existing)

        if len(new_canonical) > len(existing):
            fixed_count += 1
            course['canonical_tags'] = new_canonical

    print(f"   Expanded tags for {fixed_count} courses")

    # 3. Ensure has_ai_tags is set
    print("\n🔧 Ensuring has_ai_tags field...")
    for course in courses:
        has_tags = len(course.get('ai_tags', [])) > 0 or len(course.get('canonical_tags', [])) > 0
        course['has_ai_tags'] = has_tags

    # Report results
    still_sparse = [c for c in courses if len(c.get('canonical_tags', [])) < 2]
    print("\n📊 RESULTS")
    print(f"   Total courses: {len(courses)}")
    print(f"   Still sparse (<2 canonical): {len(still_sparse)}")

    if still_sparse:
        print("\n   Remaining sparse courses:")
        for c in still_sparse[:10]:
            print(f"      {c['code']}: {c['title'][:35]}... - tags: {c.get('canonical_tags', [])}")

    # Save to all locations
    for p in [Path("content/video_library_enriched.json"),
              Path("path-builder/src/data/video_library.json"),
              Path("path-builder/src/data/video_library_enriched.json")]:
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print("\n💾 Saved to all data files")
    print("\n" + "=" * 60)
    print("✅ FIXES COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
