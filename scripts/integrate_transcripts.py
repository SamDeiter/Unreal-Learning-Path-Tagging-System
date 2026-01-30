"""
Integrate Whisper transcripts into course data.
Maps video IDs from transcript filenames to course codes.
"""
import json
import re
from pathlib import Path

CONTENT_DIR = Path("content")
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"
DATA_DIR = Path("path-builder/src/data")


def main():
    # Load video metadata to map file IDs to course codes
    videos_path = CONTENT_DIR / "drive_video_metadata_final.json"
    if not videos_path.exists():
        print("❌ No drive_video_metadata_final.json found")
        return
    
    videos = json.loads(videos_path.read_text())
    print(f"📹 Video metadata: {len(videos)} videos")
    
    # Build video ID -> (course code, video name) mapping
    code_pattern = re.compile(r'^(\d{3}\.\d{2})')
    video_map = {}
    for v in videos:
        match = code_pattern.match(v['name'])
        if match:
            video_map[v['id']] = {
                'code': match.group(1),
                'name': v['name']
            }
    
    print(f"📊 Videos with course codes: {len(video_map)}")
    
    # Load all JSON transcripts
    transcripts_by_course = {}
    json_files = list(TRANSCRIPTS_DIR.glob("*.json"))
    print(f"📝 Transcript files: {len(json_files)}")
    
    loaded = 0
    for f in json_files:
        video_id = f.stem
        if video_id in video_map:
            try:
                data = json.loads(f.read_text())
                code = video_map[video_id]['code']
                if code not in transcripts_by_course:
                    transcripts_by_course[code] = []
                transcripts_by_course[code].append({
                    'text': data.get('text', ''),
                    'name': video_map[video_id]['name']
                })
                loaded += 1
            except Exception as e:
                print(f"   ⚠️ Error loading {f.name}: {e}")
    
    print(f"✅ Matched {loaded} transcripts to {len(transcripts_by_course)} courses")
    
    # Load course data
    course_data = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    
    # Add transcripts to courses
    updated = 0
    for course in course_data['courses']:
        code = course['code']
        if code in transcripts_by_course:
            # Combine all video transcripts for this course
            all_text = " ".join(t['text'] for t in transcripts_by_course[code])
            course['transcript'] = all_text
            course['transcript_word_count'] = len(all_text.split())
            course['transcript_videos'] = len(transcripts_by_course[code])
            updated += 1
    
    print(f"📚 Updated {updated} courses with transcripts")
    
    # Save to all locations
    for path in [CONTENT_DIR / "video_library_enriched.json",
                 DATA_DIR / "video_library.json",
                 DATA_DIR / "video_library_enriched.json"]:
        if path.parent.exists():
            path.write_text(json.dumps(course_data, indent=2, ensure_ascii=False))
            print(f"   💾 Saved: {path}")
    
    # Stats
    total_words = sum(c.get('transcript_word_count', 0) for c in course_data['courses'])
    courses_with_transcripts = sum(1 for c in course_data['courses'] if c.get('transcript'))
    
    print(f"\n📊 SUMMARY")
    print(f"   Courses with transcripts: {courses_with_transcripts}/106")
    print(f"   Total transcript words: {total_words:,}")


if __name__ == "__main__":
    main()
