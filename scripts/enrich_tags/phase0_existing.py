"""Phase 0: Load Existing VTT Transcripts.

Loads the 31 courses that already have VTT transcripts
in content/transcripts/.
"""

import re
from pathlib import Path


def parse_vtt(vtt_path: Path) -> str:
    """Extract plain text from a VTT file.
    
    Args:
        vtt_path: Path to the VTT file.
        
    Returns:
        Plain text content without timestamps.
    """
    content = vtt_path.read_text(encoding='utf-8', errors='ignore')
    lines = []
    
    for line in content.split('\n'):
        line = line.strip()
        # Skip VTT header and timestamps
        if line.startswith('WEBVTT'):
            continue
        if '-->' in line:
            continue
        if line.isdigit():
            continue
        if not line:
            continue
        # Remove HTML-like tags
        line = re.sub(r'<[^>]+>', '', line)
        if line:
            lines.append(line)
    
    return ' '.join(lines)


def load_existing_transcripts(transcript_dir: Path) -> dict[str, str]:
    """Load all existing VTT transcripts.
    
    Args:
        transcript_dir: Path to content/transcripts directory.
        
    Returns:
        Dictionary mapping course codes to full transcript text.
    """
    transcripts = {}
    
    if not transcript_dir.exists():
        print(f"⚠️  Transcript directory not found: {transcript_dir}")
        return transcripts
    
    for course_dir in sorted(transcript_dir.iterdir()):
        if not course_dir.is_dir():
            continue
            
        # Convert folder name to course code (100_01 -> 100.01)
        code = course_dir.name.replace("_", ".")
        
        # Collect all VTT files
        vtt_files = list(course_dir.glob("*.vtt"))
        if not vtt_files:
            continue
            
        # Parse and combine all VTT content
        full_text = []
        for vtt_file in sorted(vtt_files):
            text = parse_vtt(vtt_file)
            if text:
                full_text.append(text)
        
        if full_text:
            transcripts[code] = ' '.join(full_text)
            
    return transcripts


def run_phase0(content_dir: Path) -> dict[str, str]:
    """Execute Phase 0: Load existing transcripts.
    
    Args:
        content_dir: Path to content/ directory.
        
    Returns:
        Dictionary of course code -> transcript text.
    """
    transcript_dir = content_dir / "transcripts"
    
    print("📂 Phase 0: Loading existing VTT transcripts...")
    transcripts = load_existing_transcripts(transcript_dir)
    
    print(f"   ✅ Loaded {len(transcripts)} courses with existing transcripts")
    
    # Show sample
    if transcripts:
        sample_code = list(transcripts.keys())[0]
        sample_len = len(transcripts[sample_code])
        print(f"   📝 Sample: {sample_code} ({sample_len:,} chars)")
    
    return transcripts


if __name__ == "__main__":
    # Test run
    content_dir = Path(__file__).parent.parent.parent / "content"
    transcripts = run_phase0(content_dir)
    
    print(f"\nLoaded courses: {list(transcripts.keys())}")
