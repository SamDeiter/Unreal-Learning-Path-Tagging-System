"""Epic Games Documentation Fetcher — Dynamic Vector Search Edition.

Provides links to official UE5 documentation based on tags.
Replaces hardcoded DOC_MAPPINGS with cosine-similarity search
against docs_embeddings.json vectors.  Falls back to the static
mapping when embeddings are unavailable (offline / no API key).
"""

import json
import math
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


@dataclass
class DocResource:
    """An Epic Games documentation resource."""

    title: str
    url: str
    category: str
    description: str | None = None
    thumbnail_url: str | None = None
    similarity: float | None = None


# ---------------------------------------------------------------------------
# Static fallback (kept intentionally small — covers the most common tags)
# ---------------------------------------------------------------------------
DOCS_BASE = "https://dev.epicgames.com/documentation/en-us/unreal-engine"
DEFAULT_THUMBNAIL = "https://dev.epicgames.com/static/icons/ue5-logo.svg"

STATIC_DOC_MAPPINGS: dict[str, list[DocResource]] = {
    "rendering.lumen": [
        DocResource(
            title="Lumen Global Illumination and Reflections",
            url=f"{DOCS_BASE}/lumen-global-illumination-and-reflections-in-unreal-engine",
            category="Rendering",
            description="Official guide to Lumen GI and reflections",
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
    "multiplayer.replication": [
        DocResource(
            title="Networking and Multiplayer",
            url=f"{DOCS_BASE}/networking-and-multiplayer-in-unreal-engine",
            category="Multiplayer",
            description="Replication and multiplayer concepts",
        ),
    ],
}


# ---------------------------------------------------------------------------
# Cosine similarity
# ---------------------------------------------------------------------------
def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ---------------------------------------------------------------------------
# Embedding generation
# ---------------------------------------------------------------------------
def _embed_text(text: str, api_key: str) -> list[float] | None:
    """Generate an embedding for a text string using Gemini API."""
    model = "gemini-embedding-001"
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"models/{model}:embedContent?key={api_key}"
    )
    payload = json.dumps({
        "model": f"models/{model}",
        "content": {"parts": [{"text": text}]},
        "taskType": "RETRIEVAL_QUERY",
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data.get("embedding", {}).get("values")
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        print(f"   ⚠️  Embedding API error: {e}")
        return None


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------
class EpicDocsFetcher:
    """Maps tags to official Epic Games documentation.

    Dynamically searches docs_embeddings.json via cosine similarity.
    Falls back to STATIC_DOC_MAPPINGS when embeddings or API key
    are unavailable.
    """

    def __init__(self, embeddings_path: str | Path | None = None):
        """Initialize with optional path to docs_embeddings.json."""
        self._embeddings: dict | None = None
        self._api_key = os.environ.get("GEMINI_API_KEY", "")

        # Auto-discover embeddings file
        if embeddings_path is None:
            candidates = [
                Path(__file__).parent.parent
                / "path-builder" / "src" / "data" / "docs_embeddings.json",
                Path(__file__).parent / "docs_embeddings.json",
            ]
            for p in candidates:
                if p.exists():
                    embeddings_path = p
                    break

        if embeddings_path and Path(embeddings_path).exists():
            try:
                with open(embeddings_path, encoding="utf-8") as f:
                    self._embeddings = json.load(f)
                doc_count = len(self._embeddings.get("docs", {}))
                print(f"   📚 Loaded {doc_count} doc embeddings from {Path(embeddings_path).name}")
            except Exception as e:
                print(f"   ⚠️  Failed to load embeddings: {e}")

    def _vector_search(self, query: str, top_n: int = 5) -> list[DocResource]:
        """Search docs_embeddings.json by cosine similarity."""
        if not self._embeddings or not self._api_key:
            return []

        query_embedding = _embed_text(query, self._api_key)
        if not query_embedding:
            return []

        docs = self._embeddings.get("docs", {})
        scored = []

        for _doc_id, doc in docs.items():
            doc_emb = doc.get("embedding", [])
            if not doc_emb:
                continue
            # Handle dimension mismatch: truncate to shorter
            min_dim = min(len(query_embedding), len(doc_emb))
            sim = _cosine_similarity(query_embedding[:min_dim], doc_emb[:min_dim])
            scored.append((sim, doc))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Deduplicate by URL, keeping highest score
        seen_urls = set()
        results = []
        for sim, doc in scored[:top_n * 2]:  # get extras to handle dedup
            url = doc.get("url", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)

            # Infer category from slug or URL
            slug = doc.get("slug", "")
            category = slug.split("/")[0].title() if "/" in slug else "UE5 Docs"

            results.append(DocResource(
                title=doc.get("title", doc.get("section", "UE5 Documentation")),
                url=url,
                category=category,
                description=doc.get("section", ""),
                thumbnail_url=DEFAULT_THUMBNAIL,
                similarity=round(sim, 4),
            ))

            if len(results) >= top_n:
                break

        return results

    def get_docs_for_tag(self, tag_id: str) -> list[DocResource]:
        """Get documentation resources for a tag.

        Tries vector search first, falls back to static mapping.

        Args:
            tag_id: The canonical tag ID (e.g. 'rendering.lumen').

        Returns:
            List of DocResource objects.
        """
        # Try vector search first
        if self._embeddings and self._api_key:
            # Convert tag_id to a natural language query
            query = tag_id.replace(".", " ").replace("_", " ")
            results = self._vector_search(f"Unreal Engine 5 {query}", top_n=3)
            if results:
                return results

        # Fall back to static mapping
        docs = STATIC_DOC_MAPPINGS.get(tag_id, [])
        for doc in docs:
            if not doc.thumbnail_url:
                doc.thumbnail_url = DEFAULT_THUMBNAIL
        return docs

    def get_docs_for_tags(self, tag_ids: list[str]) -> list[DocResource]:
        """Get documentation resources for multiple tags.

        Args:
            tag_ids: List of tag IDs.

        Returns:
            Deduplicated list of DocResource objects.
        """
        seen_urls: set[str] = set()
        docs: list[DocResource] = []

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

    # Test static fallback
    docs = fetcher.get_docs_for_tags(["rendering.lumen", "build.packaging"])
    print(f"\n📚 Found {len(docs)} docs:")
    for doc in docs:
        print(f"  - {doc.title}")
        print(f"    URL: {doc.url}")
        if doc.similarity is not None:
            print(f"    Similarity: {doc.similarity:.2%}")


if __name__ == "__main__":
    main()
