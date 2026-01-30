"""Build search index from transcripts for fast full-text search."""
import json
import re
from pathlib import Path
from collections import defaultdict

CONTENT_DIR = Path("content")
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"

def tokenize(text):
    """Simple tokenizer - lowercase and split on non-alphanumeric."""
    return re.findall(r'\b[a-z0-9]+\b', text.lower())

def build_index():
    # Load video metadata for mapping
    videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())
    code_pattern = re.compile(r'^(\d{3}\.\d{2})')
    video_map = {}
    for v in videos:
        match = code_pattern.match(v['name'])
        if match:
            video_map[v['id']] = {
                'code': match.group(1),
                'name': v['name']
            }
    
    # Build inverted index: word -> [(course_code, count, snippet)]
    inverted_index = defaultdict(list)
    course_transcripts = defaultdict(str)
    
    # Load all transcripts
    transcript_files = list(TRANSCRIPTS_DIR.glob("*.json"))
    print(f"Processing {len(transcript_files)} transcripts...")
    
    for f in transcript_files:
        video_id = f.stem
        if video_id not in video_map:
            continue
            
        code = video_map[video_id]['code']
        
        try:
            data = json.loads(f.read_text())
            text = data.get('text', '')
            course_transcripts[code] += " " + text
        except:
            continue
    
    print(f"Indexed {len(course_transcripts)} courses")
    
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
    
    output_path = CONTENT_DIR / "search_index.json"
    output_path.write_text(json.dumps(search_index, indent=2))
    
    # Also save to path-builder
    Path("path-builder/src/data/search_index.json").write_text(
        json.dumps(search_index, indent=2)
    )
    
    print(f"Search index built!")
    print(f"  Unique words: {len(inverted_index):,}")
    print(f"  Courses indexed: {len(course_transcripts)}")
    print(f"  Saved to: {output_path}")

if __name__ == "__main__":
    build_index()
