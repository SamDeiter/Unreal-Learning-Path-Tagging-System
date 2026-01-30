"""
Find videos for unmatched courses by searching folder categories.
"""
import json
from pathlib import Path
from collections import defaultdict

data = json.loads(Path('content/video_library_enriched.json').read_text())
videos = json.loads(Path('content/drive_video_metadata.json').read_text())  # Use full data, not just FINAL

# Build folder -> videos index
folder_videos = defaultdict(list)
for v in videos:
    folder = v.get('folder', '').lower()
    folder_videos[folder].append(v)

print("FOLDER -> VIDEO COUNT:")
print("=" * 60)
for folder, vids in sorted(folder_videos.items(), key=lambda x: -len(x[1]))[:20]:
    print(f"  {folder}: {len(vids)}")

print("\n" + "=" * 60)
print("SEARCHING FOR UNMATCHED COURSES:")
print("=" * 60)

# Unmatched course keywords to search
searches = {
    '203.02': ['lighting', 'cinematic'],
    '203.05': ['icvfx', 'dmx', 'lightcard'],
    '101.01': ['materials', 'introduction', 'intro'],
    '101.02': ['materials', 'aec'],
    '105.04': ['cinematics', 'aec'],
    '217.01': ['metasound'],
}

for code, keywords in searches.items():
    print(f"\n{code}:")
    matches = []
    for folder, vids in folder_videos.items():
        for kw in keywords:
            if kw in folder:
                matches.extend(vids)
                break
    
    if matches:
        # Only count FINAL videos
        final_matches = [v for v in matches if 'FINAL' in v.get('folder', '').upper()]
        duration = sum(v.get('duration_seconds', 0) for v in final_matches)
        print(f"  Found {len(final_matches)} FINAL videos ({duration//60} min)")
    else:
        print(f"  No folder matches found")
