"""generate_cooccurrence_edges.py — Auto-generate tag graph edges from co-occurrence
patterns in the enriched video library.

Scans all courses, maps raw tags to known tag_ids, counts pairwise co-occurrences,
and merges high-confidence pairs as 'related' edges into edges.json.

Usage:
  python scripts/generate_cooccurrence_edges.py
"""

import json
import os
import shutil
from collections import Counter
from itertools import combinations

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS_PATH = os.path.join(ROOT, "tags", "tags.json")
EDGES_PATH = os.path.join(ROOT, "tags", "edges.json")
VIDEO_LIB = os.path.join(ROOT, "path-builder", "src", "data", "video_library_enriched.json")
SAMPLE_EDGES = os.path.join(ROOT, "sample_data", "edges.json")

# ---- Config ----
MIN_COOCCURRENCES = 3       # Minimum co-occurrences to create an edge
MAX_NEW_EDGES = 100         # Cap on new edges to avoid noise
WEIGHT_FLOOR = 0.3          # Minimum edge weight
WEIGHT_CEILING = 0.85       # Maximum edge weight (reserve 0.85+ for curated edges)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def build_tag_lookup(tags_data):
    """Build lookup maps: full tag_id → tag_id, suffix → tag_id."""
    tag_ids = set()
    suffix_map = {}  # suffix → tag_id (only if unique)
    suffix_conflicts = set()

    for tag in tags_data.get("tags", []):
        tid = tag["tag_id"]
        tag_ids.add(tid)
        suffix = tid.split(".")[-1]
        if suffix in suffix_conflicts:
            continue
        if suffix in suffix_map and suffix_map[suffix] != tid:
            # Conflict — multiple tags share this suffix, skip it
            suffix_conflicts.add(suffix)
            del suffix_map[suffix]
        else:
            suffix_map[suffix] = tid

    return tag_ids, suffix_map


def resolve_tag(raw_tag, tag_ids, suffix_map):
    """Map a raw tag string to a known tag_id, or None."""
    raw = raw_tag.strip().lower()
    if not raw or len(raw) < 2:
        return None

    # Direct match
    if raw in tag_ids:
        return raw

    # Suffix match (e.g., "lumen" → "rendering.lumen")
    normalized = raw.replace(" ", "_").replace("-", "_")
    if normalized in suffix_map:
        return suffix_map[normalized]

    # Try without underscores
    simple = normalized.replace("_", "")
    for suffix, tid in suffix_map.items():
        if suffix.replace("_", "") == simple:
            return tid

    return None


def get_course_tag_ids(course, tag_ids, suffix_map):
    """Extract all resolved tag_ids from a course."""
    raw_tags = set()
    for field in ("canonical_tags", "gemini_system_tags", "extracted_tags", "ai_tags"):
        for t in course.get(field, []):
            if isinstance(t, str):
                raw_tags.add(t)

    resolved = set()
    for raw in raw_tags:
        tid = resolve_tag(raw, tag_ids, suffix_map)
        if tid:
            resolved.add(tid)

    return resolved


def compute_cooccurrences(courses, tag_ids, suffix_map):
    """Count pairwise tag co-occurrences across all courses."""
    pair_counts = Counter()
    tag_frequency = Counter()

    for course in courses:
        course_tags = get_course_tag_ids(course, tag_ids, suffix_map)
        if len(course_tags) < 2:
            continue

        for tag in course_tags:
            tag_frequency[tag] += 1

        # Count all pairs (sorted to avoid double-counting)
        for a, b in combinations(sorted(course_tags), 2):
            pair_counts[(a, b)] += 1

    return pair_counts, tag_frequency


def main():
    print("🔗 Generating co-occurrence edges from video library\n")

    # Load data
    tags_data = load_json(TAGS_PATH)
    edges_data = load_json(EDGES_PATH)
    video_lib = load_json(VIDEO_LIB)

    courses = video_lib.get("courses", video_lib if isinstance(video_lib, list) else [])
    print(f"📊 {len(courses)} courses, {len(tags_data['tags'])} tags, {len(edges_data['edges'])} existing edges\n")

    # Build tag lookup
    tag_ids, suffix_map = build_tag_lookup(tags_data)

    # Compute co-occurrences
    pair_counts, tag_frequency = compute_cooccurrences(courses, tag_ids, suffix_map)
    print(f"📈 Found {len(pair_counts)} unique tag pairs")

    # Filter by minimum co-occurrences
    strong_pairs = {pair: count for pair, count in pair_counts.items() if count >= MIN_COOCCURRENCES}
    print(f"🔍 {len(strong_pairs)} pairs with ≥{MIN_COOCCURRENCES} co-occurrences")

    # Existing edge keys
    existing_keys = set()
    for edge in edges_data["edges"]:
        s, t = edge["source"], edge["target"]
        existing_keys.add(f"{s}→{t}")
        existing_keys.add(f"{t}→{s}")  # Check both directions

    # Build candidate edges, skip existing
    max_count = max(strong_pairs.values()) if strong_pairs else 1
    candidates = []

    for (a, b), count in strong_pairs.items():
        key_fwd = f"{a}→{b}"
        key_rev = f"{b}→{a}"
        if key_fwd in existing_keys or key_rev in existing_keys:
            continue

        # Compute weight: normalized co-occurrence count
        raw_weight = count / max_count
        weight = round(max(WEIGHT_FLOOR, min(WEIGHT_CEILING, raw_weight)), 2)

        candidates.append({
            "source": a,
            "target": b,
            "relation": "related",
            "weight": weight,
            "_cooccurrences": count,
        })

    # Sort by co-occurrence count descending, take top N
    candidates.sort(key=lambda c: c["_cooccurrences"], reverse=True)
    to_add = candidates[:MAX_NEW_EDGES]

    print(f"\n── Adding {len(to_add)} new edges (capped at {MAX_NEW_EDGES}) ──\n")

    for edge in to_add:
        count = edge.pop("_cooccurrences")
        edges_data["edges"].append(edge)
        print(f"  🔗 {edge['source']} ↔ {edge['target']} (w={edge['weight']}, co={count})")

    # Save
    save_json(EDGES_PATH, edges_data)
    print(f"\n  💾 Saved tags/edges.json ({len(edges_data['edges'])} total edges)")

    shutil.copy2(EDGES_PATH, SAMPLE_EDGES)
    print("  📋 Synced → sample_data/edges.json")

    # Summary stats
    print("\n✅ Done!")
    print("   Before: 51 edges")
    print(f"   Added:  {len(to_add)} co-occurrence edges")
    print(f"   After:  {len(edges_data['edges'])} total edges")

    # Show top tag frequencies for context
    print("\n📊 Top 10 most-connected tags:")
    tag_edge_count = Counter()
    for edge in edges_data["edges"]:
        tag_edge_count[edge["source"]] += 1
        tag_edge_count[edge["target"]] += 1
    for tag, count in tag_edge_count.most_common(10):
        print(f"   {tag}: {count} edges")


if __name__ == "__main__":
    main()
