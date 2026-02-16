"""YouTube Data API fetcher for UE5 learning content.

Fetches video metadata and captions from UE5 tutorial channels.
Extracts timestamps, topics, and error signatures for tagging.
"""

import contextlib
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from .config import INGESTION_DIR, get_youtube_api_key


@dataclass
class VideoMetadata:
    """Structured video metadata for tagging."""

    video_id: str
    title: str
    description: str
    channel_title: str
    published_at: str
    duration: str | None = None
    view_count: int | None = None
    tags: list[str] | None = None
    thumbnail_url: str | None = None


class YouTubeFetcher:
    """Fetches UE5 content from YouTube Data API v3."""

    BASE_URL = "https://www.googleapis.com/youtube/v3"

    # Known UE5 tutorial channels
    CHANNEL_IDS = {
        "unreal_sensei": "UCL7MDX6xNHxwp7Lvz-8w8Vg",
        "ryan_laley": "UCsLo154cWqUb0fCvx-dNMWQ",
        "mathew_wadstein": "UCYimC_whmQX-7KRYVdBXCIA",
        "william_faucher": "UCdNxuNt7nKhKQw_jHgBGMcg",
        "epic_games": "UCBobmJyzsJ6Ll7UbfhI4iwQ",
    }

    def __init__(self):
        """Initialize with API key from environment."""
        self.api_key = get_youtube_api_key()

    def _api_request(self, endpoint: str, params: dict) -> dict:
        """Make authenticated API request.

        Args:
            endpoint: API endpoint (e.g., 'search', 'videos').
            params: Query parameters.

        Returns:
            JSON response as dictionary, or empty dict on error.
        """
        params["key"] = self.api_key
        url = f"{self.BASE_URL}/{endpoint}?{urllib.parse.urlencode(params)}"

        try:
            with urllib.request.urlopen(url) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            error_body = ""
            with contextlib.suppress(Exception):
                error_body = e.read().decode()
            print(f"  ⚠️  YouTube API error {e.code}: {e.reason}")
            if error_body:
                print(f"       Details: {error_body[:300]}")
            if e.code == 403:
                print("       → YouTube Data API v3 may not be enabled in your GCP project.")
                print("       → Enable it at: https://console.cloud.google.com/apis/library/youtube.googleapis.com")
            elif e.code == 400:
                print("       → The API key may not be valid for YouTube Data API v3.")
            return {}
        except urllib.error.URLError as e:
            print(f"  ⚠️  Network error: {e.reason}")
            return {}

    def search_videos(
        self,
        query: str,
        max_results: int = 10,
        epic_only: bool = False,
    ) -> list[VideoMetadata]:
        """Search for UE5 tutorial videos.

        Args:
            query: Search query (e.g., 'UE5 ExitCode 25').
            max_results: Maximum videos to return.
            epic_only: If True, only return videos from Epic Games channel.

        Returns:
            List of VideoMetadata objects.
        """
        params = {
            "part": "snippet",
            "q": f"Unreal Engine 5 {query}",
            "maxResults": (
                max_results * 5 if epic_only
                else max_results * 2
            ),  # Fetch more to filter intros
            "type": "video",
            "relevanceLanguage": "en",
        }

        # If epic_only, filter by Epic Games channel directly
        if epic_only:
            params["channelId"] = self.CHANNEL_IDS["epic_games"]

        data = self._api_request("search", params)
        videos = []

        # Terms that indicate intro/preview content (skip these for detailed tutorials)
        skip_terms = [
            'preview', 'intro', 'introduction',
            'trailer', 'teaser', 'essentials', 'overview',
        ]

        for item in data.get("items", []):
            snippet = item["snippet"]

            # Filter by Epic Games if requested (fallback for search without channelId)
            if epic_only and snippet.get("channelId") != self.CHANNEL_IDS["epic_games"]:
                continue

            # Skip intro/preview videos for better content matching
            title_lower = snippet["title"].lower()
            if any(term in title_lower for term in skip_terms):
                continue

            # Get best available thumbnail
            thumbnails = snippet.get("thumbnails", {})
            thumbnail_url = (
                thumbnails.get("high", {}).get("url") or
                thumbnails.get("medium", {}).get("url") or
                thumbnails.get("default", {}).get("url")
            )

            videos.append(
                VideoMetadata(
                    video_id=item["id"]["videoId"],
                    title=snippet["title"],
                    description=snippet["description"],
                    channel_title=snippet["channelTitle"],
                    published_at=snippet["publishedAt"],
                    thumbnail_url=thumbnail_url,
                )
            )

            if len(videos) >= max_results:
                break

        return videos

    def get_video_details(self, video_ids: list[str]) -> list[VideoMetadata]:
        """Get detailed metadata for videos.

        Args:
            video_ids: List of YouTube video IDs.

        Returns:
            List of VideoMetadata with full details.
        """
        params = {
            "part": "snippet,contentDetails,statistics",
            "id": ",".join(video_ids),
        }

        data = self._api_request("videos", params)
        videos = []

        for item in data.get("items", []):
            snippet = item["snippet"]
            stats = item.get("statistics", {})

            # Get best available thumbnail
            thumbnails = snippet.get("thumbnails", {})
            thumbnail_url = (
                thumbnails.get("high", {}).get("url")
                or thumbnails.get("medium", {}).get("url")
                or thumbnails.get("default", {}).get("url")
            )

            videos.append(
                VideoMetadata(
                    video_id=item["id"],
                    title=snippet["title"],
                    description=snippet["description"],
                    channel_title=snippet["channelTitle"],
                    published_at=snippet["publishedAt"],
                    duration=item["contentDetails"]["duration"],
                    view_count=int(stats.get("viewCount", 0)),
                    tags=snippet.get("tags", []),
                    thumbnail_url=thumbnail_url,
                )
            )

        return videos

    def fetch_channel_videos(
        self,
        channel_key: str,
        max_results: int = 10,
        min_duration_minutes: int = 2,
    ) -> list[VideoMetadata]:
        """Fetch videos from a known UE5 channel using uploads playlist.

        Uses the channel's uploads playlist (more reliable than search API)
        with pagination to retrieve up to max_results videos.
        Filters out YouTube Shorts and very short clips.

        Args:
            channel_key: Key from CHANNEL_IDS dictionary.
            max_results: Maximum videos to return.
            min_duration_minutes: Skip videos shorter than this (filters Shorts).

        Returns:
            List of VideoMetadata objects with full details.
        """
        channel_id = self.CHANNEL_IDS.get(channel_key)
        if not channel_id:
            raise ValueError(f"Unknown channel: {channel_key}")

        # The uploads playlist ID is the channel ID with "UC" replaced by "UU"
        uploads_playlist_id = "UU" + channel_id[2:]
        print(f"   📋 Uploads playlist: {uploads_playlist_id}")

        all_video_ids = []
        next_page_token = None
        page_size = min(50, max_results)

        while len(all_video_ids) < max_results:
            params = {
                "part": "snippet",
                "playlistId": uploads_playlist_id,
                "maxResults": page_size,
            }
            if next_page_token:
                params["pageToken"] = next_page_token

            data = self._api_request("playlistItems", params)
            if not data:
                break

            items = data.get("items", [])
            if not items:
                break

            for item in items:
                vid_id = item.get("snippet", {}).get("resourceId", {}).get("videoId")
                if vid_id:
                    all_video_ids.append(vid_id)

            next_page_token = data.get("nextPageToken")
            total = data.get("pageInfo", {}).get("totalResults", 0)
            print(f"   📄 Page fetched: {len(all_video_ids)} / ~{total} videos")

            if not next_page_token:
                break  # No more pages

        # Trim to max_results
        all_video_ids = all_video_ids[:max_results]
        print(f"   🔍 Fetching details for {len(all_video_ids)} videos...")

        # Get full details in batches of 50 (videos.list limit)
        all_videos = []
        for i in range(0, len(all_video_ids), 50):
            batch = all_video_ids[i : i + 50]
            details = self.get_video_details(batch)
            all_videos.extend(details)

        # Filter out Shorts and very short clips
        if min_duration_minutes > 0:
            before = len(all_videos)
            all_videos = [
                v for v in all_videos
                if parse_iso8601_duration(v.duration) >= min_duration_minutes
            ]
            skipped = before - len(all_videos)
            if skipped:
                print(f"   ⏭️  Filtered {skipped} videos shorter than {min_duration_minutes} min")

        return all_videos


def parse_iso8601_duration(iso_str: str) -> int:
    """Convert ISO 8601 duration to minutes.

    Args:
        iso_str: Duration string like 'PT1H23M45S', 'PT5M', 'PT30S'.

    Returns:
        Duration in minutes (rounded up).
    """
    if not iso_str:
        return 0
    import re as _re

    pattern = _re.compile(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")
    match = pattern.match(iso_str)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    total_minutes = hours * 60 + minutes + (1 if seconds > 0 else 0)
    return max(total_minutes, 1)


def convert_to_course_format(video: VideoMetadata) -> dict:
    """Transform a VideoMetadata into a video_library.json course dict.

    Args:
        video: VideoMetadata object from the YouTube API.

    Returns:
        Course dictionary compatible with video_library.json.
    """
    duration_minutes = parse_iso8601_duration(video.duration) if video.duration else 10

    return {
        "code": video.video_id,
        "title": video.title,
        "folder_name": f"YT-{video.video_id}",
        "path": f"https://www.youtube.com/watch?v={video.video_id}",
        "source": "youtube",
        "youtube_url": f"https://www.youtube.com/watch?v={video.video_id}",
        "thumbnail_url": video.thumbnail_url or "",
        "channel_title": video.channel_title,
        "published_at": video.published_at,
        "duration_minutes": duration_minutes,
        "view_count": video.view_count or 0,
        "versions": [],
        "has_cc": False,
        "has_scorm": False,
        "videos": [
            {
                "name": video.title,
                "path": f"https://www.youtube.com/watch?v={video.video_id}",
                "version": "youtube",
                "folder": "youtube",
            }
        ],
        "video_count": 1,
        "tags": {
            "audience": "General",
            "level": "Intermediate",
            "product": "Unreal Engine",
            "industry": "General",
            "topic": "Foundation",
            "_confidence": 1,
        },
        "needs_review": True,
        "segments": [],
        "ai_tags": video.tags or [],
    }


def main():
    """Test the YouTube fetcher."""
    print("🔍 Testing YouTube Fetcher...")

    fetcher = YouTubeFetcher()

    # Test search
    print("\n📹 Searching for 'ExitCode 25' videos...")
    videos = fetcher.search_videos("ExitCode 25", max_results=3)

    for video in videos:
        print(f"  - {video.title[:60]}...")
        print(f"    Channel: {video.channel_title}")

    # Save results for analysis
    output_file = INGESTION_DIR / "fetched_videos.json"
    with open(output_file, "w") as f:
        json.dump(
            [v.__dict__ for v in videos],
            f,
            indent=2,
        )
    print(f"\n✅ Saved {len(videos)} videos to {output_file}")


if __name__ == "__main__":
    main()
