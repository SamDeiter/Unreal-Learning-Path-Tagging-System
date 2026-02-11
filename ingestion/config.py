"""Shared configuration for ingestion module.

Loads environment variables and provides centralized config access.
"""

import os
from pathlib import Path


def load_env() -> dict[str, str]:
    """Load environment variables from .env file.

    Returns:
        Dictionary of environment variables.
    """
    env_vars = {}
    env_path = Path(__file__).parent.parent / ".env"

    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
                    os.environ[key.strip()] = value.strip()

    return env_vars


# Load on import
_env = load_env()


def get_youtube_api_key() -> str:
    """Get YouTube API key from environment.

    Returns:
        API key string.

    Raises:
        ValueError: If API key not configured.
    """
    key = os.environ.get("YOUTUBE_API_KEY", "")
    if not key or key == "your_api_key_here":
        raise ValueError(
            "YOUTUBE_API_KEY not configured. "
            "Copy .env.example to .env and add your key."
        )
    return key


# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
TAGS_DIR = PROJECT_ROOT / "tags"
INGESTION_DIR = PROJECT_ROOT / "ingestion"
LEARNING_PATHS_DIR = PROJECT_ROOT / "learning_paths"
