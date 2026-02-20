"""
Conceptual Augmentation Script — Pillar 5
==========================================
Takes a raw VTT transcript, feeds it through the Conceptual Augmentation
Prompt (via Gemini), and produces a structured JSON augmentation report.

Usage:
    python augment_transcript.py --course 100.01
    python augment_transcript.py --course 100.01 --video 18_BlueprintEditor
    python augment_transcript.py --all --limit 5

Output: prompts/augmentation_results/<course_code>/<video_key>.json
"""

import argparse
import json
import os
import re
import time
from pathlib import Path

# Load .env file (matches the existing JS scripts' dotenv pattern)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass  # dotenv not installed, rely on shell environment

# ---------------------------------------------------------------------------
#  Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPTS_DIR = REPO_ROOT / "content" / "transcripts"
VIDEO_LIBRARY = REPO_ROOT / "content" / "video_library_enriched.json"
OUTPUT_DIR = REPO_ROOT / "prompts" / "augmentation_results"
PROMPT_FILE = REPO_ROOT / "prompts" / "conceptual_augmentation_prompt.md"

# ---------------------------------------------------------------------------
#  Config
# ---------------------------------------------------------------------------
DELAY_BETWEEN_CALLS = 3  # seconds
MAX_TRANSCRIPT_CHARS = 60_000
SEGMENT_SECONDS = 30


# ---------------------------------------------------------------------------
#  VTT Parsing (mirrors build_transcript_index.py)
# ---------------------------------------------------------------------------
def parse_vtt_timestamp(ts: str) -> float:
    parts = ts.strip().split(":")
    if len(parts) == 3:
        h, m, s = parts
    elif len(parts) == 2:
        h = "0"
        m, s = parts
    else:
        return 0.0
    s = s.replace(",", ".")
    return int(h) * 3600 + int(m) * 60 + float(s)


def format_ts(seconds: float) -> str:
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"


def parse_vtt(filepath: Path) -> list[dict]:
    """Return list of {start, end, text} cues."""
    content = filepath.read_text(encoding="utf-8")
    content = re.sub(r"^WEBVTT\s*\n", "", content.strip())
    blocks = re.split(r"\n\s*\n", content.strip())
    cues = []
    for block in blocks:
        lines = block.strip().split("\n")
        ts_line = None
        text_lines = []
        for line in lines:
            if "-->" in line:
                ts_line = line
            elif ts_line is not None:
                text_lines.append(line.strip())
        if not ts_line or not text_lines:
            continue
        m = re.match(r"([\d:.,]+)\s*-->\s*([\d:.,]+)", ts_line)
        if not m:
            continue
        start = parse_vtt_timestamp(m.group(1))
        end = parse_vtt_timestamp(m.group(2))
        text = " ".join(text_lines).strip()
        if text:
            cues.append({"start": start, "end": end, "text": text})
    return cues


def cues_to_timestamped_text(cues: list[dict]) -> str:
    """Produce a readable timestamped transcript string."""
    lines = []
    for cue in cues:
        ts = format_ts(cue["start"])
        lines.append(f"[{ts}] {cue['text']}")
    return "\n".join(lines)


def extract_video_key(filename: str) -> str:
    name = Path(filename).stem
    name = re.sub(r"^\d+\.\d+_", "", name)
    name = re.sub(r"_\d+$", "", name)
    name = re.sub(r"_NEW$", "", name)
    return name


# ---------------------------------------------------------------------------
#  Course Metadata Lookup
# ---------------------------------------------------------------------------
def load_library_metadata() -> dict:
    """Load enriched library to get course titles, tags, levels."""
    if not VIDEO_LIBRARY.exists():
        return {}
    lib = json.loads(VIDEO_LIBRARY.read_text(encoding="utf-8"))
    lookup = {}
    for course in lib.get("courses", []):
        code = course.get("code", "")
        lookup[code] = {
            "title": course.get("title", "Unknown"),
            "level": course.get("tags", {}).get("level", "Unknown"),
            "tags": ", ".join(
                course.get("canonical_tags", [])
                + course.get("ai_tags", [])[:5]
            ),
        }
    return lookup


# ---------------------------------------------------------------------------
#  Gemini API Call
# ---------------------------------------------------------------------------
def call_gemini(system_prompt: str, user_prompt: str) -> dict | None:
    """Call Gemini 2.0 Flash and return parsed JSON."""
    try:
        import google.generativeai as genai
    except ImportError:
        print("ERROR: pip install google-generativeai")
        return None

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set in environment")
        return None

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        "gemini-2.0-flash",
        system_instruction=system_prompt,
    )

    try:
        response = model.generate_content(
            user_prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                max_output_tokens=8192,
                temperature=0.3,
            ),
        )
        text = response.text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        return json.loads(text)
    except Exception as e:
        print(f"  Gemini error: {e}")
        return None


# ---------------------------------------------------------------------------
#  Build Prompts
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a Senior Unreal Engine 5 Curriculum Architect specializing in instructional design and cognitive load management. Your role is to analyze raw video transcripts and produce a Conceptual Augmentation Layer — the missing pedagogical context that transforms passive "follow-along" content into deep-learning material.

You adhere to these principles:
1. 80/20 Conceptual Rule: 80% of your output must explain WHY, not HOW.
2. Cognitive Load Theory: Manage intrinsic, extraneous, and germane load deliberately.
3. UE5 Purity: Reference only Unreal Engine 5 systems. Never mention Unity, Godot, or generic game dev concepts.
4. Antipattern Awareness: Actively flag the Top 4 architectural antipatterns (Hard-Reference Casting, Physics Constraint Stretching, NavMesh Coordinate Failures, Lumen Ghosting) whenever the transcript touches them.
5. Concise & Scannable: Minimize filler. Every sentence must deliver technical or conceptual value.
6. Return ONLY valid JSON. No markdown, no explanation outside the JSON."""


def build_user_prompt(
    course_title: str,
    course_code: str,
    skill_level: str,
    tags: str,
    transcript_text: str,
) -> str:
    return f"""COURSE: {course_title}
COURSE CODE: {course_code}
SKILL LEVEL: {skill_level}
TAGS: {tags}

TRANSCRIPT:
---
{transcript_text[:MAX_TRANSCRIPT_CHARS]}
---

Analyze this transcript and produce a Conceptual Augmentation Report as JSON with these keys:

- "course_code": string
- "conceptual_score": {{"procedural_pct": int, "conceptual_pct": int, "verdict": "NEEDS_AUGMENTATION|ADEQUATE|STRONG"}}
- "theory_breaks": array of {{"insert_after_timestamp": "M:SS", "title": str, "concept": str, "diagram_suggestion": str}}
- "why_annotations": array of {{"timestamp": "M:SS", "procedural_step": str, "why": str, "antipattern_warning": str or null}}
- "self_explanation_prompts": array of {{"insert_after_timestamp": "M:SS", "prompt": str, "expected_insight": str}}
- "architectural_warnings": array of {{"timestamp": "M:SS", "warning": str, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "fix": str}}
- "missing_prerequisites": array of strings
- "quiz_questions": array of {{"question": str, "options": [str,str,str,str], "correct_index": 0-3, "explanation": str}}
- "evaluation_matrix_score": {{"concept_clarification": 1-5, "misconception_addressing": 1-5, "narrative_logic": 1-5, "content_first_language": 1-5, "dynamic_visualizations": 1-5, "explicit_signaling": 1-5, "strict_segmentation": 1-5, "extraneous_load_reduction": 1-5, "worked_example_fading": 1-5, "self_explanation_prompting": 1-5, "affective_tone": 1-5, "total": 11-55, "grade": "F|D|C|B|A"}}

RULES:
- theory_breaks must reference specific UE5 subsystems
- why_annotations must explain ENGINE-LEVEL consequences
- self_explanation_prompts must create a curiosity gap
- architectural_warnings must cite memory/perf/scalability impact
- Grade thresholds: F(11-21), D(22-32), C(33-38), B(39-44), A(45-55)
- Generate exactly 5 quiz_questions per video
- Quiz questions must test CONCEPTS (why/how the engine works), not RECALL (what button was clicked)
- Each question must have exactly 4 options; vary the correct_index across questions
- Quiz explanations should reference the conceptual lesson"""


# ---------------------------------------------------------------------------
#  Main Pipeline
# ---------------------------------------------------------------------------
def process_video(
    course_dir: Path,
    vtt_file: Path,
    metadata: dict,
    course_code: str,
    skip_existing: bool = False,
) -> dict | None:
    """Process a single VTT file through the augmentation pipeline."""
    video_key = extract_video_key(vtt_file.name)

    # Check if output already exists
    out_dir = OUTPUT_DIR / course_code.replace(".", "_")
    out_file = out_dir / f"{video_key}.json"
    if skip_existing and out_file.exists():
        print(f"  Skipping (already exists): {video_key}")
        return None

    print(f"  Processing: {video_key}")

    # Parse transcript
    cues = parse_vtt(vtt_file)
    if not cues:
        print(f"    Skipping (no cues)")
        return None

    transcript_text = cues_to_timestamped_text(cues)
    meta = metadata.get(course_code, {})

    # Build prompt
    user_prompt = build_user_prompt(
        course_title=meta.get("title", course_code),
        course_code=course_code,
        skill_level=meta.get("level", "Unknown"),
        tags=meta.get("tags", ""),
        transcript_text=transcript_text,
    )

    # Call Gemini
    result = call_gemini(SYSTEM_PROMPT, user_prompt)
    if not result:
        return None

    # Save result
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"    ✓ Saved: {out_file.relative_to(REPO_ROOT)}")

    return result


def process_course(course_code: str, metadata: dict, video_filter: str = None, skip_existing: bool = False):
    """Process all VTTs in a course directory."""
    dir_name = course_code.replace(".", "_")
    course_dir = TRANSCRIPTS_DIR / dir_name

    if not course_dir.exists():
        print(f"  Course directory not found: {course_dir}")
        return

    vtt_files = sorted(course_dir.glob("*.vtt"))
    print(f"  Found {len(vtt_files)} VTT files in {dir_name}")

    for vtt_file in vtt_files:
        video_key = extract_video_key(vtt_file.name)

        # Skip _NEW duplicates
        if "_NEW" in vtt_file.stem and not video_filter:
            continue

        # Filter to specific video if requested
        if video_filter and video_filter not in video_key:
            continue

        result = process_video(course_dir, vtt_file, metadata, course_code, skip_existing)
        time.sleep(DELAY_BETWEEN_CALLS)


def main():
    parser = argparse.ArgumentParser(
        description="Conceptual Augmentation Pipeline for UE5 Transcripts"
    )
    parser.add_argument(
        "--course",
        help="Course code to process (e.g., 100.01)",
    )
    parser.add_argument(
        "--video",
        help="Filter to a specific video key (e.g., 18_BlueprintEditor)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all courses",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of courses to process (with --all)",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip videos that already have augmentation output",
    )
    args = parser.parse_args()

    if not args.course and not args.all:
        parser.print_help()
        return

    print("=" * 60)
    print("CONCEPTUAL AUGMENTATION PIPELINE")
    print("=" * 60)

    # Load metadata
    metadata = load_library_metadata()
    print(f"Loaded metadata for {len(metadata)} courses")

    if args.course:
        print(f"\nProcessing course: {args.course}")
        process_course(args.course, metadata, args.video, args.skip_existing)
    elif args.all:
        course_dirs = sorted(
            d for d in TRANSCRIPTS_DIR.iterdir() if d.is_dir()
        )
        if args.limit:
            course_dirs = course_dirs[: args.limit]
        print(f"\nProcessing {len(course_dirs)} courses")
        for course_dir in course_dirs:
            course_code = course_dir.name.replace("_", ".")
            print(f"\n--- {course_code} ---")
            process_course(course_code, metadata, skip_existing=args.skip_existing)

    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()
