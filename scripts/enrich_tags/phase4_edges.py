"""Phase 4: Edge Relationship Generation.

Generates tag relationships (edges) based on co-occurrence
in course transcripts.
"""

from collections import Counter
from itertools import combinations


def calculate_cooccurrence(
    course_tags: dict[str, list[str]],
    min_weight: int = 2,
) -> list[tuple[str, str, int]]:
    """Calculate tag co-occurrence across courses.

    Args:
        course_tags: Dictionary of course code -> list of tags.
        min_weight: Minimum co-occurrence count to include.

    Returns:
        List of (source, target, weight) tuples.
    """
    co_occurrence = Counter()

    for _code, tags in course_tags.items():
        # Get unique tags for this course
        unique_tags = list(set(tags))

        # Count all pairs
        for t1, t2 in combinations(sorted(unique_tags), 2):
            co_occurrence[(t1, t2)] += 1

    # Filter by minimum weight
    edges = []
    for (source, target), weight in co_occurrence.items():
        if weight >= min_weight:
            edges.append((source, target, weight))

    return edges


def generate_edge_objects(
    cooccurrence: list[tuple[str, str, int]],
    edge_type: str = "related",
) -> list[dict]:
    """Convert co-occurrence data to edge objects.

    Args:
        cooccurrence: List of (source, target, weight) tuples.
        edge_type: Type of relationship.

    Returns:
        List of edge dictionaries.
    """
    edges = []

    for source, target, weight in cooccurrence:
        edges.append({
            "source": source,
            "target": target,
            "type": edge_type,
            "weight": weight,
        })

    # Sort by weight descending
    edges.sort(key=lambda e: -e['weight'])

    return edges


def run_phase4(
    tag_results: dict[str, dict],
    min_weight: int = 2,
) -> list[dict]:
    """Execute Phase 4: Edge relationship generation.

    Args:
        tag_results: Results from Phase 3 with ai_tags.
        min_weight: Minimum co-occurrence to create edge.

    Returns:
        List of edge dictionaries.
    """
    print("🔗 Phase 4: Generating edge relationships...")

    # Collect all tags per course
    course_tags = {}
    for code, result in tag_results.items():
        tags = result.get('ai_tags', []) + result.get('canonical_tags', [])
        if tags:
            course_tags[code] = tags

    # Calculate co-occurrence
    cooccurrence = calculate_cooccurrence(course_tags, min_weight)

    # Generate edge objects
    edges = generate_edge_objects(cooccurrence)

    print(f"   ✅ Generated {len(edges)} edges from {len(course_tags)} courses")

    # Show top edges
    if edges:
        print("   📊 Top 5 relationships:")
        for edge in edges[:5]:
            print(f"      {edge['source']} <-> {edge['target']} (weight: {edge['weight']})")

    return edges


if __name__ == "__main__":
    # Test with sample data
    sample_tags = {
        "100.01": ["blueprint", "material", "lighting"],
        "100.02": ["blueprint", "animation", "material"],
        "100.03": ["niagara", "material", "vfx"],
        "101.01": ["blueprint", "animation", "state_machine"],
        "101.02": ["niagara", "vfx", "particles"],
    }

    # Convert to Phase 3 format
    sample_results = {
        code: {"ai_tags": tags, "canonical_tags": []}
        for code, tags in sample_tags.items()
    }

    edges = run_phase4(sample_results, min_weight=2)
    print(f"\nGenerated edges: {edges}")
