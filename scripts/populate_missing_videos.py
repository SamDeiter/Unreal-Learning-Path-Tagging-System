"""
Populate missing video data for 44 courses with video_count=0.
Matches drive files to courses by course code prefix in filename.
"""
import json
import re
from pathlib import Path
from collections import defaultdict

# Paths
ENRICHED = Path("path-builder/src/data/video_library_enriched.json")
DRIVE_META = Path("content/drive_video_metadata_final.json")

def extract_course_code(filename):
    """Extract course code from drive filename like '112.03_01_Intro_53.mp4'."""
    # Match patterns like "112.03" or "112.03" at the start of filename
    match = re.match(r'^(\d{3}\.\d{2})', filename)
    if match:
        return match.group(1)
    return None

def main():
    print("=" * 60)
    print("Populating missing video data from Drive metadata")
    print("=" * 60)

    # Load data
    with open(ENRICHED, "r", encoding="utf-8") as f:
        library = json.load(f)
    
    with open(DRIVE_META, "r", encoding="utf-8") as f:
        drive_videos = json.load(f)

    courses = library if isinstance(library, list) else library.get("courses", [])
    
    # Find courses with 0 videos
    empty_courses = {c.get("code"): c for c in courses if len(c.get("videos", [])) == 0}
    print(f"\nCourses with 0 videos: {len(empty_courses)}")
    
    # Group drive files by course code
    drive_by_code = defaultdict(list)
    for dv in drive_videos:
        code = extract_course_code(dv.get("name", ""))
        if code:
            drive_by_code[code].append(dv)
    
    print(f"Drive files with parseable course codes: {sum(len(v) for v in drive_by_code.values())}")
    print(f"Unique course codes in drive: {len(drive_by_code)}")
    
    # Match and populate
    populated = 0
    total_vids = 0
    still_empty = []
    
    for code, course in empty_courses.items():
        if code in drive_by_code:
            drive_files = drive_by_code[code]
            # Sort by name for consistent ordering
            drive_files.sort(key=lambda x: x.get("name", ""))
            
            videos = []
            for df in drive_files:
                videos.append({
                    "name": df.get("name", ""),
                    "path": "",
                    "version": "",
                    "folder": df.get("folder", "FINAL"),
                    "drive_id": df.get("id", ""),
                    "duration_seconds": df.get("duration_seconds", 0),
                })
            
            course["videos"] = videos
            course["video_count"] = len(videos)
            populated += 1
            total_vids += len(videos)
            print(f"  ✅ {code} {course.get('title', '?')}: +{len(videos)} videos")
        else:
            still_empty.append(code)
    
    print(f"\n📊 Results:")
    print(f"  Populated: {populated} courses with {total_vids} total videos")
    print(f"  Still empty: {len(still_empty)} courses")
    
    if still_empty:
        print(f"  Still empty codes: {still_empty}")
        # Check what codes are close
        for code in still_empty:
            course = empty_courses[code]
            print(f"    {code} {course.get('title', '?')}")
    
    # Save
    with open(ENRICHED, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Saved to {ENRICHED}")

if __name__ == "__main__":
    main()
