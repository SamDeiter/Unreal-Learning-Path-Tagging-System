"""Phase 2: Whisper GPU Transcription.

Transcribes videos using OpenAI Whisper with GPU acceleration.
Saves transcripts as SRT files to CC folder for closed captions.
"""

import json
from datetime import timedelta
from pathlib import Path
from typing import Optional

# Lazy import whisper to avoid loading if not needed
whisper = None
torch = None


def _load_whisper():
    """Lazy load whisper and torch."""
    global whisper, torch
    if whisper is None:
        import whisper as _whisper
        import torch as _torch
        whisper = _whisper
        torch = _torch


def format_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp format.
    
    Args:
        seconds: Time in seconds.
        
    Returns:
        SRT formatted timestamp (HH:MM:SS,mmm).
    """
    td = timedelta(seconds=seconds)
    hours, remainder = divmod(td.seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    milliseconds = int(td.microseconds / 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def segments_to_srt(segments: list[dict]) -> str:
    """Convert Whisper segments to SRT format.
    
    Args:
        segments: List of Whisper segment dictionaries.
        
    Returns:
        SRT formatted string.
    """
    srt_lines = []
    
    for i, seg in enumerate(segments, 1):
        start = format_timestamp(seg['start'])
        end = format_timestamp(seg['end'])
        text = seg['text'].strip()
        
        if text:
            srt_lines.append(f"{i}")
            srt_lines.append(f"{start} --> {end}")
            srt_lines.append(text)
            srt_lines.append("")
    
    return "\n".join(srt_lines)


def get_device() -> str:
    """Get the best available device (GPU or CPU)."""
    _load_whisper()
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        print(f"   🚀 Using GPU: {gpu_name}")
        return "cuda"
    else:
        print("   ⚠️  GPU not available, using CPU (slower)")
        return "cpu"


def transcribe_video(
    model,
    video_path: Path,
    output_dir: Path,
) -> tuple[str, Path]:
    """Transcribe a single video and save SRT.
    
    Args:
        model: Loaded Whisper model.
        video_path: Path to the video file.
        output_dir: Directory to save SRT file.
        
    Returns:
        Tuple of (transcript text, SRT file path).
    """
    # Transcribe
    result = model.transcribe(
        str(video_path),
        language="en",
        verbose=False,
    )
    
    # Generate SRT
    srt_content = segments_to_srt(result['segments'])
    
    # Save to CC folder
    output_dir.mkdir(parents=True, exist_ok=True)
    srt_filename = video_path.stem + ".srt"
    srt_path = output_dir / srt_filename
    srt_path.write_text(srt_content, encoding='utf-8')
    
    return result['text'], srt_path


def transcribe_course(
    model,
    course: dict,
    progress_file: Optional[Path] = None,
) -> dict:
    """Transcribe all videos in a course.
    
    Args:
        model: Loaded Whisper model.
        course: Course dictionary with 'videos' field.
        progress_file: Optional file to save progress.
        
    Returns:
        Dictionary with course code and transcript.
    """
    code = course.get('code', 'unknown')
    course_path = Path(course.get('path', ''))
    
    # Determine CC output directory
    cc_dir = course_path / "CC"
    
    transcripts = []
    srt_files = []
    
    for video in course.get('videos', []):
        video_path = Path(video.get('path', ''))
        
        if not video_path.exists():
            print(f"      ⚠️  Video not found: {video_path.name}")
            continue
        
        try:
            text, srt_path = transcribe_video(model, video_path, cc_dir)
            transcripts.append(text)
            srt_files.append(str(srt_path))
            print(f"      ✅ {video_path.name}")
        except Exception as e:
            print(f"      ❌ {video_path.name}: {e}")
    
    return {
        "code": code,
        "transcript": " ".join(transcripts),
        "srt_files": srt_files,
        "video_count": len(transcripts),
    }


def load_progress(progress_file: Path) -> set[str]:
    """Load completed course codes from progress file."""
    if progress_file.exists():
        data = json.loads(progress_file.read_text())
        return set(data.get('completed', []))
    return set()


def save_progress(progress_file: Path, completed: set[str]):
    """Save completed course codes to progress file."""
    progress_file.write_text(json.dumps({
        'completed': list(completed)
    }, indent=2))


def run_phase2(
    courses: list[dict],
    existing_transcripts: dict[str, str],
    model_name: str = "medium",
    progress_file: Optional[Path] = None,
) -> dict[str, str]:
    """Execute Phase 2: Whisper GPU transcription.
    
    Args:
        courses: List of course dictionaries.
        existing_transcripts: Already loaded transcripts from Phase 0.
        model_name: Whisper model size (tiny/base/small/medium/large).
        progress_file: Optional file to track progress for resume.
        
    Returns:
        Dictionary mapping course codes to transcripts.
    """
    _load_whisper()
    
    print(f"🎙️  Phase 2: Whisper transcription (model: {model_name})...")
    
    # Get device and load model
    device = get_device()
    print(f"   📥 Loading Whisper {model_name} model...")
    model = whisper.load_model(model_name, device=device)
    
    # Find courses needing transcription
    need_transcription = []
    for course in courses:
        code = course.get('code')
        if code and code not in existing_transcripts:
            need_transcription.append(course)
    
    print(f"   📊 {len(existing_transcripts)} already have transcripts")
    print(f"   📊 {len(need_transcription)} courses need transcription")
    
    # Load progress for resume capability
    completed = set()
    if progress_file:
        completed = load_progress(progress_file)
        print(f"   📊 {len(completed)} already completed (resume)")
    
    # Transcribe remaining courses
    all_transcripts = dict(existing_transcripts)
    
    for i, course in enumerate(need_transcription):
        code = course.get('code')
        
        if code in completed:
            continue
            
        print(f"\n   [{i+1}/{len(need_transcription)}] {code}: {course.get('title', '')[:40]}...")
        
        result = transcribe_course(model, course, progress_file)
        
        if result['transcript']:
            all_transcripts[code] = result['transcript']
            completed.add(code)
            
            if progress_file:
                save_progress(progress_file, completed)
    
    print(f"\n   ✅ Transcription complete: {len(all_transcripts)} total courses")
    
    return all_transcripts


if __name__ == "__main__":
    # Test with a small sample
    print("Testing Whisper setup...")
    _load_whisper()
    device = get_device()
    print(f"Device: {device}")
    
    if torch.cuda.is_available():
        print(f"CUDA version: {torch.version.cuda}")
        print(f"GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
