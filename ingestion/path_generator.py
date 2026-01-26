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
from .timestamp_extractor import TimestampExtractor
from .gemini_helper import GeminiHelper


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
    snippets: Optional[list[dict]] = None  # Timestamped sections
    thumbnail_url: Optional[str] = None  # Preview image
    description: Optional[str] = None  # Brief description


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
    # AI-generated guidance
    ai_summary: Optional[str] = None
    ai_what_you_learn: Optional[list[str]] = None
    ai_estimated_time: Optional[str] = None
    ai_difficulty: Optional[str] = None
    ai_hint: Optional[str] = None


class PathGenerator:
    """Generates learning paths from user queries using tags."""

    STEP_TYPES = ["foundations", "diagnostics", "resolution", "prevention"]

    def __init__(self):
        """Initialize with tag database and content fetchers."""
        self.tags = self._load_tags()
        self.fetcher = YouTubeFetcher()
        self.extractor = ConceptExtractor()
        self.timestamp_extractor = TimestampExtractor()
        self.gemini = GeminiHelper()

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
                    thumbnail_url=video.thumbnail_url,
                    description=video.description[:150] + "..." if len(video.description) > 150 else video.description,
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
        """Generate a complete learning path from a query using AI curation.

        Args:
            query: User's problem statement (e.g., "UE5 packaging fails").

        Returns:
            Assembled learning path with steps and content.
        """
        # Extract tags
        tags = self.extract_query_tags(query)
        if not tags:
            tags = ["build.packaging"]  # Default

        # Collect all videos first
        all_videos = []
        for tag_id in tags[:3]:
            tag = self.tags.get(tag_id, {})
            display_name = tag.get("display_name", tag_id.split(".")[-1])
            search_query = f"UE5 {display_name}"
            videos = self.fetcher.search_videos(search_query, max_results=5, epic_only=True)
            
            for video in videos:
                all_videos.append({
                    "video_id": video.video_id,
                    "title": video.title,
                    "description": video.description,
                    "thumbnail_url": video.thumbnail_url,
                    "url": f"https://youtube.com/watch?v={video.video_id}",
                })

        # Use AI to curate the path
        steps = []
        ai_summary = None
        ai_what_you_learn = None
        ai_estimated_time = None
        ai_difficulty = None
        ai_hint = None

        if self.gemini.is_available() and all_videos:
            curated = self.gemini.curate_learning_path(query, all_videos)
            
            if curated:
                ai_summary = curated.get("problem_overview")
                
                for step_data in curated.get("steps", []):
                    # Build content items from curated videos
                    content = []
                    for vid_ref in step_data.get("videos", []):
                        idx = vid_ref.get("video_index", 1) - 1
                        if 0 <= idx < len(all_videos):
                            video = all_videos[idx]
                            # Build enhanced description with AI context
                            desc = f"**Why this helps:** {vid_ref.get('why_relevant', '')}"
                            if vid_ref.get('timestamp_hint'):
                                desc += f"\n\n⏱️ **When to watch:** {vid_ref['timestamp_hint']}"
                            if vid_ref.get('watch_duration'):
                                desc += f" ({vid_ref['watch_duration']})"
                            
                            content.append(ContentItem(
                                content_id=video["video_id"],
                                title=video["title"],
                                source_type="video",
                                url=video["url"],
                                matched_tags=tags[:1],
                                relevance_score=0.9,
                                step_type=step_data.get("step_type", "foundations"),
                                thumbnail_url=video["thumbnail_url"],
                                description=desc,
                            ))
                    
                    if content:
                        step_desc = step_data.get("description", "")
                        if step_data.get("action"):
                            step_desc += f"\n\n👉 **Action:** {step_data['action']}"
                        
                        steps.append(LearningStep(
                            step_number=step_data.get("step_number", len(steps) + 1),
                            step_type=step_data.get("step_type", "foundations"),
                            title=step_data.get("title", f"Step {len(steps) + 1}"),
                            description=step_desc,
                            content=content,
                            skills_gained=[step_data.get("action", "")],
                        ))

        # Fallback to old method if AI fails
        if not steps:
            content_by_step = self.find_content(tags)
            step_config = {
                "foundations": {"title": "📚 Step 1: Understand the Basics", "description": "Build foundational knowledge"},
                "diagnostics": {"title": "🔍 Step 2: Diagnose Your Issue", "description": "Identify the root cause"},
                "resolution": {"title": "🔧 Step 3: Apply the Fix", "description": "Implement the solution"},
                "prevention": {"title": "🛡️ Step 4: Prevent Future Issues", "description": "Learn best practices"},
            }
            for i, step_type in enumerate(self.STEP_TYPES):
                content = content_by_step[step_type]
                if content:
                    config = step_config[step_type]
                    steps.append(LearningStep(
                        step_number=i + 1,
                        step_type=step_type,
                        title=config["title"],
                        description=config["description"],
                        content=content,
                        skills_gained=[],
                    ))

        # Create path
        path_id = query.lower().replace(" ", "_")[:30]
        path = LearningPath(
            path_id=path_id,
            title=f"Learning Path: {query[:50]}",
            query=query,
            tags=tags,
            steps=steps,
            ai_summary=ai_summary,
            ai_what_you_learn=ai_what_you_learn,
            ai_estimated_time=ai_estimated_time,
            ai_difficulty=ai_difficulty,
            ai_hint=ai_hint,
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
