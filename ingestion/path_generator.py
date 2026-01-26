"""Learning Path Generator.

Uses tags to assemble structured learning paths from existing content.
No new content created - curates YouTube videos, docs, and forum posts.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .config import TAGS_DIR, LEARNING_PATHS_DIR
from .youtube_fetcher import YouTubeFetcher, VideoMetadata
from .concept_extractor import ConceptExtractor


@dataclass
class ContentItem:
    """A piece of content that can be part of a learning path."""

    content_id: str
    title: str
    source_type: str  # video, docs, forum
    url: str
    matched_tags: list[str]
    relevance_score: float
    step_type: Optional[str] = None  # foundations, diagnostics, resolution, prevention


@dataclass
class LearningStep:
    """A step in a learning path."""

    step_number: int
    step_type: str  # foundations, diagnostics, resolution, prevention
    title: str
    description: str
    content: list[ContentItem]
    skills_gained: list[str]


@dataclass
class LearningPath:
    """A complete learning path assembled from existing content."""

    path_id: str
    title: str
    query: str
    tags: list[str]
    steps: list[LearningStep] = field(default_factory=list)
    total_duration_minutes: int = 0


class PathGenerator:
    """Generates learning paths from user queries using tags."""

    STEP_TYPES = ["foundations", "diagnostics", "resolution", "prevention"]

    def __init__(self):
        """Initialize with tag database and content fetchers."""
        self.tags = self._load_tags()
        self.fetcher = YouTubeFetcher()
        self.extractor = ConceptExtractor()

    def _load_tags(self) -> dict:
        """Load canonical tags from tags.json."""
        tags_file = TAGS_DIR / "tags.json"
        if tags_file.exists():
            with open(tags_file, "r") as f:
                data = json.load(f)
                return {t["tag_id"]: t for t in data.get("tags", [])}
        return {}

    def extract_query_tags(self, query: str) -> list[str]:
        """Extract tags from user query.

        Args:
            query: User's problem statement.

        Returns:
            List of matched tag IDs.
        """
        concepts = self.extractor.extract_from_video(
            title=query,
            description=query,
        )
        return [c.tag_id for c in concepts if c.tag_id]

    def find_content(
        self,
        tags: list[str],
        max_per_step: int = 3,
    ) -> dict[str, list[ContentItem]]:
        """Find content matching the tags.

        Args:
            tags: List of tag IDs to match.
            max_per_step: Max content items per step type.

        Returns:
            Dict mapping step_type to content items.
        """
        content_by_step = {step: [] for step in self.STEP_TYPES}

        # Search YouTube for each tag
        for tag_id in tags[:3]:  # Limit to top 3 tags
            tag = self.tags.get(tag_id, {})
            display_name = tag.get("display_name", tag_id.split(".")[-1])

            # Build search query - Epic Games channel only
            search_query = f"UE5 {display_name}"
            videos = self.fetcher.search_videos(search_query, max_results=5, epic_only=True)

            for video in videos:
                # Classify into step type based on title keywords
                step_type = self._classify_content(video.title)

                item = ContentItem(
                    content_id=video.video_id,
                    title=video.title,
                    source_type="video",
                    url=f"https://youtube.com/watch?v={video.video_id}",
                    matched_tags=[tag_id],
                    relevance_score=0.8,
                    step_type=step_type,
                )

                if len(content_by_step[step_type]) < max_per_step:
                    content_by_step[step_type].append(item)

        return content_by_step

    def _classify_content(self, title: str) -> str:
        """Classify content into a step type based on title.

        Args:
            title: Content title.

        Returns:
            One of: foundations, diagnostics, resolution, prevention.
        """
        title_lower = title.lower()

        if any(kw in title_lower for kw in ["fix", "solve", "solution", "how to fix"]):
            return "resolution"
        elif any(kw in title_lower for kw in ["why", "error", "crash", "debug", "issue"]):
            return "diagnostics"
        elif any(kw in title_lower for kw in ["avoid", "prevent", "best practice", "tips"]):
            return "prevention"
        else:
            return "foundations"

    def generate_path(self, query: str) -> LearningPath:
        """Generate a complete learning path from a query.

        Args:
            query: User's problem statement (e.g., "UE5 packaging fails").

        Returns:
            Assembled learning path with steps and content.
        """
        # Extract tags
        tags = self.extract_query_tags(query)
        if not tags:
            # Fallback to keyword search
            tags = ["build.packaging"]  # Default

        # Find content
        content_by_step = self.find_content(tags)

        # Build steps
        steps = []
        step_descriptions = {
            "foundations": "Build the foundational knowledge needed",
            "diagnostics": "Understand what's causing the problem",
            "resolution": "Apply the fix or solution",
            "prevention": "Learn how to prevent this in the future",
        }

        for i, step_type in enumerate(self.STEP_TYPES):
            content = content_by_step[step_type]
            if content:
                steps.append(
                    LearningStep(
                        step_number=i + 1,
                        step_type=step_type,
                        title=step_type.capitalize(),
                        description=step_descriptions[step_type],
                        content=content,
                        skills_gained=[f"Understand {step_type}"],
                    )
                )

        # Create path
        path_id = query.lower().replace(" ", "_")[:30]
        path = LearningPath(
            path_id=path_id,
            title=f"Learning Path: {query[:50]}",
            query=query,
            tags=tags,
            steps=steps,
        )

        return path

    def save_path(self, path: LearningPath) -> Path:
        """Save learning path to JSON file.

        Args:
            path: The learning path to save.

        Returns:
            Path to saved file.
        """
        output_dir = LEARNING_PATHS_DIR / "generated"
        output_dir.mkdir(exist_ok=True)

        output_file = output_dir / f"{path.path_id}.json"

        # Convert to dict
        path_dict = {
            "path_id": path.path_id,
            "title": path.title,
            "query": path.query,
            "tags": path.tags,
            "steps": [
                {
                    "step_number": s.step_number,
                    "step_type": s.step_type,
                    "title": s.title,
                    "description": s.description,
                    "content": [
                        {
                            "content_id": c.content_id,
                            "title": c.title,
                            "source_type": c.source_type,
                            "url": c.url,
                            "matched_tags": c.matched_tags,
                        }
                        for c in s.content
                    ],
                    "skills_gained": s.skills_gained,
                }
                for s in path.steps
            ],
        }

        with open(output_file, "w") as f:
            json.dump(path_dict, f, indent=2)

        return output_file


def main():
    """CLI for generating learning paths."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m ingestion.path_generator <query>")
        print('Example: python -m ingestion.path_generator "UE5 packaging error ExitCode 25"')
        return

    query = " ".join(sys.argv[1:])
    print(f"🔍 Generating learning path for: '{query}'")

    generator = PathGenerator()
    path = generator.generate_path(query)

    print(f"\n📚 Learning Path: {path.title}")
    print(f"   Tags: {', '.join(path.tags)}")
    print(f"   Steps: {len(path.steps)}")

    for step in path.steps:
        print(f"\n   Step {step.step_number}: {step.title}")
        for content in step.content[:2]:
            print(f"      - {content.title[:50]}...")

    # Save
    output_file = generator.save_path(path)
    print(f"\n✅ Saved to: {output_file}")


if __name__ == "__main__":
    main()
