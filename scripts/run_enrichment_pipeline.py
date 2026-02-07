"""
Run all Gemini enrichment scripts in sequence.
Loads API key from .env file if present.

Usage (from repo root):
  python scripts/run_enrichment_pipeline.py
"""

import subprocess
import sys
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Load .env file if it exists (no dependency needed)
env_file = REPO_ROOT / ".env"
if env_file.exists():
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ[key.strip()] = value.strip()
    print("✅ Loaded API key from .env file")

SCRIPTS = [
    ("Segment Summaries", "scripts/summarize_segments.py"),
    ("Learning Objectives", "scripts/generate_learning_objectives.py"),
    ("Quiz Questions", "scripts/generate_quiz_questions.py"),
    ("Prerequisites", "scripts/detect_prerequisites.py"),
]


def main():
    # Verify API key is available
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ No API key found!")
        print("   Option 1: Create a .env file with GOOGLE_API_KEY=your_key")
        print("   Option 2: set GOOGLE_API_KEY=your_key (in terminal)")
        return

    print("=" * 60)
    print("🚀 Gemini Enrichment Pipeline")
    print(f"   API Key: {api_key[:8]}...{api_key[-4:]}")
    print("=" * 60)

    for name, script in SCRIPTS:
        script_path = REPO_ROOT / script
        if not script_path.exists():
            print(f"\n⚠️ Skipping {name}: {script} not found")
            continue

        print(f"\n{'=' * 60}")
        print(f"▶️  Running: {name}")
        print(f"   Script:  {script}")
        print(f"{'=' * 60}\n")

        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(REPO_ROOT),
            env={**os.environ},  # pass env vars including API key
        )

        if result.returncode != 0:
            print(f"\n❌ {name} failed with code {result.returncode}")
            print("   Continuing to next script...")

    print(f"\n{'=' * 60}")
    print("✅ Pipeline complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
