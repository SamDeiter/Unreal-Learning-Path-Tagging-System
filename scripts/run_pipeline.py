#!/usr/bin/env python3
"""run_pipeline.py — End-to-end RAG embedding pipeline orchestrator.

Generates all embedding files, uploads to Firestore, and verifies freshness.

Usage:
    python scripts/run_pipeline.py                  # Full pipeline
    python scripts/run_pipeline.py --dry-run        # Preview all steps
    python scripts/run_pipeline.py --resume         # Resume interrupted run
    python scripts/run_pipeline.py --skip-upload    # Generate only, don't upload
    python scripts/run_pipeline.py --only segments  # Run single step
    python scripts/run_pipeline.py --status         # Show current state only
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
DATA_DIR = ROOT / "path-builder" / "src" / "data"
CONTENT_DIR = ROOT / "content"

PIPELINE_STATE_FILE = ROOT / "content" / "pipeline_state.json"

# Load .env
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env", override=True)
except ImportError:
    pass


# ── Pipeline Steps ─────────────────────────────────────────────────────

STEPS = [
    {
        "id": "segments",
        "name": "Segment Embeddings (transcripts)",
        "command": [sys.executable, str(SCRIPTS / "embed_segments.py")],
        "resume_flag": "--resume",
        "dry_run_flag": "--dry-run",
        "output": DATA_DIR / "segment_embeddings.json",
        "requires": [DATA_DIR / "segment_index.json"],
        "env_keys": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "est_minutes": 5,
    },
    {
        "id": "epic_learning",
        "name": "Epic Learning Embeddings",
        "command": [sys.executable, str(SCRIPTS / "embed_epic_learning.py")],
        "resume_flag": None,
        "incremental_flag": "--incremental",
        "dry_run_flag": "--dry-run",
        "output": DATA_DIR / "epic_learning_embeddings.json",
        "requires": [CONTENT_DIR / "epic_learning" / "extracted"],
        "env_keys": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "est_minutes": 2,
    },
    {
        "id": "docs",
        "name": "Doc Embeddings (Epic UE5 docs)",
        "command": [sys.executable, str(SCRIPTS / "scrape_epic_docs.py"), "--embed-only"],
        "resume_flag": "--resume",
        "dry_run_flag": None,  # scrape_epic_docs doesn't have dry-run for embed-only
        "output": DATA_DIR / "docs_embeddings.json",
        "requires": [CONTENT_DIR / "scraped_docs.json"],
        "env_keys": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "est_minutes": 3,
    },
    {
        "id": "udn_docs",
        "name": "UDN Doc Embeddings (merge into docs)",
        "command": [sys.executable, str(SCRIPTS / "embed_udn_docs.py")],
        "resume_flag": "--resume",
        "dry_run_flag": "--dry-run",
        "output": DATA_DIR / "docs_embeddings.json",  # merges into same file
        "requires": [
            CONTENT_DIR / "udn_docs.json",
            DATA_DIR / "docs_embeddings.json",  # must run after docs step
        ],
        "env_keys": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "depends_on": "docs",
        "est_minutes": 3,
    },
    {
        "id": "courses",
        "name": "Course Embeddings",
        "command": [sys.executable, str(SCRIPTS / "build_embeddings.py")],
        "resume_flag": None,
        "dry_run_flag": None,
        "output": DATA_DIR / "course_embeddings.json",
        "requires": [
            DATA_DIR / "video_library_enriched.json",
            DATA_DIR / "search_index.json",
        ],
        "env_keys": ["GOOGLE_API_KEY"],  # build_embeddings.py only checks this one
        "est_minutes": 1,
    },
    {
        "id": "upload",
        "name": "Upload to Firestore",
        "command": [sys.executable, str(SCRIPTS / "upload_embeddings_to_firestore.py")],
        "resume_flag": None,
        "dry_run_flag": "--dry-run",
        "output": None,
        "requires": [
            DATA_DIR / "segment_embeddings.json",
            DATA_DIR / "epic_learning_embeddings.json",
            DATA_DIR / "docs_embeddings.json",
            DATA_DIR / "course_embeddings.json",
        ],
        "env_keys": [],
        "depends_on": "all_embeddings",
        "est_minutes": 1,
    },
    {
        "id": "verify",
        "name": "Verify Freshness",
        "command": [sys.executable, str(SCRIPTS / "check_embeddings.py")],
        "resume_flag": None,
        "dry_run_flag": None,
        "output": None,
        "requires": [],
        "env_keys": [],
        "est_minutes": 0,
    },
]

EMBEDDING_STEPS = [s["id"] for s in STEPS if s["id"] not in ("upload", "verify")]


# ── State Management ───────────────────────────────────────────────────

def load_state():
    """Load pipeline state from disk."""
    if PIPELINE_STATE_FILE.exists():
        try:
            with open(PIPELINE_STATE_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"completed": [], "failed": [], "started_at": None}


def save_state(state):
    """Persist pipeline state for resume."""
    PIPELINE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PIPELINE_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def clear_state():
    """Remove pipeline state file."""
    if PIPELINE_STATE_FILE.exists():
        PIPELINE_STATE_FILE.unlink()


# ── Helpers ────────────────────────────────────────────────────────────

def check_api_key():
    """Verify at least one API key is available."""
    gemini = os.environ.get("GEMINI_API_KEY")
    google = os.environ.get("GOOGLE_API_KEY")

    if not gemini and not google:
        print("ERROR: No API key found.")
        print("  Set GEMINI_API_KEY or GOOGLE_API_KEY in your .env file or environment.")
        print(f"  .env location: {ROOT / '.env'}")
        return False

    # build_embeddings.py only checks GOOGLE_API_KEY — alias if needed
    if gemini and not google:
        os.environ["GOOGLE_API_KEY"] = gemini
        print("  Note: Aliased GEMINI_API_KEY -> GOOGLE_API_KEY for build_embeddings.py")

    print(f"  API key: {'GEMINI_API_KEY' if gemini else 'GOOGLE_API_KEY'} [set]")
    return True


def check_gcloud_auth():
    """Check if gcloud is authenticated for Firestore uploads."""
    try:
        result = subprocess.run(
            ["gcloud", "auth", "application-default", "print-access-token"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return False


def file_size_mb(path):
    """Return file size in MB or None if missing."""
    if path and path.exists():
        return path.stat().st_size / (1024 * 1024)
    return None


def format_duration(seconds):
    """Human-readable duration."""
    if seconds < 60:
        return f"{seconds:.0f}s"
    minutes = seconds / 60
    if minutes < 60:
        return f"{minutes:.1f}m"
    return f"{minutes / 60:.1f}h"


def print_step_header(step, index, total):
    """Print formatted step header."""
    est = f"~{step['est_minutes']}m" if step["est_minutes"] else ""
    print(f"\n{'=' * 60}")
    print(f"  Step {index}/{total}: {step['name']}  {est}")
    print(f"{'=' * 60}")


def check_requirements(step):
    """Check if a step's required input files exist."""
    missing = []
    for req in step["requires"]:
        if not req.exists():
            missing.append(str(req.relative_to(ROOT)))
    return missing


# ── Status Report ──────────────────────────────────────────────────────

def show_status():
    """Show current state of all embedding files and pipeline."""
    print("=" * 60)
    print("  RAG Pipeline Status")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # API key
    has_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    print(f"\n  API Key: {'set' if has_key else 'MISSING'}")

    # gcloud auth
    has_gcloud = check_gcloud_auth()
    print(f"  gcloud auth: {'authenticated' if has_gcloud else 'NOT AUTHENTICATED (needed for upload)'}")

    # Embedding files
    print(f"\n  {'File':<40} {'Status':<10} {'Size':>8}")
    print(f"  {'-'*40} {'-'*10} {'-'*8}")

    for step in STEPS:
        if step["output"] is None:
            continue
        path = step["output"]
        name = path.name
        if path.exists():
            mb = file_size_mb(path)
            print(f"  {name:<40} {'EXISTS':<10} {mb:>7.1f}M")
        else:
            print(f"  {name:<40} {'MISSING':<10} {'':>8}")

    # Required source files
    print(f"\n  {'Source File':<50} {'Status':<10}")
    print(f"  {'-'*50} {'-'*10}")

    all_reqs = set()
    for step in STEPS:
        for req in step["requires"]:
            all_reqs.add(req)
    for req in sorted(all_reqs, key=str):
        rel = str(req.relative_to(ROOT))
        exists = req.exists()
        print(f"  {rel:<50} {'OK' if exists else 'MISSING'}")

    # Pipeline state
    state = load_state()
    if state.get("completed"):
        print(f"\n  Last run: {state.get('started_at', 'unknown')}")
        print(f"  Completed: {', '.join(state['completed'])}")
        if state.get("failed"):
            print(f"  Failed: {', '.join(state['failed'])}")

    # Checkpoint
    checkpoint = CONTENT_DIR / "embedding_checkpoint.json"
    if checkpoint.exists():
        try:
            with open(checkpoint) as f:
                cp = json.load(f)
            print(f"\n  Stale checkpoint: {cp['embeddings_done']} segments from {cp['timestamp']}")
        except (json.JSONDecodeError, KeyError):
            pass

    print(f"\n{'=' * 60}")


# ── Run Step ───────────────────────────────────────────────────────────

def run_step(step, dry_run=False, resume=False):
    """Execute a single pipeline step. Returns True on success."""
    # Check requirements
    missing = check_requirements(step)
    if missing:
        print(f"\n  SKIP: Missing required files:")
        for m in missing:
            print(f"    - {m}")
        return False

    # Build command
    cmd = list(step["command"])
    if dry_run:
        if step.get("dry_run_flag"):
            cmd.append(step["dry_run_flag"])
        elif step["id"] not in ("verify",):
            # Skip steps without dry-run support to avoid accidental real runs
            print(f"\n  SKIP: No --dry-run support (would run for real)")
            return True
    elif resume and step.get("resume_flag"):
        cmd.append(step["resume_flag"])
    elif resume and step.get("incremental_flag"):
        cmd.append(step["incremental_flag"])

    print(f"\n  Running: {' '.join(os.path.basename(c) for c in cmd)}")
    print(f"  {'-' * 50}")

    start = time.time()

    try:
        # Force UTF-8 on Windows to avoid cp1252 encoding errors with Unicode symbols
        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"

        result = subprocess.run(
            cmd,
            cwd=str(ROOT),
            env=env,
            timeout=1800,  # 30 min max per step
        )
        elapsed = time.time() - start

        if result.returncode == 0:
            output = step.get("output")
            size = file_size_mb(output)
            size_str = f" ({size:.1f} MB)" if size else ""
            print(f"\n  Done in {format_duration(elapsed)}{size_str}")
            return True
        else:
            print(f"\n  FAILED (exit code {result.returncode}) after {format_duration(elapsed)}")
            return False

    except subprocess.TimeoutExpired:
        print(f"\n  TIMEOUT after 30 minutes")
        return False
    except KeyboardInterrupt:
        print(f"\n  Interrupted by user")
        raise


# ── Main ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="End-to-end RAG embedding pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/run_pipeline.py                  # Full pipeline
  python scripts/run_pipeline.py --dry-run        # Preview all steps
  python scripts/run_pipeline.py --resume         # Resume from failure
  python scripts/run_pipeline.py --only segments  # Single step only
  python scripts/run_pipeline.py --skip-upload    # Generate embeddings only
  python scripts/run_pipeline.py --status         # Show current state
        """,
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview what each step would do without calling APIs")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from last successful step (also uses --resume/--incremental per script)")
    parser.add_argument("--skip-upload", action="store_true",
                        help="Generate embeddings but don't upload to Firestore")
    parser.add_argument("--only", choices=[s["id"] for s in STEPS],
                        help="Run only a specific step")
    parser.add_argument("--status", action="store_true",
                        help="Show current pipeline state and exit")
    parser.add_argument("--clean", action="store_true",
                        help="Clear pipeline state and stale checkpoints, then exit")
    args = parser.parse_args()

    # Status mode
    if args.status:
        show_status()
        return 0

    # Clean mode
    if args.clean:
        clear_state()
        for cp in [
            CONTENT_DIR / "embedding_checkpoint.json",
            CONTENT_DIR / "epic_learning_embed_checkpoint.json",
            CONTENT_DIR / "udn_embedding_checkpoint.json",
            CONTENT_DIR / "docs_embedding_checkpoint.json",
        ]:
            if cp.exists():
                cp.unlink()
                print(f"  Removed {cp.name}")
        print("  Pipeline state cleared.")
        return 0

    # Header
    print("=" * 60)
    print("  RAG Embedding Pipeline")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if args.dry_run:
        print("  MODE: DRY RUN")
    elif args.resume:
        print("  MODE: RESUME")
    print("=" * 60)

    # Preflight checks
    print("\nPreflight checks:")

    if not check_api_key():
        return 1

    if not args.skip_upload and not args.dry_run and args.only != "verify":
        if not check_gcloud_auth():
            print("  WARNING: gcloud not authenticated. Upload step will fail.")
            print("  Run: gcloud auth application-default login")
            if not args.skip_upload and args.only == "upload":
                return 1

    # Determine which steps to run
    if args.only:
        steps_to_run = [s for s in STEPS if s["id"] == args.only]
    else:
        steps_to_run = list(STEPS)
        if args.skip_upload:
            steps_to_run = [s for s in steps_to_run if s["id"] != "upload"]

    # Resume: skip already-completed steps
    state = load_state()
    if args.resume and state.get("completed"):
        completed = set(state["completed"])
        before = len(steps_to_run)
        steps_to_run = [s for s in steps_to_run if s["id"] not in completed]
        skipped = before - len(steps_to_run)
        if skipped:
            print(f"\n  Resuming: skipping {skipped} completed steps ({', '.join(sorted(completed))})")

    if not steps_to_run:
        print("\n  Nothing to do! All steps already completed.")
        print("  Use --clean to reset pipeline state.")
        return 0

    # Estimate total time
    total_est = sum(s["est_minutes"] for s in steps_to_run)
    print(f"\n  Steps: {len(steps_to_run)}  |  Estimated: ~{total_est} minutes")

    # Initialize state
    if not args.resume:
        state = {"completed": [], "failed": [], "started_at": datetime.now().isoformat()}
        save_state(state)
    elif not state.get("started_at"):
        state["started_at"] = datetime.now().isoformat()
        save_state(state)

    # Run pipeline
    pipeline_start = time.time()
    succeeded = 0
    failed = 0

    for i, step in enumerate(steps_to_run, 1):
        print_step_header(step, i, len(steps_to_run))

        success = run_step(step, dry_run=args.dry_run, resume=args.resume)

        if success:
            succeeded += 1
            if not args.dry_run:
                state["completed"].append(step["id"])
                save_state(state)
        else:
            failed += 1
            state["failed"].append(step["id"])
            save_state(state)

            # Check if downstream steps depend on this
            if step["id"] in EMBEDDING_STEPS:
                print(f"\n  WARNING: {step['name']} failed.")
                # Don't abort — later steps might still work if they're independent
                # But if upload depends on this, it will fail its own requirements check

    # Summary
    total_time = time.time() - pipeline_start
    print(f"\n{'=' * 60}")
    print(f"  Pipeline Complete — {format_duration(total_time)}")
    print(f"{'=' * 60}")
    print(f"  Succeeded: {succeeded}/{len(steps_to_run)}")
    if failed:
        print(f"  Failed:    {failed}/{len(steps_to_run)}")
        print(f"\n  To retry failed steps: python scripts/run_pipeline.py --resume")

    # Show output files
    if not args.dry_run:
        print(f"\n  Output files:")
        for step in STEPS:
            if step["output"] and step["output"].exists():
                mb = file_size_mb(step["output"])
                print(f"    {step['output'].name}: {mb:.1f} MB")

    # Clean state on full success
    if failed == 0 and not args.dry_run and not args.only:
        clear_state()
        print(f"\n  Pipeline state cleaned up.")

    return 1 if failed > 0 else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nPipeline interrupted. Run with --resume to continue.")
        sys.exit(130)
