"""Ingestion module for UE5 learning content."""

from .concept_extractor import ConceptExtractor, ExtractedConcept
from .config import PROJECT_ROOT, TAGS_DIR, get_youtube_api_key
from .youtube_fetcher import VideoMetadata, YouTubeFetcher

__all__ = [
    "get_youtube_api_key",
    "PROJECT_ROOT",
    "TAGS_DIR",
    "YouTubeFetcher",
    "VideoMetadata",
    "ConceptExtractor",
    "ExtractedConcept",
]
