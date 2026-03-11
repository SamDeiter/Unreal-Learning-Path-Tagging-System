"""
Generate clean display names for all courses using Gemini.

Usage:
    set GOOGLE_API_KEY=your_key
    python scripts/clean_course_names.py

Reads:  path-builder/src/data/video_library_enriched.json
Writes: path-builder/src/data/display_names.json
"""

import json
import os
import sys
import time
import re
import urllib.request
import urllib.error

# Load .env file for API keys
try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass  # dotenv not installed

# ── Configuration ──────────────────────────────────────────────
LIBRARY_PATH = "path-builder/src/data/video_library_enriched.json"
OUTPUT_PATH = "path-builder/src/data/display_names.json"
BATCH_SIZE = 80  # titles per Gemini call
MODEL = "gemini-2.5-flash"
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds


def get_api_key():
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("ERROR: No API key found.")
        print("  Set GOOGLE_API_KEY or GEMINI_API_KEY env var.")
        print("  Example: set GOOGLE_API_KEY=AIza...")
        sys.exit(1)
    return key


def call_gemini(api_key, prompt, retries=MAX_RETRIES):
    """Call Gemini API with retry logic."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
        },
    }

    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            # Extract text from response
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            return text
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            if e.code == 429:
                wait = RETRY_DELAY * (2 ** attempt)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  HTTP {e.code}: {body[:200]}")
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
                else:
                    raise
        except Exception as e:
            print(f"  Error: {e}")
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
            else:
                raise
    return None


def build_prompt(batch):
    """Build a prompt that asks Gemini to clean up course titles."""
    lines = []
    for code, title in batch:
        lines.append(f'  "{code}": "{title}"')

    titles_json = "{\n" + ",\n".join(lines) + "\n}"

    return f"""You are a technical editor for Unreal Engine 5 training content.

Below is a JSON object mapping course codes to their current (messy) titles.
These titles have problems like:
- Prefixes (e.g., "WBD-", "Blueprint_", "PGT_")
- Underscore separators instead of spaces
- Abbreviations (e.g., "B Ps" should be "Blueprints")
- Typos (e.g., "Niagar" should be "Niagara")
- Redundant words (e.g., "Blueprint_QuickStart_Blueprint" → just "Blueprint Quick Start")
- Version numbers clutter (e.g., "5.00" at the end is unnecessary)
- Too vague (e.g., "Core Concepts" — add the topic if obvious from the code/context)

Return a JSON object with the SAME keys, where each value is a clean,
professional, concise display title. Rules:
1. Keep the Unreal Engine topic clear (e.g., "Landscape", "Niagara", "Blueprint")
2. Remove internal prefixes and file-naming artifacts
3. Fix typos and expand abbreviations
4. Keep it concise — ideally 3-8 words
5. If the title already looks good, keep it as-is
6. Do NOT add "Unreal Engine" to every title — it's implied

Input:
{titles_json}

Return ONLY the JSON object with cleaned titles, nothing else."""


def main():
    api_key = get_api_key()

    # Load library
    print(f"Loading {LIBRARY_PATH}...")
    with open(LIBRARY_PATH, "r", encoding="utf-8") as f:
        library = json.load(f)

    courses = library.get("courses", [])
    print(f"  {len(courses)} courses found")

    # Deduplicate by code (some codes appear multiple times)
    code_to_title = {}
    for c in courses:
        code = c.get("code", "")
        title = c.get("title", "")
        if code and title:
            # Keep the first occurrence (or override if it has more videos)
            if code not in code_to_title:
                code_to_title[code] = title

    print(f"  {len(code_to_title)} unique course codes")

    # Load existing results (for resume support)
    display_names = {}
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            display_names = json.load(f)
        print(f"  Loaded {len(display_names)} existing display names (resume mode)")

    # Filter out already-processed codes
    remaining = {k: v for k, v in code_to_title.items() if k not in display_names}
    print(f"  {len(remaining)} codes remaining to process")

    if not remaining:
        print("All courses already have display names!")
        return

    # Batch and process
    items = list(remaining.items())
    total_batches = (len(items) + BATCH_SIZE - 1) // BATCH_SIZE
    processed = 0
    failures = 0

    print(f"\nProcessing {len(items)} titles in {total_batches} batches of {BATCH_SIZE}...")
    print("=" * 60)

    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        print(f"\n  Batch {batch_num}/{total_batches} ({len(batch)} titles)...")

        prompt = build_prompt(batch)

        try:
            response_text = call_gemini(api_key, prompt)
            if not response_text:
                print(f"  [FAIL] Empty response")
                failures += len(batch)
                continue

            # Parse the JSON response
            cleaned = json.loads(response_text)

            # Validate and merge
            for code, original_title in batch:
                if code in cleaned:
                    new_title = cleaned[code].strip()
                    if new_title:
                        display_names[code] = new_title
                        processed += 1
                    else:
                        # Empty response — keep original
                        display_names[code] = original_title
                        processed += 1
                else:
                    # Missing from response — keep original
                    display_names[code] = original_title
                    processed += 1

            # Show some examples from this batch
            examples = list(cleaned.items())[:3]
            for code, new_title in examples:
                orig = dict(batch).get(code, "?")
                if orig != new_title:
                    print(f"    {orig}  →  {new_title}")
                else:
                    print(f"    {new_title}  (unchanged)")

        except json.JSONDecodeError as e:
            print(f"  [FAIL] JSON parse error: {e}")
            print(f"  Response: {response_text[:200]}")
            failures += len(batch)
            # Fall back to originals
            for code, title in batch:
                display_names[code] = title
                processed += 1

        except Exception as e:
            print(f"  [FAIL] {e}")
            failures += len(batch)
            # Fall back to originals
            for code, title in batch:
                display_names[code] = title
                processed += 1

        # Checkpoint save every 5 batches
        if batch_num % 5 == 0 or i + BATCH_SIZE >= len(items):
            with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
                json.dump(display_names, f, indent=2, ensure_ascii=False)
            print(f"  [checkpoint] Saved {len(display_names)} names")

        # Small delay between batches
        if i + BATCH_SIZE < len(items):
            time.sleep(1)

    # Final save
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(display_names, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"Done! {processed} titles cleaned, {failures} failures")
    print(f"Output: {OUTPUT_PATH}")

    # Show summary of changes
    changed = 0
    for code, new_title in display_names.items():
        orig = code_to_title.get(code, "")
        if orig and orig != new_title:
            changed += 1
    print(f"  {changed} titles changed, {len(display_names) - changed} kept as-is")


if __name__ == "__main__":
    main()
