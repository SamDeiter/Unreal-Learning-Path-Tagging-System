"""Phase 3: Tag Extraction and Normalization.

Extracts UE5 terms from transcripts and normalizes them
to canonical tag forms.
"""

import re
from collections import Counter

from .vocabulary import (
    UE5_TERMS,
    normalize_tag,
    to_canonical,
)


def extract_ue5_terms(text: str, min_count: int = 2) -> dict[str, int]:
    """Extract UE5 terms from text with counts.

    Args:
        text: Transcript or combined text.
        min_count: Minimum occurrences to include.

    Returns:
        Dictionary of term -> count.
    """
    text_lower = text.lower()
    term_counts = {}

    # Count single-word terms
    words = re.findall(r'\b\w+\b', text_lower)
    word_counter = Counter(words)

    for term in UE5_TERMS:
        if ' ' not in term:
            # Single word term
            count = word_counter.get(term, 0)
        else:
            # Multi-word term - count occurrences
            count = text_lower.count(term)

        if count >= min_count:
            term_counts[term] = count

    return term_counts


def normalize_terms(term_counts: dict[str, int]) -> dict[str, int]:
    """Normalize terms to canonical forms, combining counts.

    Args:
        term_counts: Dictionary of raw term -> count.

    Returns:
        Dictionary of normalized term -> combined count.
    """
    normalized = {}

    for term, count in term_counts.items():
        norm_term = normalize_tag(term)
        if norm_term in normalized:
            normalized[norm_term] += count
        else:
            normalized[norm_term] = count

    return normalized


def get_canonical_tags(normalized_terms: dict[str, int]) -> list[str]:
    """Map normalized terms to canonical tag IDs.

    Args:
        normalized_terms: Dictionary of normalized term -> count.

    Returns:
        List of canonical tag IDs.
    """
    canonical = []

    for term in normalized_terms:
        tag_id = to_canonical(term)
        if tag_id and tag_id not in canonical:
            canonical.append(tag_id)

    return canonical


def extract_tags_from_transcript(
    transcript: str,
    min_count: int = 2,
    max_tags: int = 15,
) -> dict:
    """Extract and process tags from a transcript.

    Args:
        transcript: Full course transcript.
        min_count: Minimum term occurrences.
        max_tags: Maximum number of ai_tags to return.

    Returns:
        Dictionary with ai_tags, canonical_tags, and stats.
    """
    # Extract raw terms
    raw_terms = extract_ue5_terms(transcript, min_count)

    # Normalize
    normalized = normalize_terms(raw_terms)

    # Sort by frequency
    sorted_terms = sorted(normalized.items(), key=lambda x: -x[1])

    # Get top terms as ai_tags
    ai_tags = [t[0] for t in sorted_terms[:max_tags]]

    # Get canonical mappings
    canonical_tags = get_canonical_tags(normalized)

    return {
        "ai_tags": ai_tags,
        "canonical_tags": canonical_tags,
        "term_counts": dict(sorted_terms[:20]),
        "total_ue5_terms": sum(normalized.values()),
    }


def run_phase3(
    transcripts: dict[str, str],
    filename_keywords: dict[str, list[str]],
) -> dict[str, dict]:
    """Execute Phase 3: Tag extraction and normalization.

    Args:
        transcripts: Dictionary of course code -> transcript.
        filename_keywords: Dictionary of course code -> filename keywords.

    Returns:
        Dictionary mapping course codes to tag results.
    """
    print("🏷️  Phase 3: Extracting and normalizing tags...")

    results = {}
    total_ai_tags = 0
    total_canonical = 0

    for code in set(transcripts.keys()) | set(filename_keywords.keys()):
        # Combine transcript with filename keywords
        transcript = transcripts.get(code, "")
        keywords = filename_keywords.get(code, [])

        # Add keywords to the text for extraction
        combined_text = transcript + " " + " ".join(keywords * 3)  # Boost keywords

        if not combined_text.strip():
            continue

        # Extract tags
        tag_result = extract_tags_from_transcript(combined_text)

        # Add filename keywords that aren't already in ai_tags
        for kw in keywords:
            norm_kw = normalize_tag(kw)
            if norm_kw not in tag_result['ai_tags']:
                tag_result['ai_tags'].append(norm_kw)

        results[code] = tag_result
        total_ai_tags += len(tag_result['ai_tags'])
        total_canonical += len(tag_result['canonical_tags'])

    avg_ai = total_ai_tags / len(results) if results else 0
    avg_canonical = total_canonical / len(results) if results else 0

    print(f"   ✅ Processed {len(results)} courses")
    print(f"   📊 Average ai_tags per course: {avg_ai:.1f}")
    print(f"   📊 Average canonical_tags per course: {avg_canonical:.1f}")

    # Show sample
    if results:
        sample_code = list(results.keys())[0]
        sample = results[sample_code]
        print(f"   📝 Sample {sample_code}:")
        print(f"      ai_tags: {sample['ai_tags'][:5]}")
        print(f"      canonical: {sample['canonical_tags'][:3]}")

    return results


if __name__ == "__main__":
    # Test with sample transcript
    sample_transcript = """
    Welcome to this lesson on Niagara particle systems. Today we'll cover
    how to create stunning VFX using the Niagara editor. We'll explore
    emitters, modules, and the Niagara stack. Later, we'll look at
    blueprints and how to trigger Niagara systems from blueprint events.
    We'll also touch on materials and how to create custom materials
    for your particle effects. Don't forget about optimization!
    """

    result = extract_tags_from_transcript(sample_transcript, min_count=1)
    print(f"AI Tags: {result['ai_tags']}")
    print(f"Canonical: {result['canonical_tags']}")
    print(f"Term counts: {result['term_counts']}")
