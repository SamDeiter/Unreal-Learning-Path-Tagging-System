"""
Update course durations from Drive video metadata.
Filters to FINAL videos only.
"""
import json
from pathlib import Path

CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')


def main():
    print("=" * 60)
    print("UPDATE COURSE DURATIONS FROM DRIVE")
    print("=" * 60)
    
    # Load video metadata
    video_data = json.loads((CONTENT_DIR / "drive_video_metadata.json").read_text())
    print(f"\n📹 Loaded {len(video_data)} videos from Drive")
    
    # Filter to FINAL only
    final_videos = [v for v in video_data if 'FINAL' in v.get('folder', '').upper()]
    print(f"   Filtered to {len(final_videos)} FINAL videos")
    
    # Save filtered data
    (CONTENT_DIR / "drive_video_metadata_final.json").write_text(
        json.dumps(final_videos, indent=2)
    )
    print(f"   Saved filtered data to content/drive_video_metadata_final.json")
    
    # Load course data
    enriched_path = CONTENT_DIR / "video_library_enriched.json"
    data = json.loads(enriched_path.read_text())
    courses = data.get('courses', [])
    print(f"\n📚 Loaded {len(courses)} courses")
    
    # Build video name lookup (lowercase for matching)
    video_lookup = {}
    for v in final_videos:
        name = v.get('name', '').lower()
        if name:
            video_lookup[name] = v
    
    # Try to match courses to videos
    matched = 0
    total_duration = 0
    
    for course in courses:
        # Try matching by course title keywords
        title = course.get('title', '').lower()
        keywords = title.replace('-', ' ').split()
        
        # Find videos that match any keyword
        matching_videos = []
        for name, vid in video_lookup.items():
            if any(kw in name for kw in keywords if len(kw) > 3):
                matching_videos.append(vid)
        
        if matching_videos:
            # Sum durations of matching videos
            duration = sum(v.get('duration_seconds', 0) for v in matching_videos[:5])  # Cap at 5 to avoid false matches
            if duration > 0:
                course['duration_minutes'] = duration // 60
                course['duration_source'] = 'drive'
                matched += 1
                total_duration += duration
    
    print(f"\n✅ Matched {matched}/{len(courses)} courses to Drive videos")
    
    hours = total_duration // 3600
    mins = (total_duration % 3600) // 60
    print(f"📹 Total matched duration: {hours}h {mins}m")
    
    # Save updated data
    for path in [enriched_path, 
                 DATA_DIR / "video_library.json",
                 DATA_DIR / "video_library_enriched.json"]:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    
    print(f"\n💾 Saved updated course data")
    
    # Summary stats
    final_total = sum(v.get('duration_seconds', 0) for v in final_videos)
    hours = final_total // 3600
    mins = (final_total % 3600) // 60
    print(f"\n📊 Summary:")
    print(f"   Total FINAL videos: {len(final_videos)}")
    print(f"   Total FINAL duration: {hours}h {mins}m")
    print(f"   Courses matched: {matched}/{len(courses)}")


if __name__ == "__main__":
    main()
