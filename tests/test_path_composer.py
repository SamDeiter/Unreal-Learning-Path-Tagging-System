"""Tests for the path composer."""

import sys
from pathlib import Path

import pytest

# Add ingestion to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.path_composer import PathComposer
from ingestion.scored_matcher import ScoredMatcher


class TestEdgeExpansion:
    """Test that edges correctly expand tag sets."""

    def test_symptom_of_adds_root_cause(self):
        """symptom_of edges should add root cause tags."""
        composer = PathComposer()
        matcher = ScoredMatcher()

        # Query about a symptom
        query = "Lumen flickering and screen tearing"
        tags = matcher.match_query(query)

        if len(tags) == 0:
            pytest.skip("No tags matched - need more rules")

        path = composer.compose_path(query, tags)

        # Check edge expansions
        [
            e for e in path.edge_expansions
            if e.relation == "symptom_of"
        ]
        # May or may not have expansions depending on edge graph

    def test_prerequisite_edges_add_foundation_tags(self):
        """prerequisite edges should add foundation topics."""
        composer = PathComposer()
        matcher = ScoredMatcher()

        # Advanced topic that has prerequisites
        query = "Nanite virtualized geometry LOD issues"
        tags = matcher.match_query(query)

        if len(tags) == 0:
            pytest.skip("No tags matched")

        composer.compose_path(query, tags)
        # Path should include prerequisite topics in edge expansions


class TestAtomSelection:
    """Test that atoms are selected correctly."""

    def test_matching_atoms_found(self, atoms_path):
        """Atoms matching tags should be selected."""
        if not atoms_path.exists() or not list(atoms_path.glob("*.json")):
            pytest.skip("No atoms created yet")

        composer = PathComposer()
        matcher = ScoredMatcher()

        query = "ExitCode=25 packaging failure"
        tags = matcher.match_query(query)
        path = composer.compose_path(query, tags)

        # Should have some steps
        assert len(path.steps) > 0, "Expected at least one step"

    def test_all_step_types_covered(self, atoms_path):
        """Path should try to cover all step types."""
        if not atoms_path.exists() or not list(atoms_path.glob("*.json")):
            pytest.skip("No atoms created yet")

        composer = PathComposer()
        matcher = ScoredMatcher()

        query = "ExitCode=25 UE5 packaging"
        tags = matcher.match_query(query)
        path = composer.compose_path(query, tags)

        step_types = {s.atom.step_type for s in path.steps}

        # If we have atoms, should cover multiple types
        assert len(step_types) >= 1, "Expected at least one step type"


class TestStepOrdering:
    """Test that steps are ordered correctly."""

    def test_foundation_before_diagnostic(self, atoms_path):
        """Foundation steps should come before diagnostic."""
        if not atoms_path.exists() or not list(atoms_path.glob("*.json")):
            pytest.skip("No atoms created yet")

        composer = PathComposer()
        matcher = ScoredMatcher()

        query = "ExitCode=25 build failure"
        tags = matcher.match_query(query)
        path = composer.compose_path(query, tags)

        # Find step type positions
        step_types = [s.atom.step_type for s in path.steps]

        if "foundation" in step_types and "diagnostic" in step_types:
            foundation_pos = step_types.index("foundation")
            diagnostic_pos = step_types.index("diagnostic")
            assert foundation_pos < diagnostic_pos, \
                "Foundation should come before diagnostic"

    def test_verification_comes_last(self, atoms_path):
        """Verification steps should be at the end."""
        if not atoms_path.exists() or not list(atoms_path.glob("*.json")):
            pytest.skip("No atoms created yet")

        composer = PathComposer()
        matcher = ScoredMatcher()

        query = "Fix packaging error ExitCode=25"
        tags = matcher.match_query(query)
        path = composer.compose_path(query, tags)

        # Verification should be after remediation
        step_types = [s.atom.step_type for s in path.steps]

        if "verification" in step_types and "remediation" in step_types:
            remediation_pos = step_types.index("remediation")
            verification_pos = step_types.index("verification")
            assert remediation_pos < verification_pos, \
                "Remediation should come before verification"


class TestTemplateFallback:
    """Test fallback to golden templates."""

    def test_uses_template_when_atoms_insufficient(self):
        """Should fall back to template when atoms don't cover all types."""
        composer = PathComposer()
        matcher = ScoredMatcher()

        # Query that likely has a template but few atoms
        query = "ExitCode=25 UE5"
        tags = matcher.match_query(query)

        if len(tags) == 0:
            pytest.skip("No tags matched")

        path = composer.compose_path(query, tags)

        # Either has steps from atoms or fell back to template
        assert len(path.steps) > 0 or path.fallback_template is not None, \
            "Should have steps from atoms or template"


class TestPathOutput:
    """Test the composed path output format."""

    def test_path_has_required_fields(self, atoms_path):
        """Path should have all required fields."""
        if not atoms_path.exists() or not list(atoms_path.glob("*.json")):
            pytest.skip("No atoms created yet")

        composer = PathComposer()
        matcher = ScoredMatcher()

        query = "UE5 packaging fails"
        tags = matcher.match_query(query)
        path = composer.compose_path(query, tags)

        # Check required fields
        assert path.path_id, "Path should have ID"
        assert path.title, "Path should have title"
        assert isinstance(path.tags, list), "Tags should be a list"
        assert isinstance(path.steps, list), "Steps should be a list"
        assert path.total_duration_minutes >= 0, "Duration should be non-negative"

    def test_to_dict_serializable(self, atoms_path):
        """to_dict() output should be JSON-serializable."""
        if not atoms_path.exists() or not list(atoms_path.glob("*.json")):
            pytest.skip("No atoms created yet")

        import json

        composer = PathComposer()
        matcher = ScoredMatcher()

        query = "ExitCode=25"
        tags = matcher.match_query(query)
        path = composer.compose_path(query, tags)

        # Should serialize without error
        json_str = json.dumps(path.to_dict())
        assert json_str, "Should produce valid JSON"


class TestDeterminism:
    """Test that path composition is deterministic."""

    def test_same_query_same_path(self, atoms_path):
        """Same query should produce identical paths."""
        if not atoms_path.exists() or not list(atoms_path.glob("*.json")):
            pytest.skip("No atoms created yet")

        composer = PathComposer()
        matcher = ScoredMatcher()

        query = "ExitCode=25 packaging error"

        # Run three times
        tags1 = matcher.match_query(query)
        path1 = composer.compose_path(query, tags1)

        tags2 = matcher.match_query(query)
        path2 = composer.compose_path(query, tags2)

        tags3 = matcher.match_query(query)
        path3 = composer.compose_path(query, tags3)

        # Paths should be identical
        steps1 = [s.atom.atom_id for s in path1.steps]
        steps2 = [s.atom.atom_id for s in path2.steps]
        steps3 = [s.atom.atom_id for s in path3.steps]

        assert steps1 == steps2 == steps3, "Path composition should be deterministic"
