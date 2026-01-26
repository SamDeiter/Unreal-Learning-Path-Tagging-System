"""Concept extractor using TF-IDF and pattern matching.

Extracts UE5 concepts, error codes, and topics from video metadata.
Maps extracted concepts to canonical tags from tags.json.
"""

import json
import re
from collections import Counter
from dataclasses import dataclass
from math import log
from pathlib import Path
from typing import Optional

from .config import TAGS_DIR


@dataclass
class ExtractedConcept:
    """A concept extracted from text with confidence score."""

    term: str
    tag_id: Optional[str]  # Matched canonical tag
    confidence: float
    source: str  # Where it was found (title, description, etc.)
    context: str  # Surrounding text


# Pre-compiled patterns for UE5 concepts
ERROR_PATTERNS = {
    # AutomationTool exit codes
    r"ExitCode[=:\s]*(\d+)": "build.exitcode_{0}",
    r"Unknown Cook Failure": "build.exitcode_25",
    # Hex error codes
    r"0x[0-9A-Fa-f]{8}": None,  # Generic hex
    r"0xC0000005": "crash.access_violation",
    r"0x887[Aa]0006": "crash.d3d_device_lost",
    r"DXGI_ERROR_DEVICE_REMOVED": "crash.d3d_device_lost",
    # Compiler errors
    r"LNK\d{4}": "scripting.cpp",  # Linker errors
    r"C\d{4}": "scripting.cpp",  # Compiler errors
    r"CS\d{4}": "build.csharp",  # C# build errors
    # Blueprint runtime
    r"Accessed None": "scripting.blueprint",
    r"Infinite Loop": "scripting.blueprint",
}

# UE5 system keywords mapped to tags
SYSTEM_KEYWORDS = {
    "nanite": "rendering.nanite",
    "lumen": "rendering.lumen",
    "niagara": "rendering.niagara",
    "blueprint": "scripting.blueprint",
    "c++": "scripting.cpp",
    "cpp": "scripting.cpp",
    "metahuman": "character.metahuman",
    "sequencer": "cinematic.sequencer",
    "control rig": "animation.control_rig",
    "behavior tree": "ai.behavior_tree",
    "replication": "multiplayer.replication",
    "packaging": "build.packaging",
    "cooking": "build.packaging",
    "landscape": "environment.landscape",
    "material": "rendering.material",
    "vr": "platform.vr",
    "quest": "platform.quest",
    "metasounds": "audio.metasounds",
    "chaos": "physics.chaos",
    "pcg": "procedural.pcg",
    "world partition": "environment.world_partition",
}


class ConceptExtractor:
    """Extracts UE5 concepts from text using TF-IDF and patterns."""

    def __init__(self):
        """Initialize with tag database for matching."""
        self.tags = self._load_tags()
        self.tag_synonyms = self._build_synonym_index()

    def _load_tags(self) -> dict:
        """Load canonical tags from tags.json."""
        tags_file = TAGS_DIR / "tags.json"
        if tags_file.exists():
            with open(tags_file, "r") as f:
                data = json.load(f)
                return {t["tag_id"]: t for t in data.get("tags", [])}
        return {}

    def _build_synonym_index(self) -> dict[str, str]:
        """Build reverse index from synonyms to tag_ids."""
        index = {}
        for tag_id, tag in self.tags.items():
            # Add display name
            name = tag.get("display_name", "").lower()
            if name:
                index[name] = tag_id

            # Add synonyms
            for syn in tag.get("synonyms", []):
                index[syn.lower()] = tag_id

            # Add aliases
            for alias in tag.get("aliases", []):
                value = alias.get("value", "").lower()
                if value:
                    index[value] = tag_id

        return index

    def extract_error_codes(self, text: str) -> list[ExtractedConcept]:
        """Extract error codes and signatures from text.

        Args:
            text: Text to search (title + description).

        Returns:
            List of extracted error concepts.
        """
        concepts = []
        text_lower = text.lower()

        for pattern, tag_template in ERROR_PATTERNS.items():
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                term = match.group(0)

                # Determine tag_id
                if tag_template and "{0}" in tag_template:
                    # Dynamic tag (e.g., ExitCode=25 -> build.exitcode_25)
                    try:
                        tag_id = tag_template.format(match.group(1))
                    except IndexError:
                        tag_id = None
                else:
                    tag_id = tag_template

                # Get context
                start = max(0, match.start() - 30)
                end = min(len(text), match.end() + 30)
                context = text[start:end]

                concepts.append(
                    ExtractedConcept(
                        term=term,
                        tag_id=tag_id,
                        confidence=0.95,  # High confidence for exact patterns
                        source="pattern_match",
                        context=context,
                    )
                )

        return concepts

    def extract_keywords(self, text: str) -> list[ExtractedConcept]:
        """Extract UE5 system keywords from text.

        Args:
            text: Text to search.

        Returns:
            List of extracted keyword concepts.
        """
        concepts = []
        text_lower = text.lower()

        for keyword, tag_id in SYSTEM_KEYWORDS.items():
            if keyword in text_lower:
                # Find position for context
                pos = text_lower.find(keyword)
                start = max(0, pos - 20)
                end = min(len(text), pos + len(keyword) + 20)
                context = text[start:end]

                concepts.append(
                    ExtractedConcept(
                        term=keyword,
                        tag_id=tag_id,
                        confidence=0.85,
                        source="keyword_match",
                        context=context,
                    )
                )

        return concepts

    def extract_from_video(
        self,
        title: str,
        description: str,
        video_tags: Optional[list[str]] = None,
    ) -> list[ExtractedConcept]:
        """Extract all concepts from video metadata.

        Args:
            title: Video title.
            description: Video description.
            video_tags: YouTube video tags.

        Returns:
            Combined list of extracted concepts.
        """
        all_concepts = []

        # Combine text sources
        full_text = f"{title} {description}"
        if video_tags:
            full_text += " " + " ".join(video_tags)

        # Extract error codes (highest priority)
        all_concepts.extend(self.extract_error_codes(full_text))

        # Extract keywords
        all_concepts.extend(self.extract_keywords(full_text))

        # Deduplicate by tag_id
        seen_tags = set()
        unique_concepts = []
        for concept in all_concepts:
            if concept.tag_id and concept.tag_id not in seen_tags:
                seen_tags.add(concept.tag_id)
                unique_concepts.append(concept)
            elif not concept.tag_id:
                unique_concepts.append(concept)

        return unique_concepts

    def calculate_tf_idf(
        self,
        documents: list[str],
        min_df: int = 2,
    ) -> dict[str, float]:
        """Calculate TF-IDF scores for terms across documents.

        Used to identify high-value discriminative terms.

        Args:
            documents: List of document texts.
            min_df: Minimum document frequency to include.

        Returns:
            Dictionary of term -> TF-IDF score.
        """
        # Tokenize
        word_pattern = re.compile(r"\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b")
        doc_tokens = [
            Counter(word_pattern.findall(doc.lower()))
            for doc in documents
        ]

        # Calculate document frequencies
        df = Counter()
        for tokens in doc_tokens:
            df.update(tokens.keys())

        # Filter by min_df
        n_docs = len(documents)
        tf_idf = {}

        for term, doc_freq in df.items():
            if doc_freq < min_df:
                continue

            # Calculate average TF across docs containing term
            total_tf = sum(tokens.get(term, 0) for tokens in doc_tokens)
            avg_tf = total_tf / doc_freq

            # Calculate IDF
            idf = log(n_docs / doc_freq)

            tf_idf[term] = avg_tf * idf

        return tf_idf


def main():
    """Test concept extraction."""
    print("🔍 Testing Concept Extractor...")

    extractor = ConceptExtractor()

    # Test with sample video metadata
    test_title = "UE5 Packaging Fails with ExitCode=25 - Full Fix Tutorial"
    test_description = """
    In this video, I'll show you how to fix the dreaded Unknown Cook Failure
    error in Unreal Engine 5. This error (ExitCode=25) often appears when
    packaging your game and can be caused by naming issues, corrupt assets,
    or Blueprint compilation errors. We'll also cover Nanite and Lumen
    optimizations to prevent future issues.
    """

    concepts = extractor.extract_from_video(test_title, test_description)

    print(f"\n📋 Extracted {len(concepts)} concepts:")
    for concept in concepts:
        print(f"  - {concept.term} -> {concept.tag_id} ({concept.confidence:.0%})")


if __name__ == "__main__":
    main()
