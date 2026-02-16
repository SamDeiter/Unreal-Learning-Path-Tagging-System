"""YouTube Transcript Fetcher.

Downloads YouTube video transcripts using youtube-transcript-api
and saves them as JSON files for processing by the enrichment pipeline.
"""

import json
from pathlib import Path


def fetch_youtube_transcripts(
    content_dir: Path,
    video_ids: list[str],
) -> dict[str, str]:
    """Fetch and save YouTube transcripts for a list of video IDs.

    Args:
        content_dir: Path to content/ directory.
        video_ids: List of YouTube video IDs to fetch transcripts for.

    Returns:
        Dictionary mapping video_id -> full transcript text.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        print("  ⚠️  youtube-transcript-api not installed.")
        print("     Run: pip install youtube-transcript-api")
        return {}

    transcript_dir = content_dir / "transcripts"
    transcript_dir.mkdir(parents=True, exist_ok=True)

    results = {}
    fetched = 0
    skipped = 0
    failed = 0

    ytt_api = YouTubeTranscriptApi()

    for video_id in video_ids:
        output_file = transcript_dir / f"{video_id}.json"

        # Skip if already fetched
        if output_file.exists():
            skipped += 1
            # Load existing transcript text
            try:
                data = json.loads(output_file.read_text(encoding="utf-8"))
                results[video_id] = " ".join(
                    entry.get("text", "") for entry in data
                )
            except (json.JSONDecodeError, KeyError):
                pass
            continue

        try:
            # v1.2+ API: use fetch() directly
            transcript = ytt_api.fetch(video_id, languages=["en"])

            # transcript is a FetchedTranscript with snippet entries
            entries = [
                {
                    "text": snippet.text,
                    "start": snippet.start,
                    "duration": snippet.duration,
                }
                for snippet in transcript
            ]

            # Save raw transcript entries as JSON
            output_file.write_text(
                json.dumps(entries, indent=2),
                encoding="utf-8",
            )

            # Build full text
            full_text = " ".join(e["text"] for e in entries)
            results[video_id] = full_text
            fetched += 1

        except Exception as e:
            print(f"  ⚠️  Failed to fetch transcript for {video_id}: {e}")
            failed += 1

    print(f"   📝 Transcripts: {fetched} fetched, {skipped} cached, {failed} failed")
    return results
