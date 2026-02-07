"""Build search index from transcripts for fast full-text search.

v2: Adds playability filter - only indexes courses with playable videos (drive_id present).
Also adds a cross-check report for playable courses missing transcript coverage.
"""
import json
import re
from pathlib import Path
from collections import defaultdict

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = REPO_ROOT / "content"
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"
VIDEO_LIBRARY = REPO_ROOT / "path-builder" / "src" / "data" / "video_library_enriched.json"

def tokenize(text):
    """Simple tokenizer - lowercase and split on non-alphanumeric."""
    return re.findall(r'\b[a-z0-9]+\b', text.lower())

def get_playable_codes():
    """Get set of course codes that have playable videos (drive_id present)."""
    lib = json.loads(VIDEO_LIBRARY.read_text(encoding="utf-8"))
    courses = lib if isinstance(lib, list) else lib.get("courses", [])
    playable = set()
    for c in courses:
        vids = c.get("videos", [])
        if vids and vids[0].get("drive_id"):
            playable.add(c.get("code", ""))
    return playable

def build_index():
    playable_codes = get_playable_codes()
    print(f"Playable courses (with drive_id): {len(playable_codes)}")

    # Load video metadata for mapping
    metadata_path = CONTENT_DIR / "drive_video_metadata_final.json"
    if not metadata_path.exists():
        print(f"ERROR: {metadata_path} not found")
        return

    videos = json.loads(metadata_path.read_text(encoding="utf-8"))
    code_pattern = re.compile(r'^(\d{3}\.\d{2})')
    video_map = {}
    for v in videos:
        match = code_pattern.match(v['name'])
        if match:
            video_map[v['id']] = {
                'code': match.group(1),
                'name': v['name']
            }
    
    # Build inverted index: word -> [(course_code, count)]
    inverted_index = defaultdict(list)
    course_transcripts = defaultdict(str)
    
    # Load all transcripts
    transcript_files = list(TRANSCRIPTS_DIR.glob("*.json"))
    print(f"Processing {len(transcript_files)} transcript files...")
    
    skipped_unplayable = set()

    for f in transcript_files:
        video_id = f.stem
        if video_id not in video_map:
            continue
            
        code = video_map[video_id]['code']

        # PLAYABILITY FILTER: skip courses without playable videos
        if code not in playable_codes:
            skipped_unplayable.add(code)
            continue
        
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            text = data.get('text', '')
            course_transcripts[code] += " " + text
        except Exception:
            continue
    
    if skipped_unplayable:
        print(f"Skipped {len(skipped_unplayable)} unplayable course codes: {sorted(skipped_unplayable)[:10]}...")

    print(f"Indexed {len(course_transcripts)} playable courses")
    
    # Build word frequency per course
    course_words = {}
    for code, text in course_transcripts.items():
        words = tokenize(text)
        word_freq = defaultdict(int)
        for w in words:
            if len(w) > 2:  # Skip very short words
                word_freq[w] += 1
        course_words[code] = dict(word_freq)
        
        # Add to inverted index
        for word, count in word_freq.items():
            inverted_index[word].append({
                'code': code,
                'count': count
            })
    
    # Sort inverted index by count
    for word in inverted_index:
        inverted_index[word].sort(key=lambda x: -x['count'])
    
    # Save search index
    search_index = {
        'course_words': course_words,
        'inverted_index': dict(inverted_index),
        'total_courses': len(course_transcripts),
        'total_words': len(inverted_index)
    }
    
    output_content = CONTENT_DIR / "search_index.json"
    output_content.write_text(json.dumps(search_index, indent=2), encoding="utf-8")
    
    output_app = REPO_ROOT / "path-builder" / "src" / "data" / "search_index.json"
    output_app.write_text(json.dumps(search_index, indent=2), encoding="utf-8")
    
    print(f"\nSearch index built!")
    print(f"  Unique words: {len(inverted_index):,}")
    print(f"  Courses indexed: {len(course_transcripts)}")
    print(f"  Saved to: {output_content}")
    print(f"  Saved to: {output_app}")

    # Cross-check: playable courses missing from index
    indexed_codes = set(course_transcripts.keys())
    missing = playable_codes - indexed_codes
    if missing:
        print(f"\n⚠ {len(missing)} playable courses have NO transcript coverage:")
        for code in sorted(missing):
            print(f"    {code}")
    else:
        print(f"\n✓ All {len(playable_codes)} playable courses have transcript coverage")

if __name__ == "__main__":
    build_index()
