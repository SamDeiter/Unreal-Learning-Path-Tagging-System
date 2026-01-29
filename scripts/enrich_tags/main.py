"""Tag Enrichment Pipeline - Main Entry Point.

CLI for running the full 6-phase tag enrichment pipeline.

Usage:
    python -m scripts.enrich_tags.main --all
    python -m scripts.enrich_tags.main --phase 0
    python -m scripts.enrich_tags.main --phase 2 --model medium
"""

import argparse
import json
from pathlib import Path

from .phase0_existing import run_phase0
from .phase1_filenames import run_phase1
from .phase2_whisper import run_phase2
from .phase3_normalize import run_phase3
from .phase4_edges import run_phase4
from .phase5_gemini import run_phase5


def load_video_library(content_dir: Path) -> list[dict]:
    """Load courses from video_library.json."""
    lib_path = content_dir / "video_library.json"
    if not lib_path.exists():
        print(f"❌ Video library not found: {lib_path}")
        return []
    
    data = json.loads(lib_path.read_text(encoding='utf-8'))
    return data.get('courses', [])


def save_enriched_library(
    courses: list[dict],
    tag_results: dict[str, dict],
    edges: list[dict],
    output_dir: Path,
):
    """Save enriched video library and edges."""
    # Update courses with tag results
    for course in courses:
        code = course.get('code')
        if code and code in tag_results:
            result = tag_results[code]
            course['ai_tags'] = result.get('ai_tags', [])
            course['canonical_tags'] = result.get('canonical_tags', [])
            course['has_cc'] = True  # Will be set by transcription
    
    # Save enriched library
    output = {
        "generated_at": __import__('datetime').datetime.now().isoformat(),
        "courses": courses,
    }
    
    enriched_path = output_dir / "video_library_enriched.json"
    enriched_path.write_text(json.dumps(output, indent=2), encoding='utf-8')
    print(f"💾 Saved: {enriched_path}")
    
    # Save edges
    edges_path = output_dir / "generated_edges.json"
    edges_path.write_text(json.dumps(edges, indent=2), encoding='utf-8')
    print(f"💾 Saved: {edges_path}")


def run_all(
    content_dir: Path,
    model_name: str = "medium",
    dry_run: bool = False,
):
    """Run all phases of the enrichment pipeline."""
    print("=" * 60)
    print("TAG ENRICHMENT PIPELINE")
    print("=" * 60)
    
    # Load video library
    print("\n📂 Loading video library...")
    courses = load_video_library(content_dir)
    print(f"   Loaded {len(courses)} courses")
    
    # Phase 0: Load existing transcripts
    print("\n" + "-" * 40)
    transcripts = run_phase0(content_dir)
    
    # Phase 1: Filename keywords
    print("\n" + "-" * 40)
    filename_keywords = run_phase1(courses)
    
    # Phase 2: Whisper transcription
    print("\n" + "-" * 40)
    progress_file = content_dir / "transcription_progress.json"
    all_transcripts = run_phase2(
        courses,
        transcripts,
        model_name=model_name,
        progress_file=progress_file,
    )
    
    # Phase 3: Tag extraction
    print("\n" + "-" * 40)
    tag_results = run_phase3(all_transcripts, filename_keywords)
    
    # Phase 4: Edge generation
    print("\n" + "-" * 40)
    edges = run_phase4(tag_results)
    
    # Phase 5: Gemini batch (optional)
    print("\n" + "-" * 40)
    enriched = run_phase5(courses, tag_results, dry_run=dry_run)
    
    # Merge API enrichment
    for code, extra_tags in enriched.items():
        if code in tag_results:
            tag_results[code]['ai_tags'].extend(extra_tags)
    
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
            pb_data / "video_library_enriched.json"
        )
        print(f"📋 Copied to: {pb_data}")
    
    print("\n" + "=" * 60)
    print("✅ PIPELINE COMPLETE")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Tag Enrichment Pipeline")
    parser.add_argument('--all', action='store_true', help='Run all phases')
    parser.add_argument('--phase', type=int, choices=[0, 1, 2, 3, 4, 5], 
                       help='Run specific phase')
    parser.add_argument('--model', default='medium', 
                       choices=['tiny', 'base', 'small', 'medium', 'large'],
                       help='Whisper model size')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview without making changes')
    
    args = parser.parse_args()
    
    # Find content directory
    script_dir = Path(__file__).parent
    content_dir = script_dir.parent.parent / "content"
    
    if not content_dir.exists():
        print(f"❌ Content directory not found: {content_dir}")
        return
    
    if args.all:
        run_all(content_dir, model_name=args.model, dry_run=args.dry_run)
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
