"""Phase 5: Gemini Batch Enrichment.

Uses Gemini API for sparse courses that still need more tags
after local processing.
"""

import json
import os
import urllib.request
from pathlib import Path

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / ".env"
    load_dotenv(env_path)
except ImportError:
    pass  # dotenv not installed, will use system env vars


GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def get_api_key() -> str | None:
    """Get Gemini API key from environment."""
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def create_batch_prompt(sparse_courses: list[dict]) -> str:
    """Create a compact prompt for multiple courses.

    Args:
        sparse_courses: List of courses needing enrichment.

    Returns:
        Formatted prompt string.
    """
    lines = [
        "Tag these UE5 video courses based on their titles and existing keywords.",
        "Return ONLY a JSON array of tag arrays, one per course.",
        "Use lowercase tags like: blueprint, niagara, material, animation, etc.",
        ""
    ]

    for i, c in enumerate(sparse_courses[:10]):  # Max 10 per batch
        title = c.get('title', 'Unknown')
        keywords = c.get('ai_tags', [])[:5]
        lines.append(f"{i+1}. \"{title}\" - Keywords: {', '.join(keywords) or 'none'}")

    lines.append("")
    lines.append("Format: [[\"tag1\",\"tag2\",...], [\"tag1\",\"tag2\",...], ...]")

    return "\n".join(lines)


def call_gemini(prompt: str) -> list[list[str]] | None:
    """Call Gemini API with prompt.

    Args:
        prompt: The prompt text.

    Returns:
        List of tag arrays, or None on error.
    """
    api_key = get_api_key()
    if not api_key:
        print("   ⚠️  No API key found (GEMINI_API_KEY or GOOGLE_API_KEY)")
        return None

    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 500,
        },
    }

    url = f"{GEMINI_API_URL}?key={api_key}"

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode())

        # Extract text
        text = result["candidates"][0]["content"]["parts"][0]["text"]

        # Parse JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        return json.loads(text.strip())

    except Exception as e:
        print(f"   ❌ Gemini API error: {e}")
        return None


def run_phase5(
    courses: list[dict],
    tag_results: dict[str, dict],
    min_tags: int = 5,
    dry_run: bool = False,
) -> dict[str, list[str]]:
    """Execute Phase 5: Gemini batch enrichment.

    Args:
        courses: List of all course dictionaries.
        tag_results: Results from Phase 3.
        min_tags: Minimum tags threshold for sparse detection.
        dry_run: If True, don't actually call API.

    Returns:
        Dictionary of course code -> additional tags.
    """
    print("🤖 Phase 5: Gemini batch enrichment (sparse courses)...")

    # Find sparse courses
    sparse_courses = []
    for course in courses:
        code = course.get('code')
        if not code:
            continue

        result = tag_results.get(code, {})
        tag_count = len(result.get('ai_tags', [])) + len(result.get('canonical_tags', []))

        if tag_count < min_tags:
            sparse_courses.append({
                'code': code,
                'title': course.get('title', ''),
                'ai_tags': result.get('ai_tags', []),
            })

    print(f"   📊 {len(sparse_courses)} sparse courses (< {min_tags} tags)")

    if not sparse_courses:
        print("   ✅ No sparse courses - skipping API")
        return {}

    if dry_run:
        print("   🔍 Dry run - would send these courses:")
        for c in sparse_courses[:5]:
            print(f"      - {c['code']}: {c['title'][:40]}")
        return {}

    # Process in batches of 10
    enriched = {}

    for batch_start in range(0, len(sparse_courses), 10):
        batch = sparse_courses[batch_start:batch_start + 10]

        print(f"   📤 Sending batch {batch_start // 10 + 1} ({len(batch)} courses)...")

        prompt = create_batch_prompt(batch)
        results = call_gemini(prompt)

        if results and len(results) == len(batch):
            for i, tags in enumerate(results):
                code = batch[i]['code']
                enriched[code] = tags
                print(f"      ✅ {code}: +{len(tags)} tags")
        else:
            print("      ⚠️  Batch response mismatch or error")

    print(f"   ✅ Enriched {len(enriched)} courses via API")

    return enriched


if __name__ == "__main__":
    # Test prompt generation
    sample = [
        {"code": "100.01", "title": "Getting Started with UE5", "ai_tags": ["editor"]},
        {"code": "100.02", "title": "Blueprint Basics", "ai_tags": ["blueprint"]},
    ]

    prompt = create_batch_prompt(sample)
    print("Sample prompt:")
    print(prompt)
    print(f"\nPrompt length: {len(prompt)} chars")
