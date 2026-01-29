"""Tag Enrichment Pipeline for UE5 Learning Path System.

A 6-phase pipeline to enrich video courses with comprehensive tags
using local Python processing and minimal API usage.

Phases:
    0: Load existing VTT transcripts (31 courses)
    1: Extract keywords from filenames
    2: Whisper GPU transcription (76 courses)
    3: Tag extraction + normalization
    4: Edge relationship generation
    5: Gemini batch (sparse courses only)
"""

__version__ = "1.0.0"
