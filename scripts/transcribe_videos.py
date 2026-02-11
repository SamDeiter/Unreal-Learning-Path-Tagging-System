"""Video Transcription Script using Whisper.

Transcribes video files from courses that don't have existing VTT transcripts.
Saves transcripts as VTT files in a local transcripts folder.
"""

import json
import os
from pathlib import Path

import whisper

# Configuration
WHISPER_MODEL = "small"  # Options: tiny, base, small, medium, large
OUTPUT_DIR = Path(__file__).parent.parent / "content" / "transcripts"
VIDEO_LIBRARY = Path(__file__).parent.parent / "content" / "video_library.json"

# Video extensions to process
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}


def load_video_library():
    """Load the video library JSON."""
    with open(VIDEO_LIBRARY, encoding='utf-8') as f:
        return json.load(f)


def find_courses_without_transcripts(library):
    """Find courses that have videos but no transcripts."""
    courses_to_process = []

    for course in library['courses']:
        # Check if course has videos
        if not course.get('videos') or len(course.get('videos', [])) == 0:
            continue

        # Check if already has AI tags (meaning it had transcripts)
        if course.get('has_ai_tags'):
            continue

        courses_to_process.append(course)

    return courses_to_process


def format_timestamp(seconds):
    """Convert seconds to VTT timestamp format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def transcribe_video(video_path, model):
    """Transcribe a video file using Whisper."""
    print(f"    Transcribing: {os.path.basename(video_path)}")

    try:
        result = model.transcribe(str(video_path), language="en")
        return result
    except Exception as e:
        print(f"    Error transcribing: {e}")
        return None


def save_as_vtt(result, output_path):
    """Save Whisper result as VTT file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("WEBVTT\n\n")

        for i, segment in enumerate(result.get('segments', [])):
            start = format_timestamp(segment['start'])
            end = format_timestamp(segment['end'])
            text = segment['text'].strip()

            f.write(f"{i + 1}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{text}\n\n")

    return output_path


def process_course(course, model, output_dir):
    """Process all videos in a course."""
    course_code = course.get('code', 'unknown')
    course_title = course.get('title', 'Unknown')
    videos = course.get('videos', [])

    print(f"\n  Processing: {course_code} - {course_title}")
    print(f"  Videos to transcribe: {len(videos)}")

    # Create course transcript folder
    course_folder = output_dir / course_code.replace('.', '_')
    os.makedirs(course_folder, exist_ok=True)

    transcripts_created = 0

    for video in videos:
        video_path = video.get('path')
        if not video_path or not os.path.exists(video_path):
            print(f"    Skipping (not found): {video.get('name')}")
            continue

        video_name = os.path.splitext(video.get('name', 'video'))[0]
        vtt_path = course_folder / f"{video_name}.vtt"

        # Skip if already transcribed
        if vtt_path.exists():
            print(f"    Already exists: {video_name}.vtt")
            continue

        # Transcribe
        result = transcribe_video(video_path, model)

        if result:
            save_as_vtt(result, vtt_path)
            transcripts_created += 1
            print(f"    ✓ Saved: {video_name}.vtt")

    return transcripts_created


def main():
    print("=" * 60)
    print("VIDEO TRANSCRIPTION WITH WHISPER")
    print("=" * 60)

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load video library
    print(f"\nLoading video library from: {VIDEO_LIBRARY}")
    library = load_video_library()
    print(f"Total courses: {len(library['courses'])}")

    # Find courses needing transcripts
    courses = find_courses_without_transcripts(library)
    print(f"Courses needing transcripts: {len(courses)}")

    if not courses:
        print("\nAll courses with videos already have transcripts!")
        return

    # Count total videos
    total_videos = sum(len(c.get('videos', [])) for c in courses)
    print(f"Total videos to process: {total_videos}")

    # Load Whisper model
    print(f"\nLoading Whisper model: {WHISPER_MODEL}")
    print("(This may take a minute on first run...)")
    model = whisper.load_model(WHISPER_MODEL)
    print("Model loaded!")

    # Process courses
    total_transcripts = 0
    for i, course in enumerate(courses):
        print(f"\n[{i+1}/{len(courses)}]", end="")
        transcripts = process_course(course, model, OUTPUT_DIR)
        total_transcripts += transcripts

    # Summary
    print("\n" + "=" * 60)
    print("TRANSCRIPTION COMPLETE")
    print("=" * 60)
    print(f"Courses processed: {len(courses)}")
    print(f"Transcripts created: {total_transcripts}")
    print(f"Output directory: {OUTPUT_DIR}")
    print("\nNext step: Run the AI analysis script to tag the new transcripts.")


if __name__ == "__main__":
    main()
