"""Scan video transcripts for engineRef canonical-name + alias mentions.

Reads two transcript sources:
  1. Epic Learning lesson segments — path-builder/src/data/segment_embeddings.json
     (13,580 segments with course_code, video_key, start_seconds, text)
  2. YouTube transcripts — content/transcripts/*.json
     (~1,554 files, each a list of {text, start, duration} lines)

For each engineRef, scans every transcript piece for matches using the strategy
recommended by the matching-research agent:
  - Lowercase normalize the text side; canonical/aliases pre-lowered
  - Word-bounded regex (no substring leaks)
  - Strip leading articles + trailing 's on candidate spans
  - No aliases shorter than MIN_ALIAS_CHARS
  - One mention per (videoId, refId) pair — keeps the strongest hit
  - Confidence scoring scheme below

Confidence:
  0.80 — canonical name in transcript (word-bounded)
  0.70 — alias in transcript (word-bounded)
  0.55 — multi-word alias with in-order tokens, ≤3-token slop, same line
  ----  threshold: 0.5

Negative-context list (per agent footgun #2): we skip "screen capture",
"motion capture", "audio capture" so a "Capture" alias doesn't false-fire.
Add more pairs to NEGATIVE_CONTEXTS as we find them.

Auth: ADC. Project: ue5-learning-paths.

Usage:
    # Dry run — produce mentions JSON, print stats, no Firestore write
    python scripts/extract_engine_ref_mentions_transcripts.py data/hodor/engine_refs_5_7_v2.json

    # Write to Firestore engineRefMentions/ (preserves refStatus from source ref)
    python scripts/extract_engine_ref_mentions_transcripts.py data/hodor/engine_refs_5_7_v2.json --write

    # Limit to verified refs only (skips drafts and rejected)
    python scripts/extract_engine_ref_mentions_transcripts.py data/hodor/engine_refs_5_7_v2.json --verified-only
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

FIRESTORE_PROJECT = "ue5-learning-paths"
SEG_EMBED_PATH = Path("path-builder/src/data/segment_embeddings.json")
YT_TRANSCRIPT_DIR = Path("content/transcripts")
DEFAULT_OUT = Path("data/engine_ref_mentions_transcripts.json")

# Per agent guidance
MIN_NAME_CHARS = 6
MIN_ALIAS_CHARS = 6  # bumped from 5 — "MH" / "BP" / "PCG" must not match
MAX_MATCHES_PER_REF_GLOBAL = 600  # higher than title scan; transcripts are richer
ARTICLES = ("the ", "a ", "an ")

NEGATIVE_CONTEXTS = {
    "capture": ["screen", "motion", "audio", "video"],
    "stat": ["statistic", "static", "stationary"],
}


def normalize(text: str) -> str:
    return text.lower()


def compile_pattern(name: str) -> re.Pattern[str]:
    """Word-bounded match on the lowered literal name."""
    escaped = re.escape(normalize(name))
    return re.compile(rf"\b{escaped}\b", re.IGNORECASE)


def has_negative_context(text: str, name: str) -> bool:
    """Cheap precheck: skip if a known false-friend prefix appears immediately
    before the canonical/alias in the text."""
    key = normalize(name).split()[0]
    blockers = NEGATIVE_CONTEXTS.get(key)
    if not blockers:
        return False
    for blocker in blockers:
        if re.search(rf"\b{re.escape(blocker)}\s+{re.escape(normalize(name))}", text, re.IGNORECASE):
            return True
    return False


class CompiledRef:
    """Pre-compiled regex bundle for one engineRef.
    Hoisted out of the inner loop — building these per-line was ~180M
    re.compile calls (reviewer flagged).
    """

    __slots__ = ("ref", "canonical", "canon_pat", "aliases", "token_lists")

    def __init__(self, ref: dict) -> None:
        self.ref = ref
        self.canonical = ref.get("canonicalName", "")
        self.canon_pat = compile_pattern(self.canonical)
        self.aliases: list[tuple[str, re.Pattern[str]]] = []
        self.token_lists: list[tuple[str, list[re.Pattern[str]]]] = []
        for alias in (ref.get("aliases") or []):
            if len(alias) < MIN_ALIAS_CHARS:
                continue
            self.aliases.append((alias, compile_pattern(alias)))
            toks = [t for t in re.split(r"\s+", normalize(alias)) if len(t) >= 3]
            if len(toks) >= 2:
                self.token_lists.append(
                    (alias, [re.compile(rf"\b{re.escape(t)}\b") for t in toks])
                )


def best_score(text: str, cref: "CompiledRef") -> tuple[float, str | None, str | None]:
    """Return (confidence, matched_alias_or_None, context_label) using
    pre-compiled patterns from a CompiledRef.
    """
    norm = normalize(text)
    if cref.canon_pat.search(norm) and not has_negative_context(norm, cref.canonical):
        return 0.80, None, "transcript"

    for alias, pat in cref.aliases:
        if pat.search(norm) and not has_negative_context(norm, alias):
            return 0.70, alias, "transcript-alias"

    # Token-overlap fallback: all tokens of a multi-word alias present in
    # order within an ~80-char span (≈ same sentence).
    for alias, token_pats in cref.token_lists:
        positions: list[int] = []
        for tok_pat in token_pats:
            m = tok_pat.search(norm)
            if not m:
                positions = []
                break
            positions.append(m.start())
        if positions and positions == sorted(positions) and positions[-1] - positions[0] <= 80:
            return 0.55, alias, "transcript-tokens"

    return 0.0, None, None


def _surrounding(text: str, name: str, radius: int = 80) -> str:
    norm = normalize(text)
    needle = normalize(name)
    idx = norm.find(needle)
    if idx < 0:
        return text[:160]
    start = max(0, idx - radius)
    end = min(len(text), idx + len(needle) + radius)
    out = text[start:end]
    if start > 0:
        out = "..." + out
    if end < len(text):
        out = out + "..."
    return out


# ─── Source loaders ──────────────────────────────────────────────────────


def iter_segment_lines() -> list[tuple[str, float, str]]:
    """Yield (videoId, start_sec, text) for each epic-learning segment."""
    if not SEG_EMBED_PATH.exists():
        return []
    data = json.loads(SEG_EMBED_PATH.read_text(encoding="utf-8"))
    segs = data.get("segments") or {}
    out: list[tuple[str, float, str]] = []
    for s in segs.values():
        text = s.get("text") or ""
        if not text:
            continue
        # Prefer course_code; fall back to video_key. course_code is what
        # course_embeddings is keyed on.
        vid = s.get("course_code") or s.get("video_key") or ""
        if not vid:
            continue
        start_sec = s.get("start_seconds")
        if start_sec is None:
            start_sec = 0
        out.append((str(vid), float(start_sec), text))
    return out


def iter_youtube_lines() -> list[tuple[str, float, str]]:
    """Yield (videoId, start_sec, text) for each YT transcript line."""
    if not YT_TRANSCRIPT_DIR.exists():
        return []
    out: list[tuple[str, float, str]] = []
    for path in YT_TRANSCRIPT_DIR.glob("*.json"):
        vid = path.stem  # 11-char YouTube ID
        try:
            lines = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(lines, list):
            continue
        for entry in lines:
            if not isinstance(entry, dict):
                continue  # skip malformed entries (defensive)
            text = entry.get("text") or ""
            start_sec = entry.get("start", 0)
            if not text:
                continue
            out.append((vid, float(start_sec), text))
    return out


# ─── Main scan ───────────────────────────────────────────────────────────


def scan(refs: list[dict]) -> list[dict]:
    """Returns deduped mentions (one per (videoId, refId), keeping highest conf)."""
    print(f"Loading transcript sources...", file=sys.stderr)
    seg_lines = iter_segment_lines()
    yt_lines = iter_youtube_lines()
    print(
        f"  segment_embeddings: {len(seg_lines)} lines  |  YouTube: {len(yt_lines)} lines",
        file=sys.stderr,
    )

    # best[(videoId, refId)] = mention dict (one mention per pair, highest conf)
    best: dict[tuple[str, str], dict] = {}

    def record(ref: dict, video_id: str, start_sec: float, text: str, conf: float, alias: str | None, ctx: str) -> None:
        ref_id = ref["refId"]
        key = (video_id, ref_id)
        prior = best.get(key)
        if prior and prior["confidence"] >= conf:
            return
        snippet_name = alias or ref["canonicalName"]
        # ID drops timestamp so it merges cleanly with the title/description
        # scanner's mentions (same ID pattern), allowing in-place upgrade when
        # a transcript hit is stronger than the title hit.
        m: dict = {
            "mentionId": f"mention_{video_id}_{ref_id}",
            "videoId": video_id,
            "refId": ref_id,
            "context": ctx,
            "confidence": conf,
            "timestampSec": int(start_sec),
            "snippet": _surrounding(text, snippet_name),
            "authoredBy": "ingest-nlp",
            "refStatus": ref.get("status", "draft"),
        }
        if alias:
            m["matchedAlias"] = alias
        best[key] = m

    for ref in refs:
        if len(ref.get("canonicalName", "")) < MIN_NAME_CHARS:
            continue
        cref = CompiledRef(ref)

        for video_id, start_sec, text in seg_lines:
            conf, alias, ctx = best_score(text, cref)
            if conf >= 0.65:
                record(ref, video_id, start_sec, text, conf, alias, ctx)

        for video_id, start_sec, text in yt_lines:
            conf, alias, ctx = best_score(text, cref)
            if conf >= 0.65:
                record(ref, video_id, start_sec, text, conf, alias, ctx)

    # Apply per-ref cap
    refs_over_cap: list[str] = []
    by_ref: dict[str, list[dict]] = defaultdict(list)
    for m in best.values():
        by_ref[m["refId"]].append(m)
    keep: list[dict] = []
    for ref_id, ms in by_ref.items():
        if len(ms) > MAX_MATCHES_PER_REF_GLOBAL:
            refs_over_cap.append(f"{ref_id} ({len(ms)})")
            continue
        keep.extend(ms)

    if refs_over_cap:
        print(f"  ! dropped {len(refs_over_cap)} ref(s) over cap: {', '.join(refs_over_cap)}", file=sys.stderr)
    return keep


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
        batch.set(coll.document(m["mentionId"]), {**m, "createdAt": firestore.SERVER_TIMESTAMP}, merge=True)
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
    parser.add_argument("refs", help="Path to engineRefs JSON (array)")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--write", action="store_true")
    parser.add_argument(
        "--verified-only",
        action="store_true",
        help="Only scan for refs whose status is 'verified' (default scans drafts + verified, skips rejected)",
    )
    args = parser.parse_args()

    refs_all = json.loads(Path(args.refs).read_text(encoding="utf-8"))
    if args.verified_only:
        refs = [r for r in refs_all if r.get("status") == "verified"]
    else:
        refs = [r for r in refs_all if r.get("status") != "rejected"]
    print(f"Scanning {len(refs)} refs (filtered from {len(refs_all)})", file=sys.stderr)

    mentions = scan(refs)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(mentions, indent=2), encoding="utf-8")
    print(f"Wrote {len(mentions)} mentions to {args.out}")

    by_ref: Counter[str] = Counter()
    by_ctx: Counter[str] = Counter()
    by_conf: Counter[float] = Counter()
    for m in mentions:
        by_ref[m["refId"]] += 1
        by_ctx[m["context"]] += 1
        by_conf[m["confidence"]] += 1
    print("\nTop refs by mention count:")
    for ref_id, n in by_ref.most_common(15):
        print(f"  {n:>5}  {ref_id}")
    print("\nBy context:")
    for ctx, n in by_ctx.most_common():
        print(f"  {n:>5}  {ctx}")
    print("\nBy confidence:")
    for conf, n in sorted(by_conf.items()):
        print(f"  {n:>5}  {conf}")

    if args.write:
        if not mentions:
            print("\nNothing to write.")
            return
        n = write_to_firestore(mentions)
        print(f"\nWrote {n} engineRefMentions to Firestore.")
    else:
        print("\n(Dry run — pass --write to push to Firestore engineRefMentions.)")


if __name__ == "__main__":
    main()
