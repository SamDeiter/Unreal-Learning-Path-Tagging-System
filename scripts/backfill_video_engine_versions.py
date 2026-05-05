"""Backfill an engineVersion field for every course in the video library.

Reads path-builder/src/data/video_library_enriched.json and produces:
  - path-builder/src/data/video_engine_versions.json — { courseCode: "5.6" | null, ... }

Uses:
  1. The `versions` array (e.g. "5.6", "V5.5", "V56", "527")
  2. The title (fallback regex)
  3. The description (last-resort regex)

Writes nothing to Firestore by default. With --write, also patches engineVersion
onto each course_embeddings/{code} doc in Firestore (development-317819, ADC).

Usage:
    # Default: write video_engine_versions.json + print distribution
    python scripts/backfill_video_engine_versions.py

    # Also push to Firestore course_embeddings/{code}.engineVersion
    python scripts/backfill_video_engine_versions.py --write
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

FIRESTORE_PROJECT = "ue5-learning-paths"
ENRICHED = Path("path-builder/src/data/video_library_enriched.json")
OUT_PATH = Path("path-builder/src/data/video_engine_versions.json")

# Regex patterns ordered by preference.
# Match "5.6", "5.7", "UE 5.6", "UE5.6", "Unreal Engine 5.6", "V5.5".
# Match compact "V56" / "V57" (V<major><minor>) — must be word-bounded.
_PATTERNS = [
    re.compile(r"\b(?:unreal\s+engine\s*|ue\s*)?v?(5)\.(\d{1,2})\b", re.IGNORECASE),
    re.compile(r"\bv(5)(\d)\b", re.IGNORECASE),  # V56, V57
]

# We only consider versions in this range — keeps stray numbers like 527 or 53
# from being interpreted as 5.27 or 5.3 (they're LMS codes), and "5.10" is
# almost always a date/timestamp, not a UE version (UE 5.8 is the realistic ceiling).
_MIN_MINOR, _MAX_MINOR = 0, 8


def parse_one(text: str) -> str | None:
    """Pull a UE version like '5.6' out of free text."""
    if not text:
        return None
    for pat in _PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        major, minor = m.group(1), m.group(2)
        if not (_MIN_MINOR <= int(minor) <= _MAX_MINOR):
            continue
        return f"{major}.{int(minor)}"
    return None


def parse_versions_field(versions: list[str] | None) -> str | None:
    """Pick the highest credible UE version from the structured `versions` array."""
    if not versions:
        return None
    candidates: list[tuple[int, int]] = []
    for v in versions:
        parsed = parse_one(str(v))
        if parsed:
            major, minor = parsed.split(".")
            candidates.append((int(major), int(minor)))
    if not candidates:
        return None
    candidates.sort()  # ascending — last is highest
    major, minor = candidates[-1]
    return f"{major}.{minor}"


def detect_engine_version(course: dict) -> tuple[str | None, str]:
    """Return (version, source) where source is 'versions'|'title'|'description'|'none'."""
    v = parse_versions_field(course.get("versions"))
    if v:
        return v, "versions"
    v = parse_one(course.get("title", "") or "")
    if v:
        return v, "title"
    v = parse_one(course.get("description", "") or "")
    if v:
        return v, "description"
    return None, "none"


def write_to_firestore(mapping: dict[str, str | None]) -> int:
    """Patch course_embeddings/{code} with an engineVersion field via batched writes."""
    import google.auth
    from google.cloud import firestore

    creds, _ = google.auth.default()
    db = firestore.Client(project=FIRESTORE_PROJECT, credentials=creds)
    coll = db.collection("course_embeddings")

    written = 0
    batch = db.batch()
    pending = 0
    for code, version in mapping.items():
        if version is None:
            continue
        # Use update with a merge dict so we don't disturb the embedding/title/etc.
        batch.set(
            coll.document(code),
            {"engineVersion": version, "engineVersionSource": "backfill"},
            merge=True,
        )
        pending += 1
        written += 1
        if pending >= 450:
            batch.commit()
            print(f"  committed {written} so far...", file=sys.stderr)
            batch = db.batch()
            pending = 0
    if pending:
        batch.commit()
    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Patch Firestore course_embeddings")
    parser.add_argument("--enriched", default=str(ENRICHED))
    parser.add_argument("--out", default=str(OUT_PATH))
    args = parser.parse_args()

    enriched_path = Path(args.enriched)
    if not enriched_path.exists():
        print(f"Missing {enriched_path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(enriched_path.read_text(encoding="utf-8"))
    courses = data.get("courses") or []
    if not isinstance(courses, list):
        print(f"Unexpected shape — courses is not a list (got {type(courses).__name__}).", file=sys.stderr)
        sys.exit(1)

    mapping: dict[str, str | None] = {}
    by_source: Counter[str] = Counter()
    by_version: Counter[str] = Counter()
    unknown_samples: list[tuple[str, str]] = []

    for course in courses:
        code = course.get("code")
        if not code:
            continue
        version, source = detect_engine_version(course)
        mapping[code] = version
        by_source[source] += 1
        by_version[version or "(unknown)"] += 1
        if version is None and len(unknown_samples) < 10:
            unknown_samples.append((code, course.get("title", "")))

    Path(args.out).write_text(json.dumps(mapping, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Wrote {args.out} ({len(mapping)} entries).")

    print("\nBy detection source:")
    for src, n in by_source.most_common():
        print(f"  {n:>5}  {src}")

    print("\nBy engineVersion:")
    for v, n in by_version.most_common():
        print(f"  {n:>5}  {v}")

    if unknown_samples:
        print("\nFirst 10 unknown samples:")
        for code, title in unknown_samples:
            print(f"  {code}  {title[:90]}")

    if args.write:
        print("\nWriting to Firestore course_embeddings...")
        n = write_to_firestore(mapping)
        print(f"Patched {n} course_embeddings docs with engineVersion.")
    else:
        print("\n(Dry run — pass --write to also patch Firestore course_embeddings.)")


if __name__ == "__main__":
    main()
