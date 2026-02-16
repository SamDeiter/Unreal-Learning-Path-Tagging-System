"""Tag Enrichment Pipeline - Main Entry Point.

CLI for running the full 6-phase tag enrichment pipeline.

Phase 8B: Added state.json checkpointing for resume-on-failure.

Usage:
    python -m scripts.enrich_tags.main --all
    python -m scripts.enrich_tags.main --phase 0
    python -m scripts.enrich_tags.main --phase 2 --model medium
    python -m scripts.enrich_tags.main --all --reset  (force clean restart)
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

from .phase0_existing import run_phase0
from .phase1_filenames import run_phase1
from .phase2_whisper import run_phase2
from .phase3_normalize import run_phase3
from .phase4_edges import run_phase4
from .phase5_gemini import run_phase5
from .youtube_transcripts import fetch_youtube_transcripts

# Phase 8B: State management for pipeline checkpointing
STATE_FILENAME = "pipeline_state.json"


def load_state(content_dir: Path) -> dict:
    """Load pipeline state from checkpoint file."""
    state_path = content_dir / STATE_FILENAME
    if state_path.exists():
        try:
            return json.loads(state_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"⚠️ Could not read state file: {e}")
    return {
        "last_completed_phase": -1,
        "completed_courses": {},
        "started_at": None,
        "updated_at": None,
    }


def save_state(content_dir: Path, state: dict):
    """Save pipeline state to checkpoint file."""
    state["updated_at"] = datetime.now().isoformat()
    state_path = content_dir / STATE_FILENAME
    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def load_video_library(content_dir: Path) -> list[dict]:
    """Load courses from video_library.json."""
    lib_path = content_dir / "video_library.json"
    if not lib_path.exists():
        print(f"❌ Video library not found: {lib_path}")
        return []

    data = json.loads(lib_path.read_text(encoding="utf-8"))
    return data.get("courses", [])


def save_enriched_library(
    courses: list[dict],
    tag_results: dict[str, dict],
    edges: list[dict],
    output_dir: Path,
):
    """Save enriched video library and edges."""
    # Update courses with tag results
    for course in courses:
        code = course.get("code")
        if code and code in tag_results:
            result = tag_results[code]
            course["ai_tags"] = result.get("ai_tags", [])
            course["canonical_tags"] = result.get("canonical_tags", [])
            course["has_cc"] = True  # Will be set by transcription
            # Mark as enriched if we generated any tags
            if result.get("ai_tags") or result.get("canonical_tags"):
                course["gemini_enriched"] = True

    # Save enriched library
    output = {
        "generated_at": datetime.now().isoformat(),
        "courses": courses,
    }

    enriched_path = output_dir / "video_library_enriched.json"
    enriched_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"💾 Saved: {enriched_path}")

    # Save edges
    edges_path = output_dir / "generated_edges.json"
    edges_path.write_text(json.dumps(edges, indent=2), encoding="utf-8")
    print(f"💾 Saved: {edges_path}")


def run_external_discovery(content_dir: Path) -> int:
    """Phase 0.5: Run all external content discovery.

    Calls YouTube discovery (uploads + playlists/courses tab)
    and Epic Docs ingestion in sequence.  External entries are
    written to video_library.json so Phases 1-5 treat them
    identically to local courses.

    Args:
        content_dir: Path to content/ directory.

    Returns:
        Total number of new courses added.
    """
    print("\n" + "=" * 60)
    print("🌐 PHASE 0.5: EXTERNAL DISCOVERY")
    print("=" * 60)

    total_new = 0

    # --- YouTube uploads ---
    print("\n📹 Step 1/3: YouTube uploads...")
    try:
        yt_new = run_youtube_discovery(content_dir)
        total_new += yt_new
    except Exception as e:
        print(f"   ⚠️  YouTube uploads discovery failed: {e}")

    # --- YouTube playlists (courses tab) ---
    print("\n📚 Step 2/3: YouTube playlists (courses tab)...")
    try:
        total_new += _ingest_playlists(content_dir)
    except Exception as e:
        print(f"   ⚠️  YouTube playlists discovery failed: {e}")

    # --- Epic Docs ---
    print("\n📄 Step 3/3: Epic Docs ingestion...")
    try:
        docs_new = run_docs_ingestion(content_dir)
        total_new += docs_new
    except Exception as e:
        print(f"   ⚠️  Epic Docs ingestion failed: {e}")

    print(f"\n✅ External discovery complete: {total_new} new entries")
    return total_new


def _ingest_playlists(content_dir: Path) -> int:
    """Fetch YouTube playlists and merge new videos into the library."""
    import sys
    sys.path.insert(0, str(content_dir.parent))

    from ingestion.youtube_fetcher import YouTubeFetcher, convert_to_course_format

    # Load existing library
    library_path = content_dir / "video_library.json"
    if library_path.exists():
        with open(library_path, encoding="utf-8") as f:
            library = json.load(f)
    else:
        library = {"courses": []}

    existing_ids = {c.get("code", "") for c in library.get("courses", [])}

    fetcher = YouTubeFetcher()
    playlists = fetcher.fetch_channel_playlists("epic_games")

    new_count = 0
    for pl_data in playlists:
        pl = pl_data["playlist"]
        videos = pl_data["videos"]

        for video in videos:
            if video.video_id in existing_ids:
                continue

            course = convert_to_course_format(video)
            course["playlist_id"] = pl["playlist_id"]
            course["playlist_title"] = pl["title"]
            library.setdefault("courses", []).append(course)
            existing_ids.add(video.video_id)
            new_count += 1

    if new_count > 0:
        with open(library_path, "w", encoding="utf-8") as f:
            json.dump(library, f, indent=2, ensure_ascii=False)
        print(f"   ✅ Added {new_count} new videos from playlists")
    else:
        print("   ✅ No new playlist videos to add")

    return new_count


def run_all(
    content_dir: Path,
    model_name: str = "medium",
    dry_run: bool = False,
    reset: bool = False,
    discover: bool = False,
):
    """Run all phases of the enrichment pipeline with checkpointing."""
    print("=" * 60)
    print("TAG ENRICHMENT PIPELINE")
    print("=" * 60)

    # Phase 8B: Load or reset state
    if reset:
        state = {
            "last_completed_phase": -1,
            "completed_courses": {},
            "started_at": datetime.now().isoformat(),
            "updated_at": None,
        }
        print("🔄 State reset — starting from scratch")
    else:
        state = load_state(content_dir)
        if state["last_completed_phase"] >= 0:
            print(f"📋 Resuming from after Phase {state['last_completed_phase']}")
            print(
                f"   {len(state.get('completed_courses', {}))} courses previously completed"
            )
        else:
            state["started_at"] = datetime.now().isoformat()

    # Load video library
    print("\n📂 Loading video library...")
    courses = load_video_library(content_dir)
    print(f"   Loaded {len(courses)} courses")

    # Phase 0: Load existing transcripts
    if state["last_completed_phase"] < 0:
        print("\n" + "-" * 40)
        transcripts = run_phase0(content_dir)
        state["last_completed_phase"] = 0
        save_state(content_dir, state)
        print("✅ Phase 0 checkpoint saved")
    else:
        print("\n⏭️ Skipping Phase 0 (already completed)")
        transcripts = run_phase0(content_dir)  # Still need data in memory

    # Phase 0.5: External Discovery (YouTube + Docs)
    if discover and state.get("last_completed_phase", -1) < 0.5:
        print("\n" + "-" * 40)
        new_external = run_external_discovery(content_dir)
        if new_external > 0:
            courses = load_video_library(content_dir)  # Reload with new entries
            print(f"   📂 Reloaded {len(courses)} courses (including new external)")
        state["last_completed_phase"] = 0.5
        save_state(content_dir, state)
        print("✅ Phase 0.5 checkpoint saved")
    elif discover:
        print("\n⏭️ Skipping Phase 0.5 (already completed)")

    # Phase 1: Filename keywords
    if state["last_completed_phase"] < 1:
        print("\n" + "-" * 40)
        filename_keywords = run_phase1(courses)
        state["last_completed_phase"] = 1
        save_state(content_dir, state)
        print("✅ Phase 1 checkpoint saved")
    else:
        print("⏭️ Skipping Phase 1 (already completed)")
        filename_keywords = run_phase1(courses)

    # Phase 2: Whisper transcription
    if state["last_completed_phase"] < 2:
        print("\n" + "-" * 40)
        progress_file = content_dir / "transcription_progress.json"
        all_transcripts = run_phase2(
            courses,
            transcripts,
            model_name=model_name,
            progress_file=progress_file,
        )
        state["last_completed_phase"] = 2
        save_state(content_dir, state)
        print("✅ Phase 2 checkpoint saved")
    else:
        print("⏭️ Skipping Phase 2 (already completed)")
        all_transcripts = transcripts  # Use existing

    # Phase 3: Tag extraction
    if state["last_completed_phase"] < 3:
        print("\n" + "-" * 40)
        tag_results = run_phase3(all_transcripts, filename_keywords)
        state["last_completed_phase"] = 3
        save_state(content_dir, state)
        print("✅ Phase 3 checkpoint saved")
    else:
        print("⏭️ Skipping Phase 3 (already completed)")
        tag_results = run_phase3(all_transcripts, filename_keywords)

    # Phase 4: Edge generation
    if state["last_completed_phase"] < 4:
        print("\n" + "-" * 40)
        edges = run_phase4(tag_results)
        state["last_completed_phase"] = 4
        save_state(content_dir, state)
        print("✅ Phase 4 checkpoint saved")
    else:
        print("⏭️ Skipping Phase 4 (already completed)")
        edges = run_phase4(tag_results)

    # Phase 5: Gemini batch (optional)
    if state["last_completed_phase"] < 5:
        print("\n" + "-" * 40)
        enriched = run_phase5(courses, tag_results, dry_run=dry_run)
        state["last_completed_phase"] = 5
        save_state(content_dir, state)
        print("✅ Phase 5 checkpoint saved")
    else:
        print("⏭️ Skipping Phase 5 (already completed)")
        enriched = {}

    # Merge API enrichment
    for code, extra_tags in enriched.items():
        if code in tag_results:
            tag_results[code]["ai_tags"].extend(extra_tags)

    # Save results
    print("\n" + "-" * 40)
    print("💾 Saving results...")
    save_enriched_library(courses, tag_results, edges, content_dir)

    # Copy to path-builder
    pb_data = content_dir.parent / "path-builder" / "src" / "data"
    if pb_data.exists():
        import shutil

        shutil.copy(
            content_dir / "video_library_enriched.json",
            pb_data / "video_library_enriched.json",
        )
        print(f"📋 Copied to: {pb_data}")

    # Mark pipeline complete
    state["last_completed_phase"] = 5
    state["pipeline_complete"] = True
    save_state(content_dir, state)

    print("\n" + "=" * 60)
    print("✅ PIPELINE COMPLETE")
    print(f"   State saved to: {content_dir / STATE_FILENAME}")
    print("=" * 60)


def run_youtube_discovery(content_dir: Path) -> int:
    """Discover new UE5 videos from Epic Games YouTube channel.

    Fetches videos, deduplicates against existing library, extracts
    chapter timestamps, fetches transcripts, and saves new courses.

    Args:
        content_dir: Path to content/ directory.

    Returns:
        Number of new courses added.
    """
    import sys
    sys.path.insert(0, str(content_dir.parent))

    from ingestion.youtube_fetcher import YouTubeFetcher, convert_to_course_format
    from ingestion.timestamp_extractor import TimestampExtractor

    print("\n" + "=" * 60)
    print("🎬 YOUTUBE DISCOVERY")
    print("=" * 60)

    # Load existing video library
    library_path = content_dir / "video_library.json"
    if library_path.exists():
        with open(library_path, encoding="utf-8") as f:
            library = json.load(f)
    else:
        library = {"courses": []}

    # Build set of existing YouTube video IDs (code field)
    existing_ids = {
        c.get("code", "") for c in library.get("courses", [])
    }
    # Also check youtube_url for older entries
    for c in library.get("courses", []):
        url = c.get("youtube_url", "") or c.get("path", "")
        if "youtube.com/watch?v=" in url:
            vid = url.split("v=")[-1].split("&")[0]
            existing_ids.add(vid)

    print(f"   📚 Existing library: {len(library.get('courses', []))} courses")
    print(f"   🔑 Known video IDs: {len(existing_ids)}")

    # Fetch videos from Epic Games channel
    print("\n   🔍 Fetching from Epic Games channel...")
    try:
        fetcher = YouTubeFetcher()
        videos = fetcher.fetch_channel_videos("epic_games", max_results=500)
    except Exception as e:
        print(f"   ⚠️  YouTube fetch failed: {e}")
        print("   → Ensure YOUTUBE_API_KEY is set in .env")
        return 0

    print(f"   📹 Found {len(videos)} videos from Epic Games")

    # Filter duplicates
    new_videos = [v for v in videos if v.video_id not in existing_ids]
    print(f"   ✨ {len(new_videos)} new videos (skipped {len(videos) - len(new_videos)} duplicates)")

    if not new_videos:
        print("   ✅ No new videos to add.")
        return 0

    # Convert to course format and extract chapters
    extractor = TimestampExtractor()
    new_courses = []

    for video in new_videos:
        course = convert_to_course_format(video)

        # Extract chapter segments from description
        segments = extractor.extract_chapters_as_segments(
            video.video_id, video.description
        )
        if segments:
            course["segments"] = segments
            print(f"   📑 {video.title[:50]}... ({len(segments)} chapters)")
        else:
            print(f"   📹 {video.title[:50]}... (no chapters)")

        new_courses.append(course)

    # Fetch transcripts
    print("\n   📝 Fetching transcripts...")
    new_ids = [v.video_id for v in new_videos]
    fetch_youtube_transcripts(content_dir, new_ids)

    # Append new courses to library
    library.setdefault("courses", []).extend(new_courses)

    # Save updated library
    with open(library_path, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    print(f"\n   ✅ Added {len(new_courses)} new YouTube courses to video_library.json")
    return len(new_courses)


# ---------------------------------------------------------------------------
# Topic inference from doc slug
# ---------------------------------------------------------------------------
SLUG_TOPIC_MAP = {
    "rendering": "Rendering",
    "lumen": "Rendering",
    "nanite": "Rendering",
    "niagara": "Rendering",
    "material": "Materials",
    "landscape": "Environment",
    "foliage": "Environment",
    "blueprint": "Blueprints",
    "scripting": "Blueprints",
    "c-plus-plus": "C++ Programming",
    "cpp": "C++ Programming",
    "programming": "C++ Programming",
    "animation": "Animation",
    "sequencer": "Animation",
    "physics": "Physics",
    "chaos": "Physics",
    "networking": "Multiplayer",
    "multiplayer": "Multiplayer",
    "replication": "Multiplayer",
    "audio": "Audio",
    "metasound": "Audio",
    "ui": "UI/UMG",
    "umg": "UI/UMG",
    "slate": "UI/UMG",
    "packaging": "Build & Deploy",
    "cooking": "Build & Deploy",
    "build": "Build & Deploy",
    "world-partition": "Level Design",
    "level": "Level Design",
    "pcg": "Level Design",
    "virtual-production": "Virtual Production",
    "gameplay": "Gameplay",
    "ai": "AI/Behavior Trees",
    "behavior-tree": "AI/Behavior Trees",
    "mass-entity": "AI/Behavior Trees",
    "performance": "Performance",
    "profiling": "Performance",
    "optimization": "Performance",
}


def infer_topic_from_slug(slug: str) -> str:
    """Infer a topic category from a doc slug."""
    slug_lower = slug.lower()
    for keyword, topic in SLUG_TOPIC_MAP.items():
        if keyword in slug_lower:
            return topic
    return "General"


def run_docs_ingestion(content_dir: Path) -> int:
    """Ingest Epic docs chunks as virtual courses into video_library.json.

    Loads scraped_docs.json (from prior scrape_epic_docs.py run),
    converts each doc chunk into a virtual course with source='epic_docs',
    deduplicates against existing library, and appends new entries.

    Args:
        content_dir: Path to content/ directory.

    Returns:
        Number of new doc courses added.
    """
    print("\n" + "=" * 60)
    print("📖 EPIC DOCS INGESTION")
    print("=" * 60)

    scraped_path = content_dir / "scraped_docs.json"

    if not scraped_path.exists():
        print("   ⚠️  No scraped_docs.json found.")
        print("   → Run: python scripts/scrape_epic_docs.py --scrape-only")
        return 0

    # Load scraped docs
    with open(scraped_path, encoding="utf-8") as f:
        docs = json.load(f)

    total_chunks = sum(d.get("chunk_count", 0) for d in docs)
    print(f"   📚 Loaded {len(docs)} docs with {total_chunks} chunks")

    # Load existing library
    library_path = content_dir / "video_library.json"
    if library_path.exists():
        with open(library_path, encoding="utf-8") as f:
            library = json.load(f)
    else:
        library = {"courses": []}

    existing_codes = {c.get("code", "") for c in library.get("courses", [])}
    print(f"   📋 Existing library: {len(library.get('courses', []))} courses")

    # Convert doc chunks to virtual courses
    new_courses = []
    for doc in docs:
        slug = doc.get("slug", "")
        doc_url = doc.get("url", "")
        doc_title = doc.get("title", slug)
        topic = infer_topic_from_slug(slug)

        for idx, chunk in enumerate(doc.get("chunks", [])):
            code = f"doc_{slug}_{idx:03d}"

            if code in existing_codes:
                continue  # Already in library

            section = chunk.get("section", slug)
            text = chunk.get("text", "")

            course = {
                "code": code,
                "title": f"{doc_title} — {section}" if section != slug else doc_title,
                "source": "epic_docs",
                "url": doc_url,
                "description": text[:500],
                "duration_minutes": max(1, chunk.get("token_estimate", 200) // 200),
                "tags": {
                    "topic": topic,
                },
                "doc_meta": {
                    "slug": slug,
                    "section": section,
                    "chunk_index": idx,
                    "token_estimate": chunk.get("token_estimate", 0),
                },
            }
            new_courses.append(course)

    print(f"   ✨ {len(new_courses)} new doc courses "
          f"(skipped {total_chunks - len(new_courses)} duplicates)")

    if not new_courses:
        print("   ✅ No new docs to add.")
        return 0

    # Append to library
    library.setdefault("courses", []).extend(new_courses)

    with open(library_path, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)

    print(f"   ✅ Added {len(new_courses)} doc courses to video_library.json")
    return len(new_courses)


def main():
    parser = argparse.ArgumentParser(description="Tag Enrichment Pipeline")
    parser.add_argument("--all", action="store_true", help="Run all phases")
    parser.add_argument(
        "--phase",
        type=int,
        choices=[0, 1, 2, 3, 4, 5],
        help="Run specific phase",
    )
    parser.add_argument(
        "--model",
        default="medium",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without making changes",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset pipeline state and start from scratch",
    )
    parser.add_argument(
        "--fetch-youtube",
        action="store_true",
        help="Run YouTube discovery before the pipeline",
    )
    parser.add_argument(
        "--docs",
        action="store_true",
        help="Ingest Epic docs as virtual courses before the pipeline",
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Run Phase 0.5: full external discovery (YouTube + playlists + docs)",
    )

    args = parser.parse_args()

    # Find content directory
    script_dir = Path(__file__).parent
    content_dir = script_dir.parent.parent / "content"

    if not content_dir.exists():
        print(f"❌ Content directory not found: {content_dir}")
        return

    # Run docs ingestion if requested
    if args.docs:
        run_docs_ingestion(content_dir)

    # Run YouTube discovery if requested
    if args.fetch_youtube:
        run_youtube_discovery(content_dir)

    # Run external discovery if requested standalone
    if args.discover and not args.all:
        run_external_discovery(content_dir)

    if args.all:
        run_all(
            content_dir,
            model_name=args.model,
            dry_run=args.dry_run,
            reset=args.reset,
            discover=args.discover,
        )
    elif args.phase is not None:
        # Run individual phase
        print(f"Running Phase {args.phase}...")

        if args.phase == 0:
            run_phase0(content_dir)
        elif args.phase == 1:
            courses = load_video_library(content_dir)
            run_phase1(courses)
        elif args.phase == 2:
            courses = load_video_library(content_dir)
            transcripts = run_phase0(content_dir)
            run_phase2(courses, transcripts, model_name=args.model)
        # ... additional phases
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
