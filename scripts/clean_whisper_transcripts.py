#!/usr/bin/env python3
"""
clean_whisper_transcripts.py
Post-processing cleanup for Whisper transcripts.

1. Fixes known UE5 terminology misspellings
2. Detects and flags hallucination loops (repeated phrases)
3. Creates .bak backups before modifying

Usage:
    python scripts/clean_whisper_transcripts.py                 # process all whisper_*.txt
    python scripts/clean_whisper_transcripts.py --all           # process ALL transcripts
    python scripts/clean_whisper_transcripts.py --dry-run       # preview changes only
    python scripts/clean_whisper_transcripts.py --file FILE     # process a single file
"""

import argparse
import glob
import os
import re
import shutil
import sys
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────

TRANSCRIPT_DIR = Path(__file__).parent.parent / "content" / "epic_learning" / "transcripts"

# Known Whisper misspellings -> correct UE5 terms
# Format: (pattern, replacement, case_sensitive)
TERM_FIXES = [
    # Tessellation variants
    (r"\bTESILATION\b", "Tessellation", False),
    (r"\btesolation\b", "tessellation", False),
    (r"\bTeslation\b", "Tessellation", False),
    (r"\btesilation\b", "tessellation", False),
    (r"\btesilated\b", "tessellated", False),
    (r"\btesolated\b", "tessellated", False),
    # Voronoi
    (r"\bBoronny\b", "Voronoi", False),
    (r"\bboronny\b", "Voronoi", False),
    (r"\bwarranty diagram\b", "Voronoi diagram", False),
    (r"\bwarranty position map\b", "Voronoi position map", False),
    # Lumen (only standalone, not "lumens" as a light unit or "luminous")
    (r"\bLumin\b(?!\s+(reflections|scene|lighting))", "Lumen", True),
    (r"\bLumin (reflections|scene|lighting)", "Lumen \\1", True),
    (r"\blumensine\b", "Lumen scene", False),
    (r"\bluminous you\b", "Lumen issue", False),
    # Nanite
    (r"\bdenied isolation\b", "Nanite tessellation", False),
    (r"\bdenied tesselation\b", "Nanite tessellation", False),
    # Quixel Megascans
    (r"\bQuixsal Negascans\b", "Quixel Megascans", False),
    (r"\bQuixal Negascans\b", "Quixel Megascans", False),
    # MetaHumans
    (r"\bmetahemans\b", "MetaHumans", False),
    # Common UE5 terms
    (r"\bgrieblies\b", "greebles", False),
    (r"\bNiagra\b", "Niagara", False),
]

# Hallucination detection: flag phrases repeated N+ times consecutively
HALLUCINATION_MIN_WORDS = 4       # minimum words in the repeated phrase
HALLUCINATION_MIN_REPEATS = 3     # minimum consecutive repeats to flag


# ─── Functions ───────────────────────────────────────────────────

def fix_terminology(text: str) -> tuple[str, list[str]]:
    """Apply all terminology fixes. Returns (fixed_text, list_of_changes)."""
    changes = []
    for pattern, replacement, case_sensitive in TERM_FIXES:
        flags = 0 if case_sensitive else re.IGNORECASE
        matches = re.findall(pattern, text, flags=flags)
        if matches:
            new_text = re.sub(pattern, replacement, text, flags=flags)
            if new_text != text:
                changes.append(f"  '{matches[0]}' → '{replacement}' ({len(matches)}x)")
                text = new_text
    return text, changes


def detect_hallucinations(text: str) -> list[str]:
    """Detect repeated phrase loops (a known Whisper failure mode)."""
    warnings = []
    words = text.split()

    for phrase_len in range(HALLUCINATION_MIN_WORDS, 12):
        i = 0
        while i <= len(words) - phrase_len:
            phrase = " ".join(words[i:i + phrase_len])
            repeat_count = 1
            j = i + phrase_len

            while j + phrase_len <= len(words):
                next_phrase = " ".join(words[j:j + phrase_len])
                if next_phrase.lower() == phrase.lower():
                    repeat_count += 1
                    j += phrase_len
                else:
                    break

            if repeat_count >= HALLUCINATION_MIN_REPEATS:
                snippet = phrase[:60] + ("..." if len(phrase) > 60 else "")
                warnings.append(
                    f"  ⚠ Repeated {repeat_count}x: \"{snippet}\""
                )
                i = j  # skip past the repetition
            else:
                i += 1

    # Deduplicate warnings (sub-phrases of the same loop)
    seen = set()
    unique = []
    for w in warnings:
        key = w[:80]
        if key not in seen:
            seen.add(key)
            unique.append(w)
    return unique


def process_file(filepath: Path, dry_run: bool = False) -> dict:
    """Process a single transcript file. Returns stats dict."""
    result = {"file": filepath.name, "fixes": [], "warnings": [], "modified": False}

    try:
        text = filepath.read_text(encoding="utf-8")
    except Exception as e:
        result["warnings"].append(f"  ❌ Could not read: {e}")
        return result

    # Skip tiny files
    if len(text.strip()) < 50:
        result["warnings"].append(f"  ⚠ Very short file ({len(text)} bytes) — skipping")
        return result

    # Fix terminology
    fixed_text, changes = fix_terminology(text)
    result["fixes"] = changes

    # Detect hallucinations
    hallucinations = detect_hallucinations(fixed_text)
    result["warnings"] = hallucinations

    # Write if changed
    if changes and not dry_run:
        backup = filepath.with_suffix(".txt.bak")
        shutil.copy2(filepath, backup)
        filepath.write_text(fixed_text, encoding="utf-8")
        result["modified"] = True

    return result


def main():
    parser = argparse.ArgumentParser(description="Clean Whisper transcripts")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes only")
    parser.add_argument("--all", action="store_true", help="Process ALL transcripts, not just whisper_*")
    parser.add_argument("--file", type=str, help="Process a single file")
    args = parser.parse_args()

    if args.file:
        files = [Path(args.file)]
    elif args.all:
        files = sorted(TRANSCRIPT_DIR.glob("*.txt"))
    else:
        files = sorted(TRANSCRIPT_DIR.glob("whisper_*.txt"))

    if not files:
        print("No transcript files found.")
        sys.exit(0)

    mode = "DRY RUN" if args.dry_run else "LIVE"
    print(f"\n  Whisper Transcript Cleaner [{mode}]")
    print(f"  {'=' * 45}")
    print(f"  Files to process: {len(files)}\n")

    total_fixes = 0
    total_warnings = 0
    total_modified = 0

    for f in files:
        result = process_file(f, dry_run=args.dry_run)

        if result["fixes"] or result["warnings"]:
            status = "✏ FIXED" if result["modified"] else ("👁 PREVIEW" if result["fixes"] else "⚠ FLAGS")
            print(f"  [{status}] {result['file']}")
            for fix in result["fixes"]:
                print(f"    {fix}")
            for warn in result["warnings"]:
                print(f"    {warn}")
            print()

        total_fixes += len(result["fixes"])
        total_warnings += len(result["warnings"])
        total_modified += 1 if result["modified"] else 0

    print(f"  Summary")
    print(f"  {'─' * 30}")
    print(f"  Files scanned:  {len(files)}")
    print(f"  Files modified: {total_modified}")
    print(f"  Term fixes:     {total_fixes}")
    print(f"  Warnings:       {total_warnings}")

    if args.dry_run and total_fixes > 0:
        print(f"\n  Run without --dry-run to apply fixes.")


if __name__ == "__main__":
    main()
