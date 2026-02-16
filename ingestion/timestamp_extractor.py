"""Timestamp extractor for YouTube videos.

Parses video descriptions to find chapter/timestamp markers
and links to specific moments relevant to the user's query.
"""

import re
from dataclasses import dataclass


@dataclass
class VideoSnippet:
    """A specific timestamped section of a video."""

    video_id: str
    video_title: str
    timestamp_seconds: int
    timestamp_display: str  # e.g., "2:30"
    snippet_title: str
    url: str  # YouTube URL with timestamp


class TimestampExtractor:
    """Extracts timestamps and chapters from video descriptions."""

    # Pattern for timestamps like "0:00", "1:23", "01:23:45"
    TIMESTAMP_PATTERN = re.compile(
        r"(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–:)]?\s*(.+?)(?=\n|$)",
        re.MULTILINE,
    )

    def extract_timestamps(self, description: str) -> list[tuple[str, str]]:
        """Extract all timestamps from a video description.

        Args:
            description: YouTube video description.

        Returns:
            List of (timestamp, title) tuples.
        """
        matches = self.TIMESTAMP_PATTERN.findall(description)
        return [(ts, title.strip()) for ts, title in matches if title.strip()]

    def timestamp_to_seconds(self, timestamp: str) -> int:
        """Convert timestamp string to seconds.

        Args:
            timestamp: Time string like "1:23" or "01:23:45".

        Returns:
            Total seconds.
        """
        parts = timestamp.split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        return 0

    def find_relevant_snippets(
        self,
        video_id: str,
        video_title: str,
        description: str,
        query_terms: list[str],
        max_snippets: int = 3,
    ) -> list[VideoSnippet]:
        """Find video snippets relevant to query terms.

        Args:
            video_id: YouTube video ID.
            video_title: Video title.
            description: Video description.
            query_terms: Terms to match in snippet titles.
            max_snippets: Maximum snippets to return.

        Returns:
            List of relevant VideoSnippet objects.
        """
        timestamps = self.extract_timestamps(description)
        snippets = []

        # Score each timestamp by relevance to query
        scored = []
        for ts, title in timestamps:
            score = 0
            title_lower = title.lower()

            for term in query_terms:
                if term.lower() in title_lower:
                    score += 2
                # Partial match
                for word in term.lower().split():
                    if len(word) >= 3 and word in title_lower:
                        score += 1

            scored.append((score, ts, title))

        # Sort by score (highest first)
        scored.sort(key=lambda x: x[0], reverse=True)

        # Take top matches
        for score, ts, title in scored[:max_snippets]:
            if score > 0:  # Only include if there's some relevance
                seconds = self.timestamp_to_seconds(ts)
                snippets.append(
                    VideoSnippet(
                        video_id=video_id,
                        video_title=video_title,
                        timestamp_seconds=seconds,
                        timestamp_display=ts,
                        snippet_title=title,
                        url=f"https://youtube.com/watch?v={video_id}&t={seconds}",
                    )
                )

        # If no relevant snippets found, return first few timestamps
        if not snippets and timestamps:
            for ts, title in timestamps[:max_snippets]:
                seconds = self.timestamp_to_seconds(ts)
                snippets.append(
                    VideoSnippet(
                        video_id=video_id,
                        video_title=video_title,
                        timestamp_seconds=seconds,
                        timestamp_display=ts,
                        snippet_title=title,
                        url=f"https://youtube.com/watch?v={video_id}&t={seconds}",
                    )
                )

        return snippets

    def extract_chapters_as_segments(
        self,
        video_id: str,
        description: str,
    ) -> list[dict]:
        """Extract all chapters as segment dicts for course metadata.

        Args:
            video_id: YouTube video ID.
            description: YouTube video description.

        Returns:
            List of segment dicts with title, start_seconds, timestamp_display, url.
        """
        timestamps = self.extract_timestamps(description)
        segments = []
        for ts, title in timestamps:
            seconds = self.timestamp_to_seconds(ts)
            segments.append(
                {
                    "title": title,
                    "start_seconds": seconds,
                    "timestamp_display": ts,
                    "url": f"https://youtube.com/watch?v={video_id}&t={seconds}",
                }
            )
        return segments

    def get_intro_snippet(
        self,
        video_id: str,
        video_title: str,
    ) -> VideoSnippet:
        """Get a snippet for the video intro (no timestamp).

        Args:
            video_id: YouTube video ID.
            video_title: Video title.

        Returns:
            VideoSnippet for the start of the video.
        """
        return VideoSnippet(
            video_id=video_id,
            video_title=video_title,
            timestamp_seconds=0,
            timestamp_display="0:00",
            snippet_title="Introduction",
            url=f"https://youtube.com/watch?v={video_id}",
        )


def main():
    """Test timestamp extraction."""
    extractor = TimestampExtractor()

    # Sample description with timestamps
    description = """
    Learn how to fix packaging errors in UE5!

    0:00 Introduction
    1:23 Common Packaging Errors
    3:45 ExitCode 25 Explained
    5:30 Fixing Asset Issues
    8:15 Build Configuration Tips
    10:00 Prevention Best Practices
    """

    print("🔍 Testing timestamp extraction...")
    timestamps = extractor.extract_timestamps(description)

    print(f"\n📋 Found {len(timestamps)} timestamps:")
    for ts, title in timestamps:
        print(f"  {ts} - {title}")

    # Test relevance matching
    snippets = extractor.find_relevant_snippets(
        video_id="abc123",
        video_title="UE5 Packaging Guide",
        description=description,
        query_terms=["ExitCode 25", "packaging", "error"],
    )

    print("\n🎯 Relevant snippets for 'ExitCode 25':")
    for s in snippets:
        print(f"  {s.timestamp_display} - {s.snippet_title}")
        print(f"    URL: {s.url}")


if __name__ == "__main__":
    main()
