"""
Integrate Whisper transcripts into course data.
Run this after transcription completes.
"""
import json
from pathlib import Path

CONTENT_DIR = Path("content")
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"
DATA_DIR = Path("path-builder/src/data")


def main():
    # Load video metadata to map file IDs to course codes
    videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())
    
    # Build video ID -> course code mapping
    import re
    code_pattern = re.compile(r'^(\d{3}\.\d{2})')
    video_to_code = {}
    for v in videos:
        match = code_pattern.match(v['name'])
        if match:
            video_to_code[v['id']] = match.group(1)
    
    # Load transcripts
    transcripts = {}
    for f in TRANSCRIPTS_DIR.glob("*.json"):
        video_id = f.stem
        data = json.loads(f.read_text())
        if video_id in video_to_code:
            code = video_to_code[video_id]
            if code not in transcripts:
                transcripts[code] = []
            transcripts[code].append(data.get("text", ""))
    
    print(f"Found transcripts for {len(transcripts)} courses")
    
    # Load course data
    data = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    
    # Add transcripts to courses
    updated = 0
    for course in data['courses']:
        code = course['code']
        if code in transcripts:
            # Combine all video transcripts for this course
            course['transcript'] = " ".join(transcripts[code])
            course['transcript_word_count'] = len(course['transcript'].split())
            updated += 1
    
    print(f"Updated {updated} courses with transcripts")
    
    # Save
    for path in [CONTENT_DIR / "video_library_enriched.json",
                 DATA_DIR / "video_library.json",
                 DATA_DIR / "video_library_enriched.json"]:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    
    print("Saved updated course data!")
    
    # Stats
    total_words = sum(c.get('transcript_word_count', 0) for c in data['courses'])
    print(f"\nTotal transcript words: {total_words:,}")


if __name__ == "__main__":
    main()
