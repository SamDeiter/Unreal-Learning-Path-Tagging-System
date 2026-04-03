"""Tests for scripts/enrich_tags/add_metadata.py."""

import sys
from pathlib import Path

# Add scripts to path so we can import the module
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts" / "enrich_tags"))

from add_metadata import estimate_duration, get_difficulty, get_prerequisites


class TestGetDifficulty:
    """Test difficulty level extraction from course codes."""

    def test_beginner_course(self):
        assert get_difficulty("111.01") == 1

    def test_intermediate_course(self):
        assert get_difficulty("211.02") == 3

    def test_advanced_course(self):
        assert get_difficulty("311.03") == 5

    def test_unknown_series(self):
        assert get_difficulty("411.00") == 2

    def test_invalid_code(self):
        """Should return default 2 for unparseable codes."""
        assert get_difficulty("") == 2
        assert get_difficulty("abc") == 2

    def test_single_digit_code(self):
        assert get_difficulty("1") == 1


class TestEstimateDuration:
    """Test duration estimation from video count."""

    def test_zero_videos(self):
        assert estimate_duration(0) == 0

    def test_single_video(self):
        assert estimate_duration(1) == 10

    def test_ten_videos(self):
        assert estimate_duration(10) == 100


class TestGetPrerequisites:
    """Test prerequisite suggestion logic."""

    def test_known_prerequisite(self):
        prereqs = get_prerequisites("311.01")
        assert "211.02" in prereqs

    def test_series_based_intermediate(self):
        """200-series should suggest 100-series equivalent."""
        prereqs = get_prerequisites("201.00")
        assert any("1" in p for p in prereqs)

    def test_series_based_advanced(self):
        """300-series should suggest 200-series equivalent."""
        prereqs = get_prerequisites("301.00")
        assert any("2" in p for p in prereqs)

    def test_beginner_no_prereqs(self):
        """100-series should have no series-based prereqs."""
        prereqs = get_prerequisites("101.00")
        # Should only have direct mapping prereqs, not series-based
        # 101.00 is not in PREREQUISITE_MAP, so empty
        assert len(prereqs) == 0

    def test_invalid_code(self):
        """Invalid codes should return empty list gracefully."""
        prereqs = get_prerequisites("invalid")
        assert isinstance(prereqs, list)
