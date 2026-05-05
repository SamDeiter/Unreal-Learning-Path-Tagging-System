"""Scan videos for mentions of known engineRef canonicalNames + aliases.

Reads:
  - engineRefs JSON (from extract_engine_refs.py)
  - path-builder/src/data/video_library_enriched.json (2,435 courses)

Writes:
  - data/engine_ref_mentions.json — [{mentionId, videoId, refId, context,
    confidence, snippet, authoredBy}]

Optional --write pushes to Firestore engineRefMentions/ (development-317819 ADC).

For v1 the scan covers title + description. Transcript scanning is a separate
follow-up that needs the lesson_hash → course_code mapping wired up.

Match rules (per engineRef):
  • canonical name in title:            confidence 0.95, context "title"
  • canonical name in description:      confidence 0.80, context "description"
  • alias in title or description:      confidence 0.65, context "{field}-alias"
  • short canonical (< MIN_NAME_CHARS): skipped — too generic, would over-match

Usage:
    python scripts/extract_engine_ref_mentions.py data/hodor/engine_refs_smoke.json
    python scripts/extract_engine_ref_mentions.py <refs.json> --write
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

FIRESTORE_PROJECT = "ue5-learning-paths"
ENRICHED = Path("path-builder/src/data/video_library_enriched.json")
DEFAULT_OUT = Path("data/engine_ref_mentions.json")

# Canonical names shorter than this are too generic to substring-match safely
# (e.g. "Module", "Property", "Plugin"). They'll be skipped with a warning.
MIN_NAME_CHARS = 6
# Aliases shorter than this are ignored.
MIN_ALIAS_CHARS = 5
# If a single ref produces more matches than this, the canonical is too generic
# and ALL its mentions are dropped (with a warning) so we don't pollute the
# corpus with false positives.
MAX_MATCHES_PER_REF = 200


def compile_pattern(name: str) -> re.Pattern[str]:
    """Word-bounded, case-insensitive substring match on the literal name."""
    escaped = re.escape(name)
    return re.compile(rf"\b{escaped}\b", re.IGNORECASE)


def scan_one(
    ref: dict,
    courses: list[dict],
) -> tuple[list[dict], str | None]:
    """Return (mentions, drop_reason). drop_reason set => mentions discarded."""
    canonical = ref.get("canonicalName", "")
    if len(canonical) < MIN_NAME_CHARS:
        return [], f"canonical too short ({canonical!r})"

    canon_pat = compile_pattern(canonical)
    aliases = [
        (a, compile_pattern(a))
        for a in (ref.get("aliases") or [])
        if len(a) >= MIN_ALIAS_CHARS and a != canonical
    ]

    mentions: list[dict] = []
    ref_id = ref["refId"]
    # Denormalize parent ref status onto mentions so list queries don't need
    # cross-doc reads in security rules. Curator flow must keep this in sync.
    ref_status = ref.get("status", "draft")

    for course in courses:
        code = course.get("code")
        if not code:
            continue
        title = course.get("title") or ""
        desc = course.get("description") or ""

        if canon_pat.search(title):
            mentions.append({
                "mentionId": f"mention_{code}_{ref_id}",
                "videoId": code,
                "refId": ref_id,
                "context": "title",
                "confidence": 0.95,
                "snippet": title[:160],
                "authoredBy": "ingest-nlp",
                "refStatus": ref_status,
            })
            continue  # one mention per video per ref is enough
        if canon_pat.search(desc):
            mentions.append({
                "mentionId": f"mention_{code}_{ref_id}",
                "videoId": code,
                "refId": ref_id,
                "context": "description",
                "confidence": 0.80,
                "snippet": _surrounding(desc, canon_pat),
                "authoredBy": "ingest-nlp",
                "refStatus": ref_status,
            })
            continue
        for alias, alias_pat in aliases:
            if alias_pat.search(title):
                mentions.append({
                    "mentionId": f"mention_{code}_{ref_id}",
                    "videoId": code,
                    "refId": ref_id,
                    "context": "title-alias",
                    "confidence": 0.65,
                    "snippet": title[:160],
                    "matchedAlias": alias,
                    "authoredBy": "ingest-nlp",
                    "refStatus": ref_status,
                })
                break
            if alias_pat.search(desc):
                mentions.append({
                    "mentionId": f"mention_{code}_{ref_id}",
                    "videoId": code,
                    "refId": ref_id,
                    "context": "description-alias",
                    "confidence": 0.65,
                    "snippet": _surrounding(desc, alias_pat),
                    "matchedAlias": alias,
                    "authoredBy": "ingest-nlp",
                    "refStatus": ref_status,
                })
                break

    if len(mentions) > MAX_MATCHES_PER_REF:
        return [], f"too many matches ({len(mentions)}, threshold {MAX_MATCHES_PER_REF})"

    return mentions, None


def _surrounding(text: str, pat: re.Pattern[str], radius: int = 80) -> str:
    m = pat.search(text)
    if not m:
        return text[:160]
    start = max(0, m.start() - radius)
    end = min(len(text), m.end() + radius)
    out = text[start:end]
    if start > 0:
        out = "..." + out
    if end < len(text):
        out = out + "..."
    return out


def write_to_firestore(mentions: list[dict]) -> int:
    import google.auth
    from google.cloud import firestore

    creds, _ = google.auth.default()
    db = firestore.Client(project=FIRESTORE_PROJECT, credentials=creds)
    coll = db.collection("engineRefMentions")
    written = 0
    batch = db.batch()
    pending = 0
    for m in mentions:
        batch.set(coll.document(m["mentionId"]), {**m, "createdAt": firestore.SERVER_TIMESTAMP})
        pending += 1
        written += 1
        if pending >= 450:
            batch.commit()
            print(f"  committed {written}...", file=sys.stderr)
            batch = db.batch()
            pending = 0
    if pending:
        batch.commit()
    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("refs", help="Path to engineRefs JSON (array of refs)")
    parser.add_argument("--enriched", default=str(ENRICHED))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--write", action="store_true", help="Push to Firestore engineRefMentions")
    args = parser.parse_args()

    refs = json.loads(Path(args.refs).read_text(encoding="utf-8"))
    enriched = json.loads(Path(args.enriched).read_text(encoding="utf-8"))
    courses = enriched.get("courses") or []
    print(f"Loaded {len(refs)} engineRefs and {len(courses)} courses", file=sys.stderr)

    all_mentions: list[dict] = []
    by_ref: Counter[str] = Counter()
    by_context: Counter[str] = Counter()
    drops: list[tuple[str, str]] = []

    for ref in refs:
        mentions, drop = scan_one(ref, courses)
        if drop:
            drops.append((ref.get("canonicalName", "?"), drop))
            continue
        all_mentions.extend(mentions)
        by_ref[ref.get("canonicalName", "?")] = len(mentions)
        for m in mentions:
            by_context[m["context"]] += 1

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(all_mentions, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_mentions)} mentions to {args.out}")

    print("\nMatches per ref:")
    for name, n in by_ref.most_common():
        print(f"  {n:>4}  {name}")
    print("\nBy context:")
    for ctx, n in by_context.most_common():
        print(f"  {n:>4}  {ctx}")
    if drops:
        print("\nDropped refs:")
        for name, why in drops:
            print(f"  - {name}: {why}")

    # Show a few real samples
    if all_mentions:
        print("\nSample mentions:")
        for m in all_mentions[:8]:
            print(f"  [{m['confidence']}] {m['videoId']:>12}  ({m['context']})  {m['snippet'][:90]}")

    if args.write:
        if not all_mentions:
            print("\nNothing to write.")
            return
        n = write_to_firestore(all_mentions)
        print(f"\nWrote {n} engineRefMentions to Firestore.")
    else:
        print("\n(Dry run — pass --write to push to Firestore engineRefMentions.)")


if __name__ == "__main__":
    main()
