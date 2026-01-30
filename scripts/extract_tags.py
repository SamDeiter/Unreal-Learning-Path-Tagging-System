"""
Extract tags from transcripts using keyword matching and frequency analysis.
Uses existing tag vocabulary + detects new UE5-related terms.
"""
import json
import re
from pathlib import Path
from collections import Counter, defaultdict

CONTENT_DIR = Path("content")
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"


# UE5 terminology patterns to detect
UE5_PATTERNS = [
    r'\b(blueprint)[s]?\b',
    r'\b(material)[s]?\b',
    r'\b(shader)[s]?\b',
    r'\b(texture)[s]?\b',
    r'\b(mesh)[es]?\b',
    r'\b(static mesh)[es]?\b',
    r'\b(skeletal mesh)[es]?\b',
    r'\b(animation)[s]?\b',
    r'\b(sequencer)\b',
    r'\b(niagara)\b',
    r'\b(chaos)\b',
    r'\b(nanite)\b',
    r'\b(lumen)\b',
    r'\b(metahuman)[s]?\b',
    r'\b(landscape)[s]?\b',
    r'\b(foliage)\b',
    r'\b(level design)\b',
    r'\b(lighting)\b',
    r'\b(post process)\b',
    r'\b(rendering)\b',
    r'\b(physics)\b',
    r'\b(collision)[s]?\b',
    r'\b(ai)\b',
    r'\b(behavior tree)[s]?\b',
    r'\b(gameplay)\b',
    r'\b(player controller)\b',
    r'\b(character)\b',
    r'\b(pawn)\b',
    r'\b(actor)[s]?\b',
    r'\b(component)[s]?\b',
    r'\b(widget)[s]?\b',
    r'\b(umg|ui)\b',
    r'\b(hud)\b',
    r'\b(audio)\b',
    r'\b(sound)[s]?\b',
    r'\b(particle)[s]?\b',
    r'\b(vfx)\b',
    r'\b(cinematics)\b',
    r'\b(world partition)\b',
    r'\b(data asset)[s]?\b',
    r'\b(data table)[s]?\b',
    r'\b(enum)[s]?\b',
    r'\b(struct)[s]?\b',
    r'\b(interface)[s]?\b',
    r'\b(event)[s]?\b',
    r'\b(delegate)[s]?\b',
    r'\b(timer)[s]?\b',
    r'\b(spawn)\b',
    r'\b(destroy)\b',
    r'\b(tick)\b',
    r'\b(begin play)\b',
    r'\b(construction script)\b',
    r'\b(variable)[s]?\b',
    r'\b(function)[s]?\b',
    r'\b(macro)[s]?\b',
    r'\b(casting)\b',
    r'\b(reference)[s]?\b',
    r'\b(viewport)\b',
    r'\b(editor)\b',
    r'\b(plugin)[s]?\b',
    r'\b(c\+\+)\b',
    r'\b(python)\b',
    r'\b(pcg)\b',  # Procedural Content Generation
    r'\b(procedural)\b',
    r'\b(runtime)\b',
    r'\b(packaging)\b',
    r'\b(optimization)\b',
    r'\b(performance)\b',
    r'\b(profiling)\b',
    r'\b(debugging)\b',
    r'\b(multiplayer)\b',
    r'\b(replication)\b',
    r'\b(network)\b',
]


def extract_tags_from_text(text):
    """Extract UE5-related tags from transcript text."""
    text_lower = text.lower()
    found_tags = Counter()
    
    for pattern in UE5_PATTERNS:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        for match in matches:
            # Normalize tag
            tag = match.strip().title()
            found_tags[tag] += 1
    
    return found_tags


def main():
    # Load video metadata for mapping
    videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())
    code_pattern = re.compile(r'^(\d{3}\.\d{2})')
    video_map = {v['id']: code_pattern.match(v['name']).group(1) 
                 for v in videos if code_pattern.match(v['name'])}
    
    # Load existing tags
    tags_path = CONTENT_DIR / "tags.json"
    existing_tags = {}
    if tags_path.exists():
        tags_data = json.loads(tags_path.read_text())
        existing_tags = {t['name'].lower(): t for t in tags_data.get('tags', [])}
        print(f"Loaded {len(existing_tags)} existing tags")
    
    # Process transcripts by course
    course_transcripts = defaultdict(str)
    transcript_files = list(TRANSCRIPTS_DIR.glob("*.json"))
    print(f"Processing {len(transcript_files)} transcripts...")
    
    for f in transcript_files:
        video_id = f.stem
        if video_id not in video_map:
            continue
        code = video_map[video_id]
        try:
            data = json.loads(f.read_text())
            course_transcripts[code] += " " + data.get('text', '')
        except:
            continue
    
    print(f"Indexed {len(course_transcripts)} courses")
    
    # Extract tags for each course
    course_tags = {}
    all_tags = Counter()
    
    for code, text in course_transcripts.items():
        tags = extract_tags_from_text(text)
        # Keep only tags mentioned 3+ times
        significant_tags = {k: v for k, v in tags.items() if v >= 3}
        course_tags[code] = significant_tags
        all_tags.update(tags)
    
    # Report top tags
    print(f"\nTop 20 tags across all transcripts:")
    for tag, count in all_tags.most_common(20):
        print(f"  {tag}: {count}")
    
    # Update course data with extracted tags
    library = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    
    updated = 0
    for course in library['courses']:
        code = course['code']
        if code in course_tags and course_tags[code]:
            # Add extracted tags (top 10 by frequency)
            extracted = [t for t, _ in sorted(course_tags[code].items(), 
                                              key=lambda x: -x[1])[:10]]
            course['extracted_tags'] = extracted
            updated += 1
    
    print(f"\nUpdated {updated} courses with extracted tags")
    
    # Save updated library
    (CONTENT_DIR / "video_library_enriched.json").write_text(
        json.dumps(library, indent=2)
    )
    Path("path-builder/src/data/video_library.json").write_text(
        json.dumps(library, indent=2)
    )
    Path("path-builder/src/data/video_library_enriched.json").write_text(
        json.dumps(library, indent=2)
    )
    
    # Save tag extraction results
    results = {
        'course_tags': course_tags,
        'all_tags': dict(all_tags),
        'courses_tagged': updated
    }
    (CONTENT_DIR / "extracted_tags.json").write_text(json.dumps(results, indent=2))
    
    print(f"\nSaved extracted tags to content/extracted_tags.json")


if __name__ == "__main__":
    main()
