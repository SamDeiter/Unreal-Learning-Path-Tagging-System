"""Scored Matcher for deterministic tag matching with scoring.

Implements the scoring formula:
    TagScore = Σ(SignalTypeMultiplier × RuleWeight × TagGlobalWeight)

All matching is deterministic - same query always produces same scores.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


# =============================================================================
# SIGNAL TYPE MULTIPLIERS
# =============================================================================
# These define how strong each type of pattern match is.
# Higher values = stronger signal = higher score contribution.

SIGNAL_MULTIPLIERS = {
    "exact_signature": 1.0,  # Exact error string match (e.g., "DXGI_ERROR_DEVICE_REMOVED")
    "regex": 0.8,            # Pattern match (e.g., "ExitCode[=:\s]*25")
    "contains": 0.6,         # Substring match (e.g., "packaging" in query)
    "synonym": 0.4,          # Synonym ring match (e.g., "BP" → "blueprint")
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class PatternMatch:
    """A single pattern that matched in the query."""

    rule_id: str              # ID of the rule that matched
    pattern_type: str         # "regex", "contains", etc.
    signal_type: str          # "exact_signature", "regex", "contains", "synonym"
    pattern_value: str        # The actual pattern string
    matched_text: str         # The text in the query that matched
    contribution: float       # Score contribution from this match


@dataclass
class MatchTrace:
    """Debug trace for a single tag's matching process."""

    tag_id: str
    patterns_matched: list[PatternMatch] = field(default_factory=list)
    negative_blocks: list[str] = field(default_factory=list)  # Patterns that blocked
    edge_expansions: list[str] = field(default_factory=list)   # Tags added via edges
    version_filtered: bool = False  # True if filtered due to version constraint
    raw_score: float = 0.0          # Score before any adjustments
    final_score: float = 0.0        # Score after all adjustments


@dataclass
class ScoredTag:
    """A tag with its computed score and trace."""

    tag_id: str              # e.g., "build.exitcode_25"
    display_name: str        # e.g., "ExitCode 25"
    score: float             # 0.0 - 1.0+
    matched_rules: list[str] # Rule IDs that contributed
    trace: MatchTrace        # Full debug trace

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict."""
        return {
            "tag_id": self.tag_id,
            "display_name": self.display_name,
            "score": round(self.score, 4),
            "matched_rules": self.matched_rules,
            "trace": {
                "patterns_matched": [
                    {
                        "rule_id": p.rule_id,
                        "pattern_type": p.pattern_type,
                        "signal_type": p.signal_type,
                        "matched_text": p.matched_text,
                        "contribution": round(p.contribution, 4),
                    }
                    for p in self.trace.patterns_matched
                ],
                "negative_blocks": self.trace.negative_blocks,
                "edge_expansions": self.trace.edge_expansions,
                "version_filtered": self.trace.version_filtered,
                "raw_score": round(self.trace.raw_score, 4),
                "final_score": round(self.trace.final_score, 4),
            },
        }


# =============================================================================
# SCORED MATCHER
# =============================================================================

class ScoredMatcher:
    """Deterministic tag matcher with scoring.

    All matching is based on explicit patterns - no embeddings or ML.
    Every score can be traced back to specific pattern matches.
    """

    def __init__(
        self,
        rules_path: Optional[Path] = None,
        tags_path: Optional[Path] = None,
        edges_path: Optional[Path] = None,
    ):
        """Initialize with paths to JSON config files.

        Args:
            rules_path: Path to match_rules.json
            tags_path: Path to tags.json
            edges_path: Path to edges.json
        """
        # Default paths relative to this file
        base_dir = Path(__file__).parent

        self.rules_path = rules_path or base_dir / "match_rules.json"
        self.tags_path = tags_path or base_dir.parent / "tags" / "tags.json"
        self.edges_path = edges_path or base_dir.parent / "tags" / "edges.json"

        # Load configurations
        self.rules = self._load_json(self.rules_path).get("rules", [])
        self.tags_db = self._load_tags()
        self.edges = self._load_json(self.edges_path).get("edges", [])

    def _load_json(self, path: Path) -> dict:
        """Load JSON file safely."""
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _load_tags(self) -> dict[str, dict]:
        """Load tags into a lookup dict by tag_id."""
        data = self._load_json(self.tags_path)
        return {tag["tag_id"]: tag for tag in data.get("tags", [])}

    def match_query(
        self,
        query: str,
        engine_version: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> list[ScoredTag]:
        """Match a query to tags with scores.

        Args:
            query: User's problem statement
            engine_version: Optional UE version (e.g., "5.3")
            platform: Optional platform filter

        Returns:
            List of ScoredTag objects, sorted by score descending
        """
        # Keep both original and lowercase for case-sensitive/insensitive matching
        query_original = query
        query_lower = query.lower()

        # If engine version not provided, try to extract from query
        if not engine_version:
            engine_version = self._extract_engine_version(query)

        # Accumulate scores per tag
        tag_scores: dict[str, MatchTrace] = {}

        # Process each rule
        for rule in self.rules:
            target_tag = rule.get("target_tag")
            if not target_tag:
                continue

            # Get tag info
            tag_info = self.tags_db.get(target_tag, {})
            tag_weight = tag_info.get("relevance", {}).get("global_weight", 0.5)
            rule_weight = rule.get("rule_weight", 0.8)  # Default if not specified

            # Initialize trace for this tag if needed
            if target_tag not in tag_scores:
                tag_scores[target_tag] = MatchTrace(tag_id=target_tag)

            trace = tag_scores[target_tag]

            # Check negative patterns first (they block the tag)
            blocked = False
            for neg_pattern in rule.get("negative_patterns", []):
                if self._pattern_matches(neg_pattern, query_original, query_lower):
                    trace.negative_blocks.append(neg_pattern.get("value", ""))
                    blocked = True
                    break

            if blocked:
                continue

            # Check positive patterns
            for pattern in rule.get("patterns", []):
                match_result = self._pattern_matches(pattern, query_original, query_lower)
                if match_result:
                    # Determine signal type (use explicit if provided, else infer)
                    signal_type = pattern.get(
                        "signal_type",
                        self._infer_signal_type(pattern),
                    )

                    # Calculate contribution
                    signal_mult = SIGNAL_MULTIPLIERS.get(signal_type, 0.5)
                    contribution = signal_mult * rule_weight * tag_weight

                    # Record the match
                    pattern_match = PatternMatch(
                        rule_id=rule["rule_id"],
                        pattern_type=pattern.get("type", "unknown"),
                        signal_type=signal_type,
                        pattern_value=pattern.get("value", ""),
                        matched_text=match_result if isinstance(match_result, str) else "",
                        contribution=contribution,
                    )
                    trace.patterns_matched.append(pattern_match)
                    trace.raw_score += contribution

        # Apply version filtering
        if engine_version:
            tag_scores = self._filter_by_version(tag_scores, engine_version)

        # Convert to ScoredTag objects
        scored_tags = []
        for tag_id, trace in tag_scores.items():
            # Skip tags with no matches or blocked
            if not trace.patterns_matched and not trace.edge_expansions:
                continue

            # Skip completely blocked tags
            if trace.negative_blocks and not trace.patterns_matched:
                continue

            trace.final_score = trace.raw_score
            tag_info = self.tags_db.get(tag_id, {})

            scored_tag = ScoredTag(
                tag_id=tag_id,
                display_name=tag_info.get("display_name", tag_id),
                score=trace.final_score,
                matched_rules=list({p.rule_id for p in trace.patterns_matched}),
                trace=trace,
            )
            scored_tags.append(scored_tag)

        # Sort by score descending, then apply tie-breakers
        scored_tags = self._apply_tiebreakers(scored_tags)

        return scored_tags

    def _pattern_matches(self, pattern: dict, query_original: str, query_lower: str) -> str | bool:
        """Check if a pattern matches the query.

        Args:
            pattern: Pattern definition with type, value, case_insensitive
            query_original: Original query string (case preserved)
            query_lower: Lowercased query string

        Returns:
            Matched text if match found, False otherwise
        """
        pattern_type = pattern.get("type", "contains")
        value = pattern.get("value", "")
        case_insensitive = pattern.get("case_insensitive", True)

        if not value:
            return False

        # Prepare value and query for matching based on case sensitivity
        match_value = value.lower() if case_insensitive else value
        query_to_match = query_lower if case_insensitive else query_original

        if pattern_type == "contains":
            if match_value in query_to_match:
                return match_value
            return False

        elif pattern_type == "regex":
            try:
                flags = re.IGNORECASE if case_insensitive else 0
                match = re.search(value, query_to_match, flags)
                if match:
                    return match.group(0)
                return False
            except re.error:
                return False

        elif pattern_type == "exact":
            if query_to_match == match_value:
                return match_value
            return False

        return False

    def _infer_signal_type(self, pattern: dict) -> str:
        """Infer signal type from pattern characteristics.

        Args:
            pattern: Pattern definition

        Returns:
            Inferred signal type
        """
        pattern_type = pattern.get("type", "contains")
        value = pattern.get("value", "")

        # If it looks like an error code, it's an exact signature
        if any(marker in value for marker in [
            "0x", "LNK", "ERROR", "EXCEPTION", "DXGI", "ExitCode",
        ]):
            return "exact_signature"

        # Regex patterns are... regex
        if pattern_type == "regex":
            return "regex"

        # Contains patterns are substring matches
        if pattern_type == "contains":
            return "contains"

        return "contains"

    def _extract_engine_version(self, query: str) -> Optional[str]:
        """Extract UE version from query text.

        Args:
            query: User query

        Returns:
            Version string like "5.3" or None
        """
        # Try various patterns
        patterns = [
            r"UE\s*([45])\.?(\d+)?",        # "UE5", "UE5.3", "UE 5.3"
            r"Unreal\s*Engine?\s*([45])",   # "Unreal Engine 5"
            r"([45])\.(\d+)",               # Just "5.3"
        ]

        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                major = match.group(1)
                minor = match.group(2) if len(match.groups()) > 1 else "0"
                return f"{major}.{minor or '0'}"

        return None

    def _filter_by_version(
        self,
        tag_scores: dict[str, MatchTrace],
        engine_version: str,
    ) -> dict[str, MatchTrace]:
        """Filter out tags incompatible with the engine version.

        Args:
            tag_scores: Current tag scores
            engine_version: User's engine version

        Returns:
            Filtered tag scores
        """
        try:
            user_major = int(engine_version.split(".")[0])
        except (ValueError, IndexError):
            return tag_scores

        filtered = {}
        for tag_id, trace in tag_scores.items():
            tag_info = self.tags_db.get(tag_id, {})
            constraints = tag_info.get("constraints", {})
            versions = constraints.get("engine_versions", {})

            min_version = versions.get("min")
            if min_version:
                try:
                    min_major = int(min_version.split(".")[0])
                    if user_major < min_major:
                        trace.version_filtered = True
                        continue
                except (ValueError, IndexError):
                    pass

            filtered[tag_id] = trace

        return filtered

    def _apply_tiebreakers(self, scored_tags: list[ScoredTag]) -> list[ScoredTag]:
        """Apply tie-breaker rules to sort tags with equal scores.

        Tie-breaker order:
        1. Higher score wins
        2. Higher priority rule wins
        3. More specific tag wins (longer tag_id)
        4. Alphabetical order (deterministic fallback)

        Args:
            scored_tags: List of scored tags

        Returns:
            Sorted list
        """
        def sort_key(tag: ScoredTag) -> tuple:
            # Get max priority from matched rules
            max_priority = 0
            for rule in self.rules:
                if rule.get("rule_id") in tag.matched_rules:
                    max_priority = max(max_priority, rule.get("priority", 0))

            return (
                -tag.score,            # Higher score first (negative for descending)
                -max_priority,         # Higher priority first
                -len(tag.tag_id),      # Longer tag_id first (more specific)
                tag.tag_id,            # Alphabetical fallback
            )

        return sorted(scored_tags, key=sort_key)

    def save_trace(
        self,
        query: str,
        scored_tags: list[ScoredTag],
        output_dir: Optional[Path] = None,
    ) -> Path:
        """Save match trace to JSON file for debugging.

        Args:
            query: Original query
            scored_tags: Match results
            output_dir: Directory to save trace

        Returns:
            Path to saved file
        """
        output_dir = output_dir or Path(__file__).parent.parent / "computed_matches"
        output_dir.mkdir(exist_ok=True)

        # Generate filename from timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"trace_{timestamp}.json"

        trace_data = {
            "query": query,
            "timestamp": datetime.now().isoformat(),
            "results": [tag.to_dict() for tag in scored_tags],
        }

        output_path = output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(trace_data, f, indent=2)

        return output_path


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    """CLI for testing scored matcher."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python scored_matcher.py <query>")
        print("Example: python scored_matcher.py 'UE5 packaging fails ExitCode=25'")
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    matcher = ScoredMatcher()
    results = matcher.match_query(query)

    print(f"\n=== Query: {query} ===\n")
    print(f"Found {len(results)} matching tags:\n")

    for i, tag in enumerate(results, 1):
        print(f"{i}. {tag.display_name} ({tag.tag_id})")
        print(f"   Score: {tag.score:.4f}")
        print(f"   Rules: {', '.join(tag.matched_rules)}")
        if tag.trace.patterns_matched:
            print("   Patterns:")
            for pm in tag.trace.patterns_matched:
                print(f"     - {pm.signal_type}: '{pm.pattern_value}' → +{pm.contribution:.4f}")
        print()

    # Save trace
    trace_path = matcher.save_trace(query, results)
    print(f"Trace saved to: {trace_path}")


if __name__ == "__main__":
    main()
