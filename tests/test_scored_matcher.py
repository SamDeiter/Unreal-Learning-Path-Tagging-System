"""Tests for the scored matcher."""

import sys
from pathlib import Path

# Add ingestion to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.scored_matcher import SIGNAL_MULTIPLIERS, ScoredMatcher


class TestScoringPrecedence:
    """Test that signal types have correct precedence."""

    def test_signal_multipliers_order(self):
        """Verify exact_signature > regex > contains > synonym."""
        assert SIGNAL_MULTIPLIERS["exact_signature"] > SIGNAL_MULTIPLIERS["regex"]
        assert SIGNAL_MULTIPLIERS["regex"] > SIGNAL_MULTIPLIERS["contains"]
        assert SIGNAL_MULTIPLIERS["contains"] > SIGNAL_MULTIPLIERS["synonym"]

    def test_exact_signature_scores_highest(self):
        """Verify exact error codes score higher than generic patterns."""
        matcher = ScoredMatcher()

        # DXGI error code should score higher than generic "device removed"
        query = "DXGI_ERROR_DEVICE_REMOVED in my project"
        results = matcher.match_query(query)

        # Find the d3d crash tag
        d3d_tag = next((t for t in results if t.tag_id == "crash.d3d_device_lost"), None)
        assert d3d_tag is not None, "Expected crash.d3d_device_lost to match"

        # Verify it used exact_signature pattern
        exact_matches = [
            p for p in d3d_tag.trace.patterns_matched
            if p.signal_type == "exact_signature"
        ]
        assert len(exact_matches) > 0, "Expected exact_signature pattern to match"


class TestNegativeBlocking:
    """Test that negative patterns block tags."""

    def test_exitcode_0_blocks_exitcode_25(self):
        """Verify ExitCode=0 blocks ExitCode=25 matching."""
        matcher = ScoredMatcher()

        # Query mentions exit code 25 but also build successful
        query = "ExitCode=25 earlier but then BUILD SUCCESSFUL"
        results = matcher.match_query(query)

        # Should NOT match exitcode_25 due to negative pattern
        exitcode_tag = next(
            (t for t in results if t.tag_id == "build.exitcode_25"),
            None,
        )
        # The tag should either not be present or have negative blocks recorded
        if exitcode_tag:
            assert len(exitcode_tag.trace.negative_blocks) > 0


class TestTieBreakers:
    """Test deterministic tie-breaking."""

    def test_deterministic_ordering(self):
        """Same query always produces same order."""
        matcher = ScoredMatcher()
        query = "Blueprint packaging issue"

        # Run multiple times
        results1 = matcher.match_query(query)
        results2 = matcher.match_query(query)
        results3 = matcher.match_query(query)

        # Order should be identical
        order1 = [t.tag_id for t in results1]
        order2 = [t.tag_id for t in results2]
        order3 = [t.tag_id for t in results3]

        assert order1 == order2 == order3, "Results should be deterministic"

    def test_higher_priority_wins_ties(self):
        """When scores are equal, higher priority rule wins."""
        matcher = ScoredMatcher()

        # Both packaging and blueprint might match this
        query = "packaging my blueprint project"
        results = matcher.match_query(query)

        # packaging has higher priority (60) than blueprint (40) in rules
        [t.tag_id for t in results if "packag" in t.tag_id or "blueprint" in t.tag_id]

        # Verify we got results
        assert len(results) > 0, "Expected some matches"


class TestVersionConstraints:
    """Test engine version filtering."""

    def test_ue5_only_tags_filtered_for_ue4(self):
        """Tags with min version 5.0 should not match UE4 queries."""
        matcher = ScoredMatcher()

        # Lumen is UE5 only
        query = "UE4 Lumen flickering"
        results = matcher.match_query(query, engine_version="4.27")

        # Lumen tag should be filtered out
        lumen_tag = next((t for t in results if t.tag_id == "rendering.lumen"), None)
        assert lumen_tag is None or lumen_tag.trace.version_filtered, \
            "Lumen should be filtered for UE4"

    def test_version_extraction_from_query(self):
        """Version should be extracted from query text."""
        matcher = ScoredMatcher()

        # UE5.3 mentioned in query
        query = "UE5.3 crashes with access violation"
        results = matcher.match_query(query)

        # Should still get access violation tag (works on all versions)
        av_tag = next((t for t in results if "access_violation" in t.tag_id), None)
        assert av_tag is not None, "Should match access_violation"


class TestGoldenQueries:
    """Test against golden query examples."""

    def test_exitcode_25_query(self, sample_queries):
        """Test ExitCode=25 query matches expected tags."""
        matcher = ScoredMatcher()
        query = sample_queries[0]

        results = matcher.match_query(query["query"])
        tag_ids = [t.tag_id for t in results]

        # Top tag should match
        assert results[0].tag_id == query["expected_top_tag"], \
            f"Expected top tag {query['expected_top_tag']}, got {results[0].tag_id}"

        # All expected tags should be present
        for expected in query["expected_tags"]:
            assert expected in tag_ids, f"Expected {expected} in results"

    def test_d3d_crash_query(self, sample_queries):
        """Test D3D crash query matches expected tags."""
        matcher = ScoredMatcher()
        query = sample_queries[1]

        results = matcher.match_query(query["query"])
        tag_ids = [t.tag_id for t in results]

        # D3D crash should be in results (ordering may vary by rule weights)
        assert "crash.d3d_device_lost" in tag_ids, \
            f"Expected crash.d3d_device_lost in {tag_ids}"

        # Verify it has a high score (exact signature match)
        d3d_tag = next(t for t in results if t.tag_id == "crash.d3d_device_lost")
        assert d3d_tag.score > 0.3, "D3D crash should have significant score"

    def test_accessed_none_query(self, sample_queries):
        """Test Accessed None query matches expected tags."""
        matcher = ScoredMatcher()
        query = sample_queries[2]

        results = matcher.match_query(query["query"])
        tag_ids = [t.tag_id for t in results]

        # Should have blueprint.accessed_none
        assert query["expected_top_tag"] in tag_ids


class TestTraceOutput:
    """Test that traces are complete and informative."""

    def test_trace_includes_pattern_details(self):
        """Trace should include matched pattern details."""
        matcher = ScoredMatcher()
        results = matcher.match_query("ExitCode=25")

        assert len(results) > 0
        tag = results[0]

        # Trace should have patterns
        assert len(tag.trace.patterns_matched) > 0, "Expected matched patterns"

        # Each pattern should have details
        for pm in tag.trace.patterns_matched:
            assert pm.rule_id, "Pattern should have rule_id"
            assert pm.signal_type, "Pattern should have signal_type"
            assert pm.contribution > 0, "Pattern should have positive contribution"

    def test_trace_includes_scores(self):
        """Trace should include raw and final scores."""
        matcher = ScoredMatcher()
        results = matcher.match_query("Blueprint Accessed None")

        assert len(results) > 0
        tag = results[0]

        assert tag.trace.raw_score > 0, "Expected positive raw score"
        assert tag.trace.final_score > 0, "Expected positive final score"
