"""Synonym Ring Search Layer.

Intercepts user search terms and maps to canonical tags.
Allows users to search "BP" and find "scripting.blueprint" content.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .config import TAGS_DIR


@dataclass
class SearchResult:
    """A search term mapped to a canonical tag."""

    query_term: str
    matched_tag_id: str
    match_type: str  # exact, synonym, alias, fuzzy
    confidence: float
    display_name: str


class SynonymSearch:
    """Maps search terms to canonical tags using synonym rings."""

    def __init__(self):
        """Initialize with tag database."""
        self.tags = self._load_tags()
        self.synonym_index = self._build_synonym_index()
        self.alias_index = self._build_alias_index()

    def _load_tags(self) -> dict:
        """Load canonical tags from tags.json."""
        tags_file = TAGS_DIR / "tags.json"
        if tags_file.exists():
            with open(tags_file, "r") as f:
                data = json.load(f)
                return {t["tag_id"]: t for t in data.get("tags", [])}
        return {}

    def _build_synonym_index(self) -> dict[str, str]:
        """Build index mapping synonyms to tag_ids."""
        index = {}
        for tag_id, tag in self.tags.items():
            # Add display name
            name = tag.get("display_name", "").lower()
            if name:
                index[name] = tag_id

            # Add all synonyms
            for syn in tag.get("synonyms", []):
                index[syn.lower()] = tag_id

        return index

    def _build_alias_index(self) -> dict[str, tuple[str, str]]:
        """Build index mapping aliases to (tag_id, alias_type)."""
        index = {}
        for tag_id, tag in self.tags.items():
            for alias in tag.get("aliases", []):
                value = alias.get("value", "").lower()
                alias_type = alias.get("type", "unknown")
                if value:
                    index[value] = (tag_id, alias_type)
        return index

    def search(self, query: str) -> list[SearchResult]:
        """Search for tags matching the query.

        Args:
            query: User search query (e.g., "BP", "visual scripting").

        Returns:
            List of matched tags, sorted by confidence.
        """
        results = []
        query_lower = query.lower().strip()
        query_words = query_lower.split()

        # 1. Exact match on tag_id
        for tag_id, tag in self.tags.items():
            if query_lower == tag_id.lower():
                results.append(
                    SearchResult(
                        query_term=query,
                        matched_tag_id=tag_id,
                        match_type="exact",
                        confidence=1.0,
                        display_name=tag.get("display_name", tag_id),
                    )
                )

        # 2. Synonym match
        if query_lower in self.synonym_index:
            tag_id = self.synonym_index[query_lower]
            tag = self.tags.get(tag_id, {})
            results.append(
                SearchResult(
                    query_term=query,
                    matched_tag_id=tag_id,
                    match_type="synonym",
                    confidence=0.95,
                    display_name=tag.get("display_name", tag_id),
                )
            )

        # 3. Alias match
        if query_lower in self.alias_index:
            tag_id, alias_type = self.alias_index[query_lower]
            tag = self.tags.get(tag_id, {})
            results.append(
                SearchResult(
                    query_term=query,
                    matched_tag_id=tag_id,
                    match_type=f"alias_{alias_type}",
                    confidence=0.9,
                    display_name=tag.get("display_name", tag_id),
                )
            )

        # 4. Partial synonym match (multi-word queries)
        for word in query_words:
            if len(word) >= 3 and word in self.synonym_index:
                tag_id = self.synonym_index[word]
                if not any(r.matched_tag_id == tag_id for r in results):
                    tag = self.tags.get(tag_id, {})
                    results.append(
                        SearchResult(
                            query_term=word,
                            matched_tag_id=tag_id,
                            match_type="partial",
                            confidence=0.7,
                            display_name=tag.get("display_name", tag_id),
                        )
                    )

        # 5. Fuzzy match on display names
        for tag_id, tag in self.tags.items():
            display = tag.get("display_name", "").lower()
            if query_lower in display or display in query_lower:
                if not any(r.matched_tag_id == tag_id for r in results):
                    results.append(
                        SearchResult(
                            query_term=query,
                            matched_tag_id=tag_id,
                            match_type="fuzzy",
                            confidence=0.6,
                            display_name=tag.get("display_name", tag_id),
                        )
                    )

        # Sort by confidence
        results.sort(key=lambda x: x.confidence, reverse=True)
        return results

    def resolve(self, query: str) -> Optional[str]:
        """Resolve a query to a single canonical tag_id.

        Args:
            query: User search term.

        Returns:
            Best matching tag_id, or None if no match.
        """
        results = self.search(query)
        return results[0].matched_tag_id if results else None

    def expand(self, tag_id: str) -> list[str]:
        """Get all search terms that map to a tag.

        Args:
            tag_id: The canonical tag ID.

        Returns:
            List of all terms (synonyms, aliases) for this tag.
        """
        tag = self.tags.get(tag_id, {})
        terms = [tag.get("display_name", "")]
        terms.extend(tag.get("synonyms", []))
        terms.extend(a.get("value", "") for a in tag.get("aliases", []))
        return [t for t in terms if t]


def main():
    """CLI for synonym search testing."""
    import sys

    searcher = SynonymSearch()

    if len(sys.argv) < 2:
        print("Usage: python -m ingestion.synonym_search <query>")
        print("\nExamples:")
        print("  python -m ingestion.synonym_search BP")
        print("  python -m ingestion.synonym_search 'visual scripting'")
        print("  python -m ingestion.synonym_search nanite")
        return

    query = " ".join(sys.argv[1:])
    print(f"🔍 Searching for: '{query}'")

    results = searcher.search(query)

    if results:
        print(f"\n📋 Found {len(results)} matches:")
        for r in results:
            print(f"  [{r.confidence:.0%}] {r.display_name}")
            print(f"       Tag: {r.matched_tag_id}")
            print(f"       Match: {r.match_type}")
    else:
        print("\n❌ No matches found")


if __name__ == "__main__":
    main()
