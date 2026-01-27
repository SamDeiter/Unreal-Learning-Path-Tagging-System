"""Fetch all video IDs from curated Epic Games YouTube playlists.

Uses YouTube Data API v3 to query playlist items and build a verified video database.
Run periodically to keep the content index fresh.

Usage:
    python fetch_playlist_videos.py

Requires:
    YOUTUBE_API_KEY environment variable
"""

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode
from urllib.request import urlopen


@dataclass
class VideoItem:
    """A video from a YouTube playlist."""
    video_id: str
    title: str
    description: str
    thumbnail_url: str
    channel_title: str
    published_at: str
    playlist_id: str
    playlist_title: str
    position: int
    tags: list[str] = field(default_factory=list)

    @property
    def url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.video_id}"

    @property
    def embed_url(self) -> str:
        return f"https://www.youtube.com/embed/{self.video_id}"

    def to_dict(self) -> dict:
        return {
            "video_id": self.video_id,
            "title": self.title,
            "description": self.description[:500] if self.description else "",
            "thumbnail_url": self.thumbnail_url,
            "url": self.url,
            "channel": self.channel_title,
            "published_at": self.published_at,
            "playlist_id": self.playlist_id,
            "playlist_title": self.playlist_title,
            "position": self.position,
            "tags": self.tags,
        }


def get_api_key() -> str:
    """Get YouTube API key from environment."""
    key = os.environ.get("YOUTUBE_API_KEY", "")
    if not key:
        raise ValueError(
            "YOUTUBE_API_KEY not set. Add it to your .env file or environment."
        )
    return key


def fetch_playlist_items(playlist_id: str, api_key: str) -> list[dict]:
    """Fetch all items from a YouTube playlist.

    Args:
        playlist_id: YouTube playlist ID
        api_key: YouTube Data API key

    Returns:
        List of playlist items
    """
    items = []
    next_page_token = None

    while True:
        params = {
            "part": "snippet",
            "playlistId": playlist_id,
            "maxResults": 50,
            "key": api_key,
        }
        if next_page_token:
            params["pageToken"] = next_page_token

        url = f"https://www.googleapis.com/youtube/v3/playlistItems?{urlencode(params)}"

        try:
            with urlopen(url, timeout=30) as response:
                data = json.loads(response.read().decode())
        except Exception as e:
            print(f"  ⚠ Error fetching playlist {playlist_id}: {e}")
            break

        items.extend(data.get("items", []))
        next_page_token = data.get("nextPageToken")

        if not next_page_token:
            break

    return items


def process_playlist(
    playlist: dict,
    api_key: str,
) -> list[VideoItem]:
    """Process a playlist and return all its videos.

    Args:
        playlist: Playlist metadata from curated_playlists.json
        api_key: YouTube API key

    Returns:
        List of VideoItem objects
    """
    url = playlist["url"]
    # Extract playlist ID from URL
    if "list=" in url:
        playlist_id = url.split("list=")[1].split("&")[0]
    else:
        print(f"  ⚠ Invalid playlist URL: {url}")
        return []

    print(f"  Fetching: {playlist['title']} ({playlist_id})")

    items = fetch_playlist_items(playlist_id, api_key)
    videos = []

    for idx, item in enumerate(items):
        snippet = item.get("snippet", {})
        resource = snippet.get("resourceId", {})
        video_id = resource.get("videoId")

        if not video_id:
            continue

        # Get best available thumbnail
        thumbnails = snippet.get("thumbnails", {})
        thumbnail_url = (
            thumbnails.get("standard", {}).get("url")
            or thumbnails.get("high", {}).get("url")
            or thumbnails.get("medium", {}).get("url")
            or thumbnails.get("default", {}).get("url", "")
        )

        video = VideoItem(
            video_id=video_id,
            title=snippet.get("title", ""),
            description=snippet.get("description", ""),
            thumbnail_url=thumbnail_url,
            channel_title=snippet.get("videoOwnerChannelTitle", ""),
            published_at=snippet.get("publishedAt", ""),
            playlist_id=playlist_id,
            playlist_title=playlist["title"],
            position=idx,
            tags=playlist.get("tags", []),
        )
        videos.append(video)

    print(f"    → Found {len(videos)} videos")
    return videos


def main():
    """Fetch all videos from curated playlists and save to content index."""
    # Load dotenv if available
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    api_key = get_api_key()
    base_dir = Path(__file__).parent.parent

    # Load curated playlists
    playlists_path = base_dir / "content" / "curated_playlists.json"
    if not playlists_path.exists():
        print(f"❌ Curated playlists not found: {playlists_path}")
        return

    with open(playlists_path, encoding="utf-8") as f:
        data = json.load(f)

    playlists = data.get("playlists", [])
    print(f"📋 Processing {len(playlists)} curated playlists...\n")

    all_videos: list[VideoItem] = []
    playlist_stats = []

    for playlist in playlists:
        videos = process_playlist(playlist, api_key)
        all_videos.extend(videos)
        playlist_stats.append({
            "id": playlist["id"],
            "title": playlist["title"],
            "video_count": len(videos),
        })

    # Deduplicate by video_id (same video can be in multiple playlists)
    seen_ids = set()
    unique_videos = []
    for video in all_videos:
        if video.video_id not in seen_ids:
            unique_videos.append(video)
            seen_ids.add(video.video_id)

    print(f"\n✅ Total: {len(all_videos)} videos ({len(unique_videos)} unique)")

    # Save to content index
    output_path = base_dir / "content" / "verified_videos.json"
    output_data = {
        "generated_at": datetime.now().isoformat(),
        "total_videos": len(unique_videos),
        "playlists_processed": len(playlists),
        "playlist_stats": playlist_stats,
        "videos": [v.to_dict() for v in unique_videos],
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print(f"💾 Saved to: {output_path}")

    # Print summary
    print("\n📊 Playlist Summary:")
    for stat in sorted(playlist_stats, key=lambda x: -x["video_count"]):
        print(f"   {stat['video_count']:4d} videos - {stat['title']}")


if __name__ == "__main__":
    main()
