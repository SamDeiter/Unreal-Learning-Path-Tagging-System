"""Add Missing VTT Caption Files.

Scans all courses and adds VTT caption files to folders that don't have them.
Converts SRT to VTT if SRT exists, or reports missing for transcription phase.

Usage:
    python -m scripts.enrich_tags.add_missing_vtt
    python -m scripts.enrich_tags.add_missing_vtt --convert-only
    python -m scripts.enrich_tags.add_missing_vtt --report
"""

import json
from pathlib import Path


def srt_to_vtt(srt_content: str) -> str:
    """Convert SRT format to VTT format.

    Args:
        srt_content: SRT subtitle content string.

    Returns:
        VTT formatted string.
    """
    # Add VTT header
    vtt_lines = ["WEBVTT", ""]

    # Convert SRT timestamps (00:00:00,000) to VTT (00:00:00.000)
    lines = srt_content.split('\n')

    for line in lines:
        # Convert timestamp separator from comma to dot
        if '-->' in line:
            line = line.replace(',', '.')
        vtt_lines.append(line)

    return '\n'.join(vtt_lines)


def get_existing_vtt_courses(transcript_dir: Path) -> set[str]:
    """Get set of course codes that already have VTT files.

    Args:
        transcript_dir: Path to content/transcripts directory.

    Returns:
        Set of course codes (e.g., '100.01', '105.02').
    """
    existing = set()

    if not transcript_dir.exists():
        return existing

    for course_dir in transcript_dir.iterdir():
        if not course_dir.is_dir():
            continue

        # Check if has VTT files
        vtt_files = list(course_dir.glob("*.vtt"))
        if vtt_files:
            # Convert folder format (100_01) to course code (100.01)
            code = course_dir.name.replace("_", ".")
            existing.add(code)

    return existing


def find_srt_files(course: dict) -> list[Path]:
    """Find all SRT files in a course's CC folder.

    Args:
        course: Course dictionary with 'path' field.

    Returns:
        List of SRT file paths.
    """
    course_path = Path(course.get('path', ''))
    srt_files = []

    if not course_path.exists():
        return srt_files

    # Check CC folder in each version directory
    for version_dir in course_path.iterdir():
        if not version_dir.is_dir():
            continue

        cc_dir = version_dir / "CC"
        if cc_dir.exists():
            srt_files.extend(cc_dir.glob("*.srt"))

        # Also check version/FINAL/CC
        final_cc = version_dir / "FINAL" / "CC"
        if final_cc.exists():
            srt_files.extend(final_cc.glob("*.srt"))

    # Also check root CC folder
    root_cc = course_path / "CC"
    if root_cc.exists():
        srt_files.extend(root_cc.glob("*.srt"))

    return list(set(srt_files))


def convert_course_srts(course: dict, output_dir: Path) -> tuple[int, list[Path]]:
    """Convert all SRT files for a course to VTT format.

    Args:
        course: Course dictionary.
        output_dir: Directory to save VTT files.

    Returns:
        Tuple of (count converted, list of VTT paths).
    """
    code = course.get('code', 'unknown')
    srt_files = find_srt_files(course)

    if not srt_files:
        return 0, []

    # Create output folder using underscore format
    folder_name = code.replace(".", "_")
    course_vtt_dir = output_dir / folder_name
    course_vtt_dir.mkdir(parents=True, exist_ok=True)

    vtt_paths = []

    for srt_path in srt_files:
        try:
            srt_content = srt_path.read_text(encoding='utf-8', errors='ignore')
            vtt_content = srt_to_vtt(srt_content)

            # Save as VTT with same base name
            vtt_filename = srt_path.stem + ".vtt"
            vtt_path = course_vtt_dir / vtt_filename
            vtt_path.write_text(vtt_content, encoding='utf-8')

            vtt_paths.append(vtt_path)
        except Exception as e:
            print(f"      ❌ Failed to convert {srt_path.name}: {e}")

    return len(vtt_paths), vtt_paths


def run_add_missing_vtt(
    content_dir: Path,
    convert_only: bool = False,
    report_only: bool = False,
) -> dict:
    """Add VTT files to courses that are missing them.

    Args:
        content_dir: Path to content/ directory.
        convert_only: Only convert existing SRTs, don't report missing.
        report_only: Only report status, don't convert.

    Returns:
        Dictionary with summary statistics.
    """
    print("=" * 60)
    print("ADD MISSING VTT CAPTION FILES")
    print("=" * 60)

    # Load video library
    lib_path = content_dir / "video_library.json"
    if not lib_path.exists():
        print(f"❌ Video library not found: {lib_path}")
        return {}

    data = json.loads(lib_path.read_text(encoding='utf-8'))
    courses = data.get('courses', [])
    print(f"\n📂 Loaded {len(courses)} courses")

    # Get existing VTT courses
    transcript_dir = content_dir / "transcripts"
    existing = get_existing_vtt_courses(transcript_dir)
    print(f"✅ {len(existing)} courses already have VTT files")

    # Find missing courses
    missing_courses = []
    for course in courses:
        code = course.get('code')
        if code and code not in existing:
            missing_courses.append(course)

    print(f"⚠️  {len(missing_courses)} courses are missing VTT files")

    if report_only:
        print("\n--- MISSING VTT COURSES ---")
        for course in missing_courses:
            code = course.get('code')
            title = course.get('title', '')[:40]
            course.get('video_count', 0)
            srts = find_srt_files(course)
            srt_status = f"({len(srts)} SRTs)" if srts else "(no SRTs)"
            print(f"   {code}: {title}... {srt_status}")

        return {
            "total_courses": len(courses),
            "have_vtt": len(existing),
            "missing_vtt": len(missing_courses),
        }

    # Convert SRTs to VTT for missing courses
    converted_count = 0
    no_srt_courses = []

    print("\n--- CONVERTING SRT TO VTT ---")

    for course in missing_courses:
        code = course.get('code')
        title = course.get('title', '')[:40]

        count, vtt_paths = convert_course_srts(course, transcript_dir)

        if count > 0:
            print(f"   ✅ {code}: Converted {count} files")
            converted_count += count
        else:
            no_srt_courses.append(course)
            if not convert_only:
                print(f"   ⚠️  {code}: No SRT files found")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"   Total courses: {len(courses)}")
    print(f"   Already had VTT: {len(existing)}")
    print(f"   Converted SRT→VTT: {converted_count}")
    print(f"   Need transcription: {len(no_srt_courses)}")

    if no_srt_courses and not convert_only:
        print("\n--- COURSES STILL NEEDING TRANSCRIPTION ---")
        for course in no_srt_courses[:20]:
            code = course.get('code')
            title = course.get('title', '')[:50]
            print(f"   {code}: {title}")
        if len(no_srt_courses) > 20:
            print(f"   ... and {len(no_srt_courses) - 20} more")

    return {
        "total_courses": len(courses),
        "have_vtt": len(existing),
        "converted": converted_count,
        "need_transcription": len(no_srt_courses),
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Add missing VTT caption files")
    parser.add_argument('--convert-only', action='store_true',
                       help='Only convert existing SRTs, no reporting')
    parser.add_argument('--report', action='store_true',
                       help='Only report status without converting')

    args = parser.parse_args()

    # Find content directory
    script_dir = Path(__file__).parent
    content_dir = script_dir.parent.parent / "content"

    if not content_dir.exists():
        print(f"❌ Content directory not found: {content_dir}")
        return

    run_add_missing_vtt(
        content_dir,
        convert_only=args.convert_only,
        report_only=args.report,
    )


if __name__ == "__main__":
    main()
