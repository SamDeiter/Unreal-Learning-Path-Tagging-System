"""
build_embeddings.py — Generate course embeddings using Gemini text-embedding-004.

Reads video_library_enriched.json + search_index.json, builds a text chunk
per course (title + description + tags + top transcript words), and calls
the Gemini Embedding API to produce 768-dim vectors.

Output: path-builder/src/data/course_embeddings.json

Usage:
    python scripts/build_embeddings.py

Requires:
    - GOOGLE_API_KEY environment variable
    - pip install requests
"""

import json
import os
import sys
import time
import requests

# ──────────── Config ────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "path-builder", "src", "data")
ENRICHED_PATH = os.path.join(DATA_DIR, "video_library_enriched.json")
SEARCH_INDEX_PATH = os.path.join(DATA_DIR, "search_index.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "course_embeddings.json")

MODEL = "gemini-embedding-001"
DIMENSION = 768
TASK_TYPE = "SEMANTIC_SIMILARITY"
MAX_TRANSCRIPT_WORDS = 500  # Limit transcript text to keep within token budget
BATCH_SIZE = 5  # Gemini supports batch embedding
RATE_LIMIT_DELAY = 0.5  # Seconds between batches


def load_data():
    """Load enriched library and search index."""
    with open(ENRICHED_PATH, "r", encoding="utf-8") as f:
        lib = json.load(f)
    courses = lib.get("courses", lib) if isinstance(lib, dict) else lib

    with open(SEARCH_INDEX_PATH, "r", encoding="utf-8") as f:
        search_idx = json.load(f)
    course_words = search_idx.get("course_words", {})

    return courses, course_words


def build_text_chunk(course, course_words):
    """Build a text representation of a course for embedding."""
    code = course.get("code", "")
    title = course.get("title", "")
    description = course.get("description", "")

    # Collect all tag strings
    tags = []
    for tag_field in ["canonical_tags", "gemini_system_tags", "extracted_tags", "tags"]:
        raw_tags = course.get(tag_field, [])
        for t in raw_tags:
            if isinstance(t, str):
                tags.append(t.replace(".", " ").replace("_", " "))
            elif isinstance(t, dict):
                tag_name = t.get("display_name", t.get("tag_id", t.get("name", "")))
                if tag_name:
                    tags.append(str(tag_name).replace(".", " ").replace("_", " "))
    tag_text = ", ".join(set(tags))

    # Get top transcript words (sorted by frequency)
    words_dict = course_words.get(code, {})
    sorted_words = sorted(words_dict.items(), key=lambda x: x[1], reverse=True)
    # Filter out very short words and common stopwords
    stopwords = {"the", "and", "for", "with", "this", "that", "are", "was", "has",
                 "have", "not", "can", "you", "will", "from", "its", "but", "our",
                 "then", "just", "also", "here", "there", "very", "been", "being",
                 "would", "could", "should", "they", "them", "their", "what", "when",
                 "which", "where", "about", "into", "over", "some", "than", "more",
                 "going", "want", "actually", "really", "like", "know"}
    transcript_words = [
        w for w, _ in sorted_words
        if len(w) > 2 and w not in stopwords
    ][:MAX_TRANSCRIPT_WORDS]
    transcript_text = " ".join(transcript_words)

    # Combine: title + description + tags + transcript keywords
    parts = [
        f"Course: {title}",
        f"Description: {description}" if description else "",
        f"Topics: {tag_text}" if tag_text else "",
        f"Content keywords: {transcript_text}" if transcript_text else "",
    ]
    return "\n".join(p for p in parts if p)


def embed_batch(texts, api_key):
    """Call Gemini embedding API for a batch of texts."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:batchEmbedContents?key={api_key}"

    requests_payload = []
    for text in texts:
        requests_payload.append({
            "model": f"models/{MODEL}",
            "content": {"parts": [{"text": text}]},
            "taskType": TASK_TYPE,
            "outputDimensionality": DIMENSION,
        })

    payload = {"requests": requests_payload}

    response = requests.post(url, json=payload, timeout=30)
    if response.status_code != 200:
        print(f"  ❌ API error {response.status_code}: {response.text[:300]}")
        return None

    data = response.json()
    embeddings = []
    for emb in data.get("embeddings", []):
        embeddings.append(emb.get("values", []))

    return embeddings


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY environment variable not set.")
        print("   Set it with: $env:GOOGLE_API_KEY = 'your-key'")
        sys.exit(1)

    print("📦 Loading data...")
    courses, course_words = load_data()

    # Handle both list and dict formats
    if isinstance(courses, dict):
        course_list = list(courses.values()) if not isinstance(list(courses.values())[0], str) else courses
    else:
        course_list = courses

    # Filter to playable courses (have at least one video with drive_id)
    playable = []
    for c in course_list:
        if not isinstance(c, dict):
            continue
        videos = c.get("videos", [])
        if videos and isinstance(videos, list) and len(videos) > 0:
            if isinstance(videos[0], dict) and videos[0].get("drive_id"):
                playable.append(c)

    print(f"🎬 Found {len(playable)} playable courses")

    # Build text chunks
    print("📝 Building text chunks...")
    chunks = []
    codes = []
    titles = []
    for c in playable:
        code = c.get("code", "")
        title = c.get("title", "")
        text = build_text_chunk(c, course_words)
        chunks.append(text)
        codes.append(code)
        titles.append(title)
        # Debug: show first chunk
        if len(chunks) == 1:
            print(f"  Sample chunk ({code}):")
            print(f"  {text[:200]}...")

    # Generate embeddings in batches
    print(f"🧠 Generating embeddings ({len(chunks)} courses, batch size {BATCH_SIZE})...")
    all_embeddings = []
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        batch_codes = codes[i:i + BATCH_SIZE]
        print(f"  Batch {i // BATCH_SIZE + 1}/{(len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE}: {batch_codes}")

        embeddings = embed_batch(batch, api_key)
        if embeddings is None:
            print("  ⚠️ Retrying after 2s...")
            time.sleep(2)
            embeddings = embed_batch(batch, api_key)
            if embeddings is None:
                print(f"  ❌ Failed to embed batch starting at {batch_codes[0]}, skipping")
                all_embeddings.extend([None] * len(batch))
                continue

        all_embeddings.extend(embeddings)
        if i + BATCH_SIZE < len(chunks):
            time.sleep(RATE_LIMIT_DELAY)

    # Build output
    output = {
        "model": MODEL,
        "dimension": DIMENSION,
        "task_type": TASK_TYPE,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_courses": 0,
        "courses": {},
    }

    success_count = 0
    for code, title, embedding in zip(codes, titles, all_embeddings):
        if embedding and len(embedding) == DIMENSION:
            output["courses"][code] = {
                "title": title,
                "embedding": [round(v, 6) for v in embedding],  # Save space
            }
            success_count += 1
        else:
            print(f"  ⚠️ Skipped {code}: invalid embedding")

    output["total_courses"] = success_count

    # Save
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f)

    file_size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n✅ Done! Generated embeddings for {success_count}/{len(playable)} courses")
    print(f"📁 Saved to: {OUTPUT_PATH} ({file_size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
