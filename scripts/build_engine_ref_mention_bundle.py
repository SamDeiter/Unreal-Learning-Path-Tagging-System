"""Build a static client-side bundle for the EngineDeltaChip lookup.

V1 path steps don't carry a videoId — only a title. To resolve mentions from
either side, we precompute a small JSON the chip imports directly:

  byVideoId:    videoId  -> [mention, ...]
  byVideoTitle: title    -> videoId
  refs:         refId    -> full engineRef (only fields the chip needs)

Inputs (must exist):
  data/engine_ref_mentions.json
  data/engine_ref_mentions_transcripts.json
  data/hodor/engine_refs_5_7_v2.json
  path-builder/src/data/video_library_enriched.json   (course title lookup)
  path-builder/src/data/epic_learning_embeddings.json (doc-chunk title lookup)

Output:
  path-builder/src/data/engine_ref_mentions_bundle.json

Pure on-disk; no Firestore call. Re-run any time mentions/refs change.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TITLE_MENTIONS = REPO_ROOT / "data" / "engine_ref_mentions.json"
TRANSCRIPT_MENTIONS = REPO_ROOT / "data" / "engine_ref_mentions_transcripts.json"
REFS_V2 = REPO_ROOT / "data" / "hodor" / "engine_refs_5_7_v2.json"
APPROVED_LIST = REPO_ROOT / "data" / "hodor" / "curator_phase2_approve.txt"
REJECTED_LIST = REPO_ROOT / "data" / "hodor" / "curator_phase2_reject.txt"
VIDEO_LIBRARY = REPO_ROOT / "path-builder" / "src" / "data" / "video_library_enriched.json"
EPIC_EMBED = REPO_ROOT / "path-builder" / "src" / "data" / "epic_learning_embeddings.json"
OUT = REPO_ROOT / "path-builder" / "src" / "data" / "engine_ref_mentions_bundle.json"


def read_ref_id_list(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def build_title_to_videoid() -> dict[str, str]:
    """One title -> first videoId we encounter. Both course library and chunks."""
    out: dict[str, str] = {}

    if VIDEO_LIBRARY.exists():
        lib = load_json(VIDEO_LIBRARY)
        for course in lib.get("courses", []) or []:
            title = (course.get("title") or "").strip()
            code = course.get("code")
            if title and code and title not in out:
                out[title] = code

    # Doc-prefixed chunks live in epic_learning_embeddings as `chunks: {key: chunk}`.
    if EPIC_EMBED.exists():
        emb = load_json(EPIC_EMBED)
        chunks = emb.get("chunks") or {}
        # The chunk key (e.g. epic_lesson_0M4_000) plus its `title` give us
        # what we need. We use the chunk key as the videoId and the title
        # for matching against step.title.
        for chunk_key, chunk in chunks.items():
            title = (chunk.get("title") or "").strip()
            if title and title not in out:
                out[title] = chunk_key

    return out


def main() -> None:
    title_mentions = load_json(TITLE_MENTIONS) if TITLE_MENTIONS.exists() else []
    transcript_mentions = load_json(TRANSCRIPT_MENTIONS) if TRANSCRIPT_MENTIONS.exists() else []
    refs_list = load_json(REFS_V2) if REFS_V2.exists() else []

    # Curator decisions from Phase 2 — these reflect Firestore truth and
    # override the stale "draft" status in the local refs JSON.
    approved = read_ref_id_list(APPROVED_LIST)
    rejected = read_ref_id_list(REJECTED_LIST)
    print(f"Curator decisions: {len(approved)} verified, {len(rejected)} rejected.")

    print(f"Loaded {len(title_mentions)} title mentions, {len(transcript_mentions)} transcript mentions, {len(refs_list)} refs.")

    title_to_videoid = build_title_to_videoid()
    print(f"Built title->videoId index: {len(title_to_videoid)} entries.")

    by_video_id: dict[str, list[dict]] = defaultdict(list)
    for m in [*title_mentions, *transcript_mentions]:
        vid = m.get("videoId")
        if not vid:
            continue
        by_video_id[vid].append(m)

    # Slim refs down to fields the chip uses. Apply curator overrides so
    # status reflects the live Firestore truth, not the stale local JSON.
    refs_slim: dict[str, dict] = {}
    for r in refs_list:
        rid = r.get("refId")
        if not rid:
            continue
        if rid in approved:
            status = "verified"
        elif rid in rejected:
            status = "rejected"
        else:
            status = r.get("status", "draft")
        refs_slim[rid] = {
            "refId": rid,
            "kind": r.get("kind"),
            "canonicalName": r.get("canonicalName"),
            "area": r.get("area"),
            "status": status,
            "versions": r.get("versions") or {},
            "changeLog": r.get("changeLog") or [],
        }

    # Title -> videoId restricted to the videoIds we actually have mentions for.
    # That keeps the bundle small and avoids leaking unrelated titles.
    by_video_title = {
        title: vid
        for title, vid in title_to_videoid.items()
        if vid in by_video_id
    }
    # Plus: many of our doc_* video IDs were derived from chunk keys with a
    # specific title. The title scanner emitted snippet == title for title
    # mentions, so use snippet as a backup.
    for m in title_mentions:
        if m.get("context") in ("title", "title-alias"):
            snippet = (m.get("snippet") or "").strip()
            vid = m.get("videoId")
            if snippet and vid and snippet not in by_video_title:
                by_video_title[snippet] = vid

    bundle = {
        "byVideoId": dict(by_video_id),
        "byVideoTitle": by_video_title,
        "refs": refs_slim,
        "_meta": {
            "mentionCount": sum(len(v) for v in by_video_id.values()),
            "videoCount": len(by_video_id),
            "titleCount": len(by_video_title),
            "refCount": len(refs_slim),
        },
    }

    OUT.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"  videoIds: {bundle['_meta']['videoCount']}")
    print(f"  titles:   {bundle['_meta']['titleCount']}")
    print(f"  refs:     {bundle['_meta']['refCount']}")
    print(f"  mentions: {bundle['_meta']['mentionCount']}")


if __name__ == "__main__":
    main()
