"""Pytest fixtures for the Unreal Learning Path Tagging System tests."""

import json
from pathlib import Path

import pytest


@pytest.fixture
def project_root():
    """Return the project root directory."""
    return Path(__file__).parent.parent


@pytest.fixture
def tags_path(project_root):
    """Return path to tags.json."""
    return project_root / "tags" / "tags.json"


@pytest.fixture
def rules_path(project_root):
    """Return path to match_rules.json."""
    return project_root / "ingestion" / "match_rules.json"


@pytest.fixture
def edges_path(project_root):
    """Return path to edges.json."""
    return project_root / "tags" / "edges.json"


@pytest.fixture
def atoms_path(project_root):
    """Return path to atoms directory."""
    return project_root / "steps" / "atoms"


@pytest.fixture
def sample_queries():
    """Return sample queries for testing."""
    return [
        {
            "query": "UE5 packaging fails with ExitCode=25",
            "expected_tags": ["build.exitcode_25", "build.packaging"],
            "expected_top_tag": "build.exitcode_25",
        },
        {
            "query": "My game crashes with DXGI_ERROR_DEVICE_REMOVED when I enable Lumen",
            "expected_tags": ["crash.d3d_device_lost", "rendering.lumen"],
            "expected_top_tag": "crash.d3d_device_lost",
        },
        {
            "query": "Blueprint error: Accessed None trying to read property",
            "expected_tags": ["blueprint.accessed_none", "scripting.blueprint"],
            "expected_top_tag": "blueprint.accessed_none",
        },
        {
            "query": "C++ linker error LNK2019 unresolved external symbol",
            "expected_tags": ["scripting.cpp"],
            "expected_top_tag": "scripting.cpp",
        },
    ]


@pytest.fixture
def load_tags(tags_path):
    """Load tags database."""
    with open(tags_path, encoding="utf-8") as f:
        data = json.load(f)
    return {tag["tag_id"]: tag for tag in data.get("tags", [])}


@pytest.fixture
def load_rules(rules_path):
    """Load match rules."""
    with open(rules_path, encoding="utf-8") as f:
        return json.load(f).get("rules", [])


@pytest.fixture
def load_edges(edges_path):
    """Load edges."""
    with open(edges_path, encoding="utf-8") as f:
        return json.load(f).get("edges", [])
