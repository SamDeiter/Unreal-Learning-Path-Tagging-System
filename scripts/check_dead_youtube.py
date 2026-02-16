"""Scan youtube_curated.json for dead YouTube video links and remove them."""
import json
import urllib.request
import urllib.error
import time
import re

DATA_PATH = "path-builder/src/data/youtube_curated.json"


def extract_youtube_id(url):
    """Extract YouTube video ID from URL."""
    if not url:
        return None
    m = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', url)
    return m.group(1) if m else None


def check_video(video_id):
    """Return True if video is alive, False if dead."""
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 404):
            return False
        return True
    except Exception:
        return True


def main():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Collect all YouTube URLs from resources
    resources = data.get("resources", [])
    print(f"Total resources: {len(resources)}")

    # Find all entries with YouTube URLs
    to_check = []
    for r in resources:
        url = r.get("url", "")
        vid_id = extract_youtube_id(url)
        if vid_id:
            to_check.append({
                "title": r.get("title", "?"),
                "url": url,
                "youtube_id": vid_id,
                "resource": r,
            })

    print(f"Found {len(to_check)} YouTube video resources to check")

    # Check them
    dead = []
    alive = 0
    for i, item in enumerate(to_check):
        is_alive = check_video(item["youtube_id"])
        if is_alive:
            alive += 1
        else:
            dead.append(item)
            print(f"  DEAD: {item['title'][:60]} ({item['youtube_id']})")

        if (i + 1) % 50 == 0:
            print(f"  ...checked {i+1}/{len(to_check)} ({alive} alive, {len(dead)} dead)")
        time.sleep(0.2)

    print(f"\n{'='*60}")
    print(f"Results: {len(to_check)} checked, {alive} alive, {len(dead)} dead")
    print(f"{'='*60}")

    if dead:
        print(f"\nDead videos:")
        for d in dead:
            print(f"  {d['title'][:55]:55} {d['youtube_id']}")

        # Remove dead resources
        dead_ids = {d["youtube_id"] for d in dead}
        original = len(data["resources"])
        data["resources"] = [
            r for r in data["resources"]
            if extract_youtube_id(r.get("url", "")) not in dead_ids
        ]
        removed = original - len(data["resources"])
        print(f"\nRemoved {removed} dead resources. {len(data['resources'])} remaining.")

        with open(DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved to {DATA_PATH}")
    else:
        print("\nNo dead videos found!")


if __name__ == "__main__":
    main()
