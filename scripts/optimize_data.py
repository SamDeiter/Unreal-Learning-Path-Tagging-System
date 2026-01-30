"""
Optimize data files for frontend performance.
1. Compress search index (remove low-frequency words)
2. Create lightweight video library (no transcript text)
3. Generate minified versions
"""
import json
from pathlib import Path

CONTENT_DIR = Path("content")
DATA_DIR = Path("path-builder/src/data")


def optimize_search_index():
    """Compress search index by keeping only high-value words."""
    index_path = CONTENT_DIR / "search_index.json"
    index = json.loads(index_path.read_text())
    
    original_words = len(index['inverted_index'])
    
    # Keep only words that appear in 2+ courses OR have 5+ total mentions
    optimized_index = {}
    for word, courses in index['inverted_index'].items():
        total_count = sum(c['count'] for c in courses)
        if len(courses) >= 2 or total_count >= 5:
            # Keep only top 10 courses per word
            optimized_index[word] = courses[:10]
    
    # Also simplify course_words - keep top 50 words per course
    optimized_course_words = {}
    for code, words in index['course_words'].items():
        top_words = sorted(words.items(), key=lambda x: -x[1])[:50]
        optimized_course_words[code] = dict(top_words)
    
    optimized = {
        'inverted_index': optimized_index,
        'course_words': optimized_course_words,
        'total_courses': index['total_courses'],
        'total_words': len(optimized_index)
    }
    
    # Save optimized version
    output = DATA_DIR / "search_index.json"
    output.write_text(json.dumps(optimized))  # No indent = smaller
    
    new_size = output.stat().st_size / 1024
    print(f"Search index: {original_words} → {len(optimized_index)} words")
    print(f"  New size: {new_size:.1f} KB")
    
    return new_size


def optimize_video_library():
    """Remove transcript text from frontend copy."""
    library = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    
    # Create lightweight version for frontend
    for course in library['courses']:
        # Remove heavy fields
        course.pop('transcript', None)
        
        # Keep only essential fields
        # transcript_word_count and extracted_tags are useful for UI
    
    # Save minified
    output = DATA_DIR / "video_library.json"
    output.write_text(json.dumps(library))  # No indent
    
    new_size = output.stat().st_size / 1024
    print(f"Video library: {new_size:.1f} KB (no transcript text)")
    
    return new_size


def main():
    print("=== PERFORMANCE OPTIMIZATION ===\n")
    
    search_size = optimize_search_index()
    library_size = optimize_video_library()
    
    total = search_size + library_size
    print(f"\n✅ Total frontend data: {total:.1f} KB")
    print(f"   (Down from ~8 MB)")


if __name__ == "__main__":
    main()
