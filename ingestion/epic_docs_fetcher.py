"""Epic Games Documentation Fetcher.

Provides links to official UE5 documentation based on tags.
Maps tags to relevant Epic docs URLs.
"""

from dataclasses import dataclass


@dataclass
class DocResource:
    """An Epic Games documentation resource."""

    title: str
    url: str
    category: str
    description: str | None = None
    thumbnail_url: str | None = None


class EpicDocsFetcher:
    """Maps tags to official Epic Games documentation."""

    # Base URL for Epic docs
    DOCS_BASE = "https://dev.epicgames.com/documentation/en-us/unreal-engine"

    # Tag to docs mapping
    DOC_MAPPINGS = {
        # Rendering
        "rendering.lumen": [
            DocResource(
                title="Lumen Global Illumination and Reflections",
                url=f"{DOCS_BASE}/lumen-global-illumination-and-reflections-in-unreal-engine",
                category="Rendering",
                description="Official guide to Lumen GI and reflections",
                thumbnail_url="https://dev.epicgames.com/community/api/images/lumen-gi.png",
            ),
        ],
        "rendering.nanite": [
            DocResource(
                title="Nanite Virtualized Geometry",
                url=f"{DOCS_BASE}/nanite-virtualized-geometry-in-unreal-engine",
                category="Rendering",
                description="Official guide to Nanite mesh virtualization",
            ),
        ],
        # Build/Packaging
        "build.packaging": [
            DocResource(
                title="Packaging Projects",
                url=f"{DOCS_BASE}/packaging-unreal-engine-projects",
                category="Build",
                description="How to package your project for distribution",
            ),
            DocResource(
                title="Cooking Content",
                url=f"{DOCS_BASE}/cooking-content-in-unreal-engine",
                category="Build",
                description="Understanding the content cooking process",
            ),
        ],
        "build.cooking": [
            DocResource(
                title="Cooking Content",
                url=f"{DOCS_BASE}/cooking-content-in-unreal-engine",
                category="Build",
                description="Understanding the content cooking process",
            ),
        ],
        # Scripting
        "scripting.blueprint": [
            DocResource(
                title="Blueprints Visual Scripting",
                url=f"{DOCS_BASE}/blueprints-visual-scripting-in-unreal-engine",
                category="Scripting",
                description="Complete guide to Blueprint visual scripting",
            ),
        ],
        "scripting.cpp": [
            DocResource(
                title="Programming with C++",
                url=f"{DOCS_BASE}/programming-with-c-in-unreal-engine",
                category="Scripting",
                description="C++ programming fundamentals in UE5",
            ),
        ],
        # Multiplayer
        "multiplayer.replication": [
            DocResource(
                title="Networking and Multiplayer",
                url=f"{DOCS_BASE}/networking-and-multiplayer-in-unreal-engine",
                category="Multiplayer",
                description="Replication and multiplayer concepts",
            ),
        ],
        # Crash/Performance
        "crash.d3d_device_lost": [
            DocResource(
                title="GPU Crash Debugging",
                url=f"{DOCS_BASE}/gpu-profiling-and-optimization-in-unreal-engine",
                category="Performance",
                description="Understanding and fixing GPU-related crashes",
            ),
        ],
    }

    # Default thumbnail for docs
    DEFAULT_THUMBNAIL = "https://dev.epicgames.com/static/icons/ue5-logo.svg"

    def get_docs_for_tag(self, tag_id: str) -> list[DocResource]:
        """Get documentation resources for a tag.

        Args:
            tag_id: The canonical tag ID.

        Returns:
            List of DocResource objects.
        """
        docs = self.DOC_MAPPINGS.get(tag_id, [])

        # Add default thumbnail if missing
        for doc in docs:
            if not doc.thumbnail_url:
                doc.thumbnail_url = self.DEFAULT_THUMBNAIL

        return docs

    def get_docs_for_tags(self, tag_ids: list[str]) -> list[DocResource]:
        """Get documentation resources for multiple tags.

        Args:
            tag_ids: List of tag IDs.

        Returns:
            Deduplicated list of DocResource objects.
        """
        seen_urls = set()
        docs = []

        for tag_id in tag_ids:
            for doc in self.get_docs_for_tag(tag_id):
                if doc.url not in seen_urls:
                    seen_urls.add(doc.url)
                    docs.append(doc)

        return docs


def main():
    """Test docs fetcher."""
    fetcher = EpicDocsFetcher()

    print("🔍 Testing Epic Docs Fetcher...")

    docs = fetcher.get_docs_for_tags(["rendering.lumen", "build.packaging"])
    print(f"\n📚 Found {len(docs)} docs:")
    for doc in docs:
        print(f"  - {doc.title}")
        print(f"    URL: {doc.url}")


if __name__ == "__main__":
    main()
