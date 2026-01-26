"""Tag discovery and research tool.

Searches YouTube and web for trending UE5 problems to discover new tags.
Provides CLI for researching and managing the tag database.
"""

import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import TAGS_DIR
from .youtube_fetcher import YouTubeFetcher
from .concept_extractor import ConceptExtractor


@dataclass
class TagCandidate:
    """A potential new tag discovered from research."""

    term: str
    suggested_tag_id: str
    frequency: int  # How many times found
    sources: list[str]  # Video IDs or URLs where found
    sample_context: str
    existing_tag: Optional[str]  # If maps to existing tag
    status: str = "candidate"  # candidate, approved, rejected


class TagDiscovery:
    """Discovers new tags from YouTube and web research."""

    def __init__(self):
        """Initialize with fetcher and extractor."""
        self.fetcher = YouTubeFetcher()
        self.extractor = ConceptExtractor()
        self.candidates_file = TAGS_DIR / "tag_candidates.json"
        self.candidates = self._load_candidates()

    def _load_candidates(self) -> list[TagCandidate]:
        """Load existing candidate tags."""
        if self.candidates_file.exists():
            with open(self.candidates_file, "r") as f:
                data = json.load(f)
                return [TagCandidate(**c) for c in data.get("candidates", [])]
        return []

    def _save_candidates(self):
        """Save candidate tags to file."""
        data = {
            "updated_utc": datetime.utcnow().isoformat(),
            "candidates": [asdict(c) for c in self.candidates],
        }
        with open(self.candidates_file, "w") as f:
            json.dump(data, f, indent=2)

    def research_topic(self, query: str, max_videos: int = 10) -> list[TagCandidate]:
        """Research a topic on YouTube to discover potential tags.

        Args:
            query: Search query (e.g., 'common errors', 'crashes').
            max_videos: Number of videos to analyze.

        Returns:
            List of discovered tag candidates.
        """
        print(f"🔍 Researching: '{query}' ({max_videos} videos)...")

        # Fetch videos
        videos = self.fetcher.search_videos(query, max_results=max_videos)
        print(f"   Found {len(videos)} videos")

        # Extract concepts from each
        term_frequency: dict[str, TagCandidate] = {}

        for video in videos:
            concepts = self.extractor.extract_from_video(
                title=video.title,
                description=video.description,
                video_tags=video.tags,
            )

            for concept in concepts:
                term = concept.term.lower()

                if term in term_frequency:
                    term_frequency[term].frequency += 1
                    term_frequency[term].sources.append(video.video_id)
                else:
                    # Generate suggested tag_id
                    suggested_id = self._suggest_tag_id(concept.term)

                    term_frequency[term] = TagCandidate(
                        term=concept.term,
                        suggested_tag_id=concept.tag_id or suggested_id,
                        frequency=1,
                        sources=[video.video_id],
                        sample_context=concept.context,
                        existing_tag=concept.tag_id,
                    )

        # Sort by frequency
        candidates = sorted(
            term_frequency.values(),
            key=lambda x: x.frequency,
            reverse=True,
        )

        print(f"   Discovered {len(candidates)} concepts")
        return candidates

    def _suggest_tag_id(self, term: str) -> str:
        """Generate a suggested tag_id from a term.

        Args:
            term: Raw term (e.g., 'D3D Device Lost').

        Returns:
            Suggested tag_id (e.g., 'crash.d3d_device_lost').
        """
        # Normalize
        normalized = term.lower()
        normalized = normalized.replace(" ", "_")
        normalized = normalized.replace("-", "_")

        # Categorize based on patterns
        if any(x in normalized for x in ["error", "crash", "fail", "exception"]):
            return f"crash.{normalized}"
        elif any(x in normalized for x in ["exit", "code", "build", "package"]):
            return f"build.{normalized}"
        elif any(x in normalized for x in ["0x", "lnk", "c0"]):
            return f"error.{normalized}"
        else:
            return f"topic.{normalized}"

    def run_research_session(self, queries: list[str]) -> list[TagCandidate]:
        """Run a full research session across multiple queries.

        Args:
            queries: List of search queries.

        Returns:
            Combined list of all discovered candidates.
        """
        all_candidates = []

        for query in queries:
            candidates = self.research_topic(query)
            all_candidates.extend(candidates)

        # Deduplicate
        seen = set()
        unique = []
        for c in all_candidates:
            if c.term.lower() not in seen:
                seen.add(c.term.lower())
                unique.append(c)

        # Add to persisted candidates
        for candidate in unique:
            if not any(c.term.lower() == candidate.term.lower() for c in self.candidates):
                self.candidates.append(candidate)

        self._save_candidates()
        return unique

    def list_candidates(self, status: Optional[str] = None) -> list[TagCandidate]:
        """List all candidate tags.

        Args:
            status: Filter by status (candidate, approved, rejected).

        Returns:
            Filtered list of candidates.
        """
        if status:
            return [c for c in self.candidates if c.status == status]
        return self.candidates

    def approve_candidate(self, term: str) -> Optional[TagCandidate]:
        """Approve a candidate tag for addition to tags.json.

        Args:
            term: The term to approve.

        Returns:
            The approved candidate, or None if not found.
        """
        for candidate in self.candidates:
            if candidate.term.lower() == term.lower():
                candidate.status = "approved"
                self._save_candidates()
                return candidate
        return None

    def reject_candidate(self, term: str) -> Optional[TagCandidate]:
        """Reject a candidate tag.

        Args:
            term: The term to reject.

        Returns:
            The rejected candidate, or None if not found.
        """
        for candidate in self.candidates:
            if candidate.term.lower() == term.lower():
                candidate.status = "rejected"
                self._save_candidates()
                return candidate
        return None


# Default research queries based on user's research
DEFAULT_RESEARCH_QUERIES = [
    "UE5 packaging error",
    "UE5 ExitCode 25",
    "Unreal Engine crash",
    "UE5 D3D device lost",
    "Lumen artifacts",
    "Nanite performance",
    "Blueprint Accessed None",
    "UE5 multiplayer replication lag",
    "Android packaging failed",
    "iOS provisioning error",
    "MetaSounds not playing",
    "Control Rig crash",
]


def main():
    """CLI for tag discovery."""
    import sys

    discovery = TagDiscovery()

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python -m ingestion.tag_discovery research <query>")
        print("  python -m ingestion.tag_discovery research-all")
        print("  python -m ingestion.tag_discovery list [status]")
        print("  python -m ingestion.tag_discovery approve <term>")
        print("  python -m ingestion.tag_discovery reject <term>")
        return

    command = sys.argv[1]

    if command == "research":
        query = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "UE5 common errors"
        candidates = discovery.research_topic(query)

        print(f"\n📋 Top discoveries:")
        for c in candidates[:10]:
            tag_info = f" -> {c.existing_tag}" if c.existing_tag else f" (new: {c.suggested_tag_id})"
            print(f"  [{c.frequency}x] {c.term}{tag_info}")

    elif command == "research-all":
        print("🔬 Running full research session...")
        candidates = discovery.run_research_session(DEFAULT_RESEARCH_QUERIES)

        print(f"\n✅ Discovered {len(candidates)} unique concepts")
        print(f"   Saved to: {discovery.candidates_file}")

    elif command == "list":
        status = sys.argv[2] if len(sys.argv) > 2 else None
        candidates = discovery.list_candidates(status)

        print(f"\n📋 Tag Candidates ({len(candidates)} total):")
        for c in candidates:
            status_icon = {"candidate": "⏳", "approved": "✅", "rejected": "❌"}.get(c.status, "?")
            print(f"  {status_icon} {c.term} -> {c.suggested_tag_id} ({c.frequency}x)")

    elif command == "approve":
        term = " ".join(sys.argv[2:])
        if discovery.approve_candidate(term):
            print(f"✅ Approved: {term}")
        else:
            print(f"❌ Not found: {term}")

    elif command == "reject":
        term = " ".join(sys.argv[2:])
        if discovery.reject_candidate(term):
            print(f"❌ Rejected: {term}")
        else:
            print(f"❌ Not found: {term}")


if __name__ == "__main__":
    main()
