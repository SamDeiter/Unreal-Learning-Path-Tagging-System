"""Get video metadata from training folder - sequential, reliable version."""
import json
import pickle
import time
from pathlib import Path

from googleapiclient.discovery import build

# Config
ROOT_FOLDER = '1gexT_hYjs87RWfgzOS4p1WszsweOFR6_'
CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')


def get_service():
    with open('token.pickle', 'rb') as f:
        creds = pickle.load(f)
    return build('drive', 'v3', credentials=creds)


def list_folder(service, folder_id):
    """List all items in a folder."""
    try:
        results = service.files().list(
            q=f"'{folder_id}' in parents",
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            fields='files(id, name, mimeType, size, videoMediaMetadata)',
            pageSize=1000
        ).execute()
        return results.get('files', [])
    except Exception as e:
        print(f"      Error: {e}")
        return []


def search_folder(service, folder_id, folder_name="", depth=0, max_depth=3):
    """Search folder for videos up to max_depth levels."""
    videos = []

    if depth > max_depth:
        return videos

    items = list_folder(service, folder_id)

    for item in items:
        if 'folder' in item['mimeType']:
            # Recurse into subfolder
            sub_videos = search_folder(
                service, item['id'], item['name'], depth + 1, max_depth
            )
            videos.extend(sub_videos)
        elif 'video' in item['mimeType']:
            # Found a video
            video_meta = item.get('videoMediaMetadata', {})
            duration_ms = video_meta.get('durationMillis', 0)

            videos.append({
                'id': item['id'],
                'name': item['name'],
                'folder': folder_name,
                'size_bytes': int(item.get('size', 0)),
                'duration_seconds': int(duration_ms) // 1000 if duration_ms else 0
            })

    return videos


def main():
    print("=" * 60)
    print("VIDEO DURATION EXTRACTOR (Sequential)")
    print(f"Root folder: {ROOT_FOLDER}")
    print("=" * 60)

    start = time.time()
    service = get_service()

    # Get category folders
    print("\n📂 Getting category folders...")
    categories = [f for f in list_folder(service, ROOT_FOLDER) if 'folder' in f['mimeType']]
    print(f"   Found {len(categories)} category folders")

    # Search each category sequentially
    print("\n🔍 Searching for videos...")
    all_videos = []

    for i, cat in enumerate(categories):
        print(f"   [{i+1}/{len(categories)}] {cat['name']}...", end=" ", flush=True)
        videos = search_folder(service, cat['id'], cat['name'])
        all_videos.extend(videos)
        print(f"{len(videos)} videos")
        time.sleep(0.2)  # Small delay to avoid rate limiting

    print(f"\n✅ Found {len(all_videos)} total videos")

    # Calculate total duration
    total_seconds = sum(v['duration_seconds'] for v in all_videos)
    hours = total_seconds // 3600
    mins = (total_seconds % 3600) // 60
    print(f"📹 Total content: {hours} hours {mins} minutes")

    # Save raw data
    raw_path = CONTENT_DIR / "drive_video_metadata.json"
    raw_path.write_text(json.dumps(all_videos, indent=2))
    print(f"\n💾 Saved to {raw_path}")

    # Summary by category
    print("\n📊 Top categories by video count:")
    by_cat = {}
    for v in all_videos:
        cat = v['folder']
        by_cat[cat] = by_cat.get(cat, 0) + 1
    for cat, count in sorted(by_cat.items(), key=lambda x: -x[1])[:10]:
        print(f"   {cat}: {count}")

    elapsed = time.time() - start
    print(f"\n⏱️  Completed in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
