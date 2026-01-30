"""
Phase 2: Find unmatched courses and improve sparse tags using Drive context.
"""
import json
from pathlib import Path
from collections import Counter

CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')


def analyze_unmatched():
    """Find courses that didn't match Drive videos."""
    print("=" * 60)
    print("PHASE 2: CATALOG SYNC + SPARSE TAG FIX")
    print("=" * 60)
    
    # Load data
    data = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    courses = data.get('courses', [])
    drive_videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())
    
    # Find unmatched courses (no drive duration)
    unmatched = [c for c in courses if c.get('duration_source') != 'drive']
    matched = [c for c in courses if c.get('duration_source') == 'drive']
    
    print(f"\n📊 COURSE MATCHING STATUS:")
    print(f"   Matched with Drive: {len(matched)}")
    print(f"   Unmatched: {len(unmatched)}")
    
    print(f"\n❌ UNMATCHED COURSES:")
    for c in unmatched:
        print(f"   {c['code']}: {c['title'][:50]}")
    
    # Find sparse courses
    sparse = [c for c in courses if len(c.get('canonical_tags', [])) < 2]
    print(f"\n⚠️  SPARSE COURSES ({len(sparse)} with <2 tags):")
    for c in sparse[:10]:
        tags = c.get('canonical_tags', [])
        print(f"   {c['code']}: {c['title'][:40]}... ({len(tags)} tags)")
    
    # Analyze Drive folder structure for better matching
    print(f"\n📁 DRIVE FOLDER ANALYSIS:")
    folders = Counter(v['folder'] for v in drive_videos)
    print(f"   Top folders by video count:")
    for folder, count in folders.most_common(10):
        print(f"      {folder}: {count}")
    
    # Suggest tag improvements based on folder structure
    print(f"\n🏷️  TAG IMPROVEMENTS:")
    folder_to_tag = {
        'Animation': 'animation.general',
        'Blueprint': 'blueprints.general',
        'Control Rig': 'animation.controlrig',
        'Lighting': 'rendering.lighting',
        'Material': 'rendering.material',
        'Niagara': 'rendering.niagara',
        'Sequencer': 'cinematic.sequencer',
        'Optimization': 'optimization.general',
    }
    
    # For sparse courses, try to auto-add tags from folder mapping
    improved = 0
    for c in courses:
        if len(c.get('canonical_tags', [])) < 2:
            title = c.get('title', '').lower()
            for folder, tag in folder_to_tag.items():
                if folder.lower() in title:
                    if tag not in c.get('canonical_tags', []):
                        c.setdefault('canonical_tags', []).append(tag)
                        improved += 1
                        print(f"   + Added '{tag}' to {c['code']}")
    
    if improved:
        # Save updated data
        for path in [CONTENT_DIR / "video_library_enriched.json",
                     DATA_DIR / "video_library.json",
                     DATA_DIR / "video_library_enriched.json"]:
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"\n✅ Improved {improved} courses with folder-based tags")
    
    # Final summary
    sparse_after = [c for c in courses if len(c.get('canonical_tags', [])) < 2]
    print(f"\n📊 FINAL STATUS:")
    print(f"   Sparse courses: {len(sparse)} → {len(sparse_after)}")
    print(f"   Unmatched courses: {len(unmatched)}")


if __name__ == "__main__":
    analyze_unmatched()
