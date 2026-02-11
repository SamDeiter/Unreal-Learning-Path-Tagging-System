"""Phase 1: Extract Keywords from Filenames.

Extracts keywords from video titles and filenames
(video content only - no external sources).
"""

import re

# Common words to ignore
STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can",
    "this", "that", "these", "those", "it", "its", "they", "them",
    "we", "our", "you", "your", "he", "she", "him", "her",
    "part", "chapter", "section", "module", "lesson", "video",
    "introduction", "intro", "outro", "overview", "summary", "conclusion",
    "final", "new", "old", "updated", "version",
}


def tokenize(text: str) -> list[str]:
    """Tokenize text into normalized words.

    Args:
        text: Input text (title or filename).

    Returns:
        List of lowercase tokens.
    """
    # Remove file extensions
    text = re.sub(r'\.(mp4|mov|avi|mkv|webm|vtt|srt)$', '', text, flags=re.IGNORECASE)

    # Remove version numbers and numbering
    text = re.sub(r'\d+[_\-\.]?\d*', '', text)
    text = re.sub(r'V\d+\.\d+', '', text, flags=re.IGNORECASE)

    # Split on separators
    words = re.split(r'[_\-\s\.\(\)\[\]]+', text)

    # Normalize and filter
    tokens = []
    for word in words:
        word = word.lower().strip()
        if len(word) > 2 and word not in STOP_WORDS:
            tokens.append(word)

    return tokens


def extract_from_course(course: dict) -> list[str]:
    """Extract keywords from a course's video data.

    Args:
        course: Course dict with 'title' and 'videos' fields.

    Returns:
        List of unique keywords extracted from video data only.
    """
    keywords = set()

    # Extract from course title
    title = course.get('title', '')
    keywords.update(tokenize(title))

    # Extract from folder name
    folder = course.get('folder_name', '')
    keywords.update(tokenize(folder))

    # Extract from video filenames
    for video in course.get('videos', []):
        video_name = video.get('name', '')
        keywords.update(tokenize(video_name))

    return list(keywords)


def run_phase1(courses: list[dict]) -> dict[str, list[str]]:
    """Execute Phase 1: Extract keywords from filenames.

    Args:
        courses: List of course dictionaries.

    Returns:
        Dictionary mapping course codes to extracted keywords.
    """
    print("📝 Phase 1: Extracting keywords from filenames...")

    course_keywords = {}
    total_keywords = 0

    for course in courses:
        code = course.get('code')
        if not code:
            continue

        keywords = extract_from_course(course)
        course_keywords[code] = keywords
        total_keywords += len(keywords)

    avg_keywords = total_keywords / len(course_keywords) if course_keywords else 0

    print(f"   ✅ Processed {len(course_keywords)} courses")
    print(f"   📊 Average keywords per course: {avg_keywords:.1f}")

    # Show sample
    if course_keywords:
        sample_code = list(course_keywords.keys())[0]
        sample_kw = course_keywords[sample_code][:5]
        print(f"   📝 Sample {sample_code}: {sample_kw}")

    return course_keywords


if __name__ == "__main__":
    # Test with sample data
    sample_courses = [
        {
            "code": "111.02",
            "title": "Landscape World Building Layout",
            "folder_name": "111.02-Landscape World Building Layout",
            "videos": [
                {"name": "01_Introduction.mp4"},
                {"name": "02_Sculpting_Basics.mp4"},
                {"name": "03_Foliage_Placement.mp4"},
            ]
        }
    ]

    result = run_phase1(sample_courses)
    print(f"\nResult: {result}")
