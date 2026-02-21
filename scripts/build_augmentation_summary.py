"""
Build Augmentation Summary — aggregates all augmentation results into one file.
================================================================================
Reads all JSON files from prompts/augmentation_results/ and outputs a single
prototype/augmentation_summary.json with per-video stats and overall aggregates.

Usage:
    python scripts/build_augmentation_summary.py
"""
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = REPO_ROOT / "prompts" / "augmentation_results"
OUTPUT_FILE = REPO_ROOT / "prototype" / "augmentation_summary.json"
LIBRARY_FILE = REPO_ROOT / "content" / "video_library.json"

# Videos that are not real instructional content — filter from aggregates
SKIP_PATTERNS = [
    "introduction", "intro", "outro", "recap", "thank you", "thankyou",
    "wrap up", "wrapup", "exercise", "course outline", "courseoutline",
    "overview",
]


def is_filler_video(title: str) -> bool:
    """Return True if this video is non-instructional filler."""
    t = title.lower().replace("_", " ").replace("-", " ").strip()
    # Strip leading numbers like "01 "
    import re
    t = re.sub(r"^\d+\s*", "", t).strip()
    return any(t == p or t.startswith(p + " ") or t.endswith(" " + p) or t == p.replace(" ", "")
               for p in SKIP_PATTERNS)


def main():
    videos = []
    totals = {
        "total_score": 0,
        "total_procedural": 0,
        "total_conceptual": 0,
        "grade_counts": {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0},
        "verdict_counts": {"NEEDS_AUGMENTATION": 0, "ADEQUATE": 0, "STRONG": 0},
        "total_theory_breaks": 0,
        "total_why_annotations": 0,
        "total_prompts": 0,
        "total_warnings": 0,
        "total_prereqs": 0,
    }

    # Track per-criteria scores for averages
    CRITERIA_KEYS = [
        "concept_clarification", "misconception_addressing", "narrative_logic",
        "content_first_language", "dynamic_visualizations", "explicit_signaling",
        "strict_segmentation", "extraneous_load_reduction", "worked_example_fading",
        "self_explanation_prompting", "affective_tone"
    ]
    criteria_totals = {k: 0 for k in CRITERIA_KEYS}
    skipped = 0

    # Load course titles from video_library.json
    course_titles = {}
    try:
        lib = json.loads(LIBRARY_FILE.read_text(encoding="utf-8"))
        for c in lib.get("courses", []):
            code = c.get("code", "")
            title = c.get("title", "")
            if code and title:
                course_titles[code] = title
        print(f"Loaded {len(course_titles)} course titles")
    except Exception as e:
        print(f"Warning: Could not load course titles: {e}")

    for course_dir in sorted(RESULTS_DIR.iterdir()):
        if not course_dir.is_dir():
            continue
        course_code = course_dir.name

        for json_file in sorted(course_dir.glob("*.json")):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue

            score = data.get("evaluation_matrix_score", {})
            cs = data.get("conceptual_score", {})

            n_theory = len(data.get("theory_breaks", []))
            n_why = len(data.get("why_annotations", []))
            n_prompts = len(data.get("self_explanation_prompts", []))
            n_warnings = len(data.get("architectural_warnings", []))
            n_prereqs = len(data.get("missing_prerequisites", []))
            n_quiz = len(data.get("quiz_questions", []))

            grade = score.get("grade", "?")
            total = score.get("total", 0)
            verdict = cs.get("verdict", "")

            video_key = f"{course_code}/{json_file.stem}"
            video_title = json_file.stem.replace("_", " ").lstrip("0123456789 ")
            course_code_dotted = course_code.replace("_", ".")
            course_title = course_titles.get(course_code_dotted, "")

            # Skip filler videos (intro, outro, recap, etc.)
            if is_filler_video(json_file.stem):
                skipped += 1
                continue

            videos.append({
                "key": video_key,
                "course": course_code_dotted,
                "course_title": course_title,
                "title": video_title,
                "grade": grade,
                "score": total,
                "verdict": verdict,
                "procedural_pct": cs.get("procedural_pct", 0),
                "conceptual_pct": cs.get("conceptual_pct", 0),
                "theory_breaks": n_theory,
                "why_annotations": n_why,
                "prompts": n_prompts,
                "warnings": n_warnings,
                "prereqs": n_prereqs,
                "quiz_questions": n_quiz,
            })

            # Accumulate totals
            totals["total_score"] += total
            totals["total_procedural"] += cs.get("procedural_pct", 0)
            totals["total_conceptual"] += cs.get("conceptual_pct", 0)
            if grade in totals["grade_counts"]:
                totals["grade_counts"][grade] += 1
            if verdict in totals["verdict_counts"]:
                totals["verdict_counts"][verdict] += 1
            totals["total_theory_breaks"] += n_theory
            totals["total_why_annotations"] += n_why
            totals["total_prompts"] += n_prompts
            totals["total_warnings"] += n_warnings
            totals["total_prereqs"] += n_prereqs

            # Accumulate per-criteria scores
            for ck in CRITERIA_KEYS:
                criteria_totals[ck] += score.get(ck, 0)

    n = len(videos) or 1

    summary = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "total_videos": len(videos),
        "overall": {
            "avg_score": round(totals["total_score"] / n, 1),
            "avg_procedural_pct": round(totals["total_procedural"] / n, 1),
            "avg_conceptual_pct": round(totals["total_conceptual"] / n, 1),
            "grade_distribution": totals["grade_counts"],
            "verdict_distribution": totals["verdict_counts"],
            "total_theory_breaks": totals["total_theory_breaks"],
            "total_why_annotations": totals["total_why_annotations"],
            "total_prompts": totals["total_prompts"],
            "total_warnings": totals["total_warnings"],
            "total_prereqs": totals["total_prereqs"],
            "criteria_averages": {k: round(v / n, 2) for k, v in criteria_totals.items()},
        },
        "skipped_filler": skipped,
        "course_titles": course_titles,
        "videos": videos,
    }

    OUTPUT_FILE.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"✓ Built summary with {len(videos)} videos → {OUTPUT_FILE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
