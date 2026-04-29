#!/usr/bin/env python3
"""ingest_udn_from_p4.py — Ingest UDN docs from a Perforce workspace into a
normalized JSONL for Vertex AI RAG Engine corpora.

LOCAL ONLY — no cloud calls. Walks .INT.udn files, parses frontmatter, splits
the body into ~350-token chunks (hard max 500, min 40, 100-token overlap),
resolves intra-file [INCLUDE:#NAME] references against [EXCERPT:NAME] blocks,
and writes one JSON object per chunk to --output.

Usage:
    python scripts/ingest_udn_from_p4.py \
        --source "C:/.../UE-5.5/Source" \
        --output content/udn_ingested.jsonl \
        --version 5.5 [--limit N] [--dry-run] [--verbose]
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Directories that contain auto-generated reference content we don't want in
# the learning RAG corpus. These match parse_udn_docs.py's policy.
SKIP_DIRS = {"API", "BlueprintAPI", "Globals", "Images", "Skins", "site-index", "edc-qc-test"}

# Multi-value frontmatter keys (`Key: value` may appear repeatedly).
MULTI_KEYS = {"tags", "track", "related", "redirect", "course"}

# Chunking constants. token_estimate uses len(text) // 4 to match
# scripts/embed_segments.py and scripts/embed_udn_docs.py.
TARGET_TOKENS = 350
MAX_TOKENS = 500
MIN_TOKENS = 40
OVERLAP_CHARS = 400  # roughly 100 tokens of carry-over between sibling chunks


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------

def parse_frontmatter(text: str):
    """Parse the leading `Key: Value` block, terminated by a blank line.

    Returns (header_dict, body_text). Multi-value keys land as lists.
    """
    header = {}
    multi = defaultdict(list)
    lines = text.split("\n")
    body_start = 0

    for i, raw in enumerate(lines):
        line = raw.rstrip("\r")
        stripped = line.strip()

        if not stripped:
            body_start = i + 1
            break

        # Headers stop the moment we see something that's clearly content.
        if stripped.startswith(("#", "[", "!", "*", "-", "|", ">")) and ":" not in stripped.split(" ", 1)[0]:
            body_start = i
            break

        m = re.match(r"^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$", line)
        if not m:
            body_start = i
            break

        key = m.group(1).lower().replace("-", "_")
        value = m.group(2).strip()
        if key in MULTI_KEYS:
            if value:
                multi[key].append(value)
            else:
                # `Tags:` with no value just creates the key as empty list
                multi.setdefault(key, [])
        else:
            header[key] = value
        body_start = i + 1

    for k, v in multi.items():
        header[k] = v

    body = "\n".join(lines[body_start:])
    return header, body


# ---------------------------------------------------------------------------
# Body normalization
# ---------------------------------------------------------------------------

EXCERPT_RE = re.compile(r"\[EXCERPT:([^\]]+)\](.*?)\[/EXCERPT\]", re.DOTALL)
INCLUDE_RE = re.compile(r"\[INCLUDE:#([^\]]+)\]")
COMMENT_WRAPPER_RE = re.compile(r"\[COMMENT\](.*?)\[/COMMENT\]", re.DOTALL)
TOC_RE = re.compile(r"\[TOC\([^\)]*\)\]|\[TOC\]")
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)(?:\([^)]*\))?")
CODE_FENCE_RE = re.compile(r"^```", re.MULTILINE)
TILDE_FENCE_RE = re.compile(r"~~~")


def collect_excerpts(body: str):
    """Pull every `[EXCERPT:NAME]...[/EXCERPT]` block out of the body.

    Excerpts often live inside `[COMMENT]...[/COMMENT]` wrappers. We strip
    those wrappers later, but we capture the excerpt bodies first so that
    intra-file `[INCLUDE:#NAME]` directives can still be resolved.
    """
    excerpts = {}
    for m in EXCERPT_RE.finditer(body):
        name = m.group(1).strip()
        excerpts[name] = m.group(2).strip()
    return excerpts


def resolve_includes(body: str, excerpts: dict, max_passes: int = 4) -> str:
    """Replace `[INCLUDE:#NAME]` with the matching excerpt body, intra-file only."""
    for _ in range(max_passes):
        if not INCLUDE_RE.search(body):
            break
        def _sub(match):
            name = match.group(1).strip()
            return excerpts.get(name, "")
        body = INCLUDE_RE.sub(_sub, body)
    # Any unresolved cross-file includes are simply removed.
    return INCLUDE_RE.sub("", body)


def strip_markup_keep_text(body: str) -> str:
    """Remove UDN structural markup but keep the readable prose.

    - Strip `[TOC(...)]` directives
    - Remove `[COMMENT]...[/COMMENT]` wrappers (excerpts inside have already
      been captured before this runs)
    - Strip `[EXCERPT:...][/EXCERPT]` markers (keep their inner text)
    - Drop `[OBJECT:Snippet]...[/OBJECT]` / `[PARAM:...]...[/PARAM]` / `[PARAMLITERAL:...]...[/PARAMLITERAL]`
      blocks entirely. These hold T3D blueprint dumps that aren't useful prose
      and blow up chunk sizes.
    - Replace `[anchor](path)` links with just `anchor`
    - Replace `![alt](image.png)(convert:false)` images with `[image: alt]`
    """
    body = TOC_RE.sub("", body)
    # Drop nested OBJECT/PARAM blocks (T3D blueprint snippets etc.) before
    # anything else so their contents don't leak into chunks.
    body = re.sub(r"\[OBJECT:[^\]]*\].*?\[/OBJECT\]", "", body, flags=re.DOTALL)
    body = re.sub(r"\[PARAM:[^\]]*\].*?\[/PARAM\]", "", body, flags=re.DOTALL)
    body = re.sub(r"\[PARAMLITERAL:[^\]]*\].*?\[/PARAMLITERAL\]", "", body, flags=re.DOTALL)
    # Strip any orphan REGION/DIR/VAR markers that don't enclose content we care about.
    body = re.sub(r"\[/?REGION[^\]]*\]", "", body)
    body = re.sub(r"\[DIR[^\]]*\]", "", body)
    body = re.sub(r"\[VAR:[^\]]*\].*?\[/VAR\]", "", body, flags=re.DOTALL)
    body = COMMENT_WRAPPER_RE.sub("", body)
    # Strip excerpt markers but keep contents (in case excerpt wasn't in a comment block)
    body = re.sub(r"\[EXCERPT:[^\]]+\]", "", body)
    body = re.sub(r"\[/EXCERPT\]", "", body)

    # Images first so the link regex doesn't grab their alt text.
    body = IMAGE_RE.sub(lambda m: f"[image: {m.group(1).strip()}]" if m.group(1).strip() else "", body)

    # Drop bare image-size suffixes like `(w:800)` that survive the image strip.
    body = re.sub(r"\([a-z]:\d+\)", "", body)

    # Replace `[text](path)` with `text`. If text is empty (`[](path)`), use the
    # last path segment (humanized) so the chunk still has a hint of what was
    # being linked.
    def _link_sub(match: re.Match) -> str:
        text = match.group(1).strip()
        target = match.group(2).strip()
        if text:
            return text
        if target:
            tail = target.rstrip("/").split("/")[-1]
            tail = re.sub(r"[-_]+", " ", tail).strip()
            return tail
        return ""

    body = LINK_RE.sub(_link_sub, body)

    # Normalize whitespace: collapse 3+ blank lines to 2.
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

H2_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)


def estimate_tokens(text: str) -> int:
    """Match scripts/embed_segments.py: 4 chars/token rough heuristic."""
    return max(1, len(text) // 4)


def split_into_sections(body: str):
    """Split body on `## headings`. Returns list of (heading, section_text).

    Content above the first H2 is grouped under heading="" (intro).
    """
    sections = []
    matches = list(H2_RE.finditer(body))
    if not matches:
        return [("", body.strip())]

    intro = body[: matches[0].start()].strip()
    if intro:
        sections.append(("", intro))

    for i, m in enumerate(matches):
        heading = m.group(1).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        section_text = body[start:end].strip()
        if section_text:
            sections.append((heading, section_text))
    return sections


def chunk_section(text: str):
    """Split a section into chunks targeting ~350 tokens, max 500, min 40.

    Splits primarily on paragraph boundaries (blank lines), with a 100-token
    (~400-char) overlap carried into the next chunk. Paragraphs that exceed
    MAX_TOKENS on their own are hard-split at sentence boundaries.
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return []

    chunks = []
    buf = ""

    def flush(buf_text: str, carry: bool = True) -> str:
        if not buf_text.strip():
            return ""
        toks = estimate_tokens(buf_text)
        if toks >= MIN_TOKENS:
            chunks.append(buf_text.strip())
        # Build overlap tail to seed the next chunk.
        if carry and buf_text:
            return buf_text[-OVERLAP_CHARS:]
        return ""

    for para in paragraphs:
        ptoks = estimate_tokens(para)
        if ptoks > MAX_TOKENS:
            # Flush whatever was buffered before the oversized paragraph.
            buf = flush(buf, carry=False)
            # Hard-split the paragraph on sentence boundaries.
            sentences = re.split(r"(?<=[.!?])\s+", para)
            sub = ""
            for sent in sentences:
                # If a single "sentence" is still over MAX_TOKENS (e.g. a
                # giant table row or a no-punctuation dump), force a
                # character-window split so we never emit a > MAX_TOKENS chunk.
                if estimate_tokens(sent) > MAX_TOKENS:
                    if sub.strip() and estimate_tokens(sub) >= MIN_TOKENS:
                        chunks.append(sub.strip())
                    sub = ""
                    window = TARGET_TOKENS * 4  # chars per chunk window
                    for start in range(0, len(sent), window):
                        piece = sent[start:start + window].strip()
                        if estimate_tokens(piece) >= MIN_TOKENS:
                            chunks.append(piece)
                    continue
                candidate = (sub + " " + sent).strip() if sub else sent
                if estimate_tokens(candidate) > TARGET_TOKENS and sub:
                    chunks.append(sub.strip())
                    sub = sent
                else:
                    sub = candidate
            if sub.strip() and estimate_tokens(sub) >= MIN_TOKENS:
                chunks.append(sub.strip())
            buf = ""
            continue

        candidate = (buf + "\n\n" + para).strip() if buf else para
        if estimate_tokens(candidate) > MAX_TOKENS:
            # Current buf is full enough: flush and start the next chunk with
            # the overlap tail prepended to the new paragraph.
            tail = flush(buf, carry=True)
            buf = (tail + "\n\n" + para).strip() if tail else para
        else:
            buf = candidate
            # If we've crossed the target band, proactively flush so chunks
            # land closer to TARGET_TOKENS than to MAX_TOKENS.
            if estimate_tokens(buf) >= TARGET_TOKENS:
                tail = flush(buf, carry=True)
                buf = tail

    if buf.strip():
        toks = estimate_tokens(buf)
        if toks >= MIN_TOKENS:
            chunks.append(buf.strip())
        elif chunks:
            # Tail was too small to stand alone; glue it onto the last chunk
            # so we don't drop information.
            chunks[-1] = (chunks[-1] + "\n\n" + buf).strip()

    return chunks


# ---------------------------------------------------------------------------
# File processing
# ---------------------------------------------------------------------------

def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def has_code_block(body: str) -> bool:
    return bool(CODE_FENCE_RE.search(body) or TILDE_FENCE_RE.search(body))


def has_image(body: str) -> bool:
    return bool(IMAGE_RE.search(body))


def section_path_from_rel(rel_dir: str) -> list:
    rel_dir = rel_dir.replace("\\", "/").strip("/")
    if not rel_dir or rel_dir == ".":
        return []
    return [seg for seg in rel_dir.split("/") if seg]


def make_chunk_id(rel_file: str, section_idx: int, chunk_idx: int) -> str:
    raw = f"{rel_file}::s{section_idx}::c{chunk_idx}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]


def normalize_tags(raw):
    if raw is None:
        return []
    if isinstance(raw, str):
        raw = [raw]
    out = []
    seen = set()
    for tag in raw:
        t = tag.strip()
        if not t:
            continue
        key = t.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out


def process_file(path: Path, source_root: Path, corpus_version: str, verbose: bool = False):
    """Parse a single .INT.udn file and yield chunk dicts."""
    try:
        raw = read_text(path)
    except Exception as exc:
        if verbose:
            print(f"  [read-error] {path}: {exc}")
        return [], {"read_error": 1}

    header, body_raw = parse_frontmatter(raw)

    # Capture excerpts BEFORE we strip [COMMENT] wrappers (excerpts often
    # live inside comment blocks, by Epic's convention).
    excerpts = collect_excerpts(body_raw)
    body_resolved = resolve_includes(body_raw, excerpts)
    body_clean = strip_markup_keep_text(body_resolved)

    title = (header.get("title") or "").strip()
    description = (header.get("description") or header.get("seo_description") or "").strip()
    if not title:
        # Fall back to the file's directory name so we still index something
        # meaningful instead of dropping the doc.
        title = path.parent.name.replace("-", " ").replace("_", " ").title()

    rel_file = path.relative_to(source_root).as_posix()
    rel_dir = os.path.relpath(path.parent, source_root)
    section_path = section_path_from_rel(rel_dir)

    try:
        mtime_iso = dt.datetime.fromtimestamp(path.stat().st_mtime, tz=dt.timezone.utc).isoformat()
    except OSError:
        mtime_iso = None

    code_flag = has_code_block(body_raw)
    image_flag = has_image(body_raw)

    sections = split_into_sections(body_clean)
    if verbose:
        print(f"  [parse] {rel_file} sections={len(sections)} title={title!r}")

    chunks_out = []
    stats = {"sections": 0, "chunks": 0, "dropped_small": 0}

    for s_idx, (heading, section_text) in enumerate(sections):
        if not section_text.strip():
            continue
        stats["sections"] += 1
        section_chunks = chunk_section(section_text)
        if not section_chunks:
            stats["dropped_small"] += 1
            continue

        for c_idx, chunk_text in enumerate(section_chunks):
            tok = estimate_tokens(chunk_text)
            if tok < MIN_TOKENS:
                stats["dropped_small"] += 1
                continue
            chunk = {
                "chunk_id": make_chunk_id(rel_file, s_idx, c_idx),
                "source": "udn",
                "ue_version_corpus": corpus_version,
                "ue_version_frontmatter": (header.get("version") or "").strip() or None,
                "title": title,
                "description": description or None,
                "section_path": section_path,
                "section_heading": heading or None,
                "doc_type": (header.get("type") or "").strip() or None,
                "tags": normalize_tags(header.get("tags")),
                "engine_concept": (header.get("engine_concept") or "").strip() or None,
                "skill_family": (header.get("skill_family") or "").strip() or None,
                "track": header.get("track") if isinstance(header.get("track"), list) else (
                    [header.get("track")] if header.get("track") else []
                ),
                "availability": (header.get("availability") or "").strip() or None,
                "file_path": rel_file,
                "last_modified_iso": mtime_iso,
                "has_code": code_flag,
                "has_image": image_flag,
                "body": chunk_text,
                "token_estimate": tok,
            }
            chunks_out.append(chunk)
            stats["chunks"] += 1

    return chunks_out, stats


# ---------------------------------------------------------------------------
# CLI / main
# ---------------------------------------------------------------------------

def find_udn_files(source: Path):
    files = []
    for root, dirs, names in os.walk(source):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in names:
            if n.endswith(".INT.udn"):
                files.append(Path(root) / n)
    files.sort()
    return files


def histogram(values, edges):
    buckets = [0] * (len(edges) + 1)
    for v in values:
        placed = False
        for i, edge in enumerate(edges):
            if v < edge:
                buckets[i] += 1
                placed = True
                break
        if not placed:
            buckets[-1] += 1
    return buckets


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else "")
    parser.add_argument("--source", required=True, help="Path to UDN Source/ directory")
    parser.add_argument("--output", required=True, help="Output JSONL path")
    parser.add_argument("--version", required=True, help="UE corpus version label, e.g. 5.5")
    parser.add_argument("--limit", type=int, default=None, help="Process only the first N files")
    parser.add_argument("--dry-run", action="store_true", help="Do not write output, only print stats")
    parser.add_argument("--verbose", action="store_true", help="Per-file logs")
    args = parser.parse_args(argv)

    source = Path(args.source)
    if not source.exists():
        print(f"ERROR: source not found: {source}", file=sys.stderr)
        return 2

    files = find_udn_files(source)
    if args.limit:
        files = files[: args.limit]

    print(f"Found {len(files)} .INT.udn files under {source}")
    if args.limit:
        print(f"  (limited to first {args.limit})")

    chunk_records = []
    file_count = 0
    failed = 0
    frontmatter_keys = [
        "title", "description", "type", "version", "tags", "engine_concept",
        "skill_family", "track", "availability", "parent",
    ]
    fm_present = Counter()
    chunk_field_present = Counter()
    field_keys = [
        "description", "section_heading", "doc_type", "tags", "engine_concept",
        "skill_family", "track", "availability", "ue_version_frontmatter",
        "last_modified_iso",
    ]

    for path in files:
        chunks, stats = process_file(path, source, args.version, verbose=args.verbose)
        if stats.get("read_error"):
            failed += 1
            continue
        file_count += 1
        # Frontmatter coverage: derive from first chunk's fields (per-file values are uniform).
        if chunks:
            head = chunks[0]
            for k in frontmatter_keys:
                if k == "title" and head.get("title"):
                    fm_present["title"] += 1
                elif k == "description" and head.get("description"):
                    fm_present["description"] += 1
                elif k == "type" and head.get("doc_type"):
                    fm_present["type"] += 1
                elif k == "version" and head.get("ue_version_frontmatter"):
                    fm_present["version"] += 1
                elif k == "tags" and head.get("tags"):
                    fm_present["tags"] += 1
                elif k == "engine_concept" and head.get("engine_concept"):
                    fm_present["engine_concept"] += 1
                elif k == "skill_family" and head.get("skill_family"):
                    fm_present["skill_family"] += 1
                elif k == "track" and head.get("track"):
                    fm_present["track"] += 1
                elif k == "availability" and head.get("availability"):
                    fm_present["availability"] += 1
                elif k == "parent":
                    # parent isn't kept in chunk; re-read frontmatter quickly
                    pass
        for ch in chunks:
            chunk_records.append(ch)
            for fk in field_keys:
                v = ch.get(fk)
                if v not in (None, "", [], {}):
                    chunk_field_present[fk] += 1

    # Stats
    tokens = [c["token_estimate"] for c in chunk_records]
    print()
    print("=" * 60)
    print("Ingestion summary")
    print("=" * 60)
    print(f"Files processed:   {file_count}")
    print(f"Files failed:      {failed}")
    print(f"Chunks emitted:    {len(chunk_records)}")
    if tokens:
        print(f"Token min/median/mean/max: {min(tokens)} / "
              f"{int(statistics.median(tokens))} / "
              f"{int(statistics.mean(tokens))} / {max(tokens)}")
        edges = [50, 100, 200, 300, 400, 500]
        hist = histogram(tokens, edges)
        labels = [f"<{edges[0]}"]
        for i in range(len(edges) - 1):
            labels.append(f"{edges[i]}-{edges[i+1]-1}")
        labels.append(f">={edges[-1]}")
        print("Token histogram:")
        for lbl, count in zip(labels, hist):
            bar = "#" * min(40, count // max(1, len(chunk_records) // 200) if chunk_records else 0)
            print(f"  {lbl:>10}  {count:>6}  {bar}")

    if file_count:
        print("\nFrontmatter coverage (per-file):")
        for k in frontmatter_keys:
            n = fm_present.get(k, 0)
            print(f"  {k:<18} {n}/{file_count} ({100*n/file_count:.1f}%)")
    if chunk_records:
        print("\nMetadata coverage (per-chunk):")
        for fk in field_keys:
            n = chunk_field_present.get(fk, 0)
            print(f"  {fk:<24} {n}/{len(chunk_records)} ({100*n/len(chunk_records):.1f}%)")

    if args.dry_run:
        print("\n[dry-run] Not writing output.")
        # Print up to 2 sample chunks (truncated body) for sanity in --verbose.
        if args.verbose and chunk_records:
            print("\nSample chunk[0]:")
            sample = dict(chunk_records[0])
            sample["body"] = sample["body"][:200] + ("..." if len(sample["body"]) > 200 else "")
            print(json.dumps(sample, indent=2, ensure_ascii=False))
        return 0

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for ch in chunk_records:
            f.write(json.dumps(ch, ensure_ascii=False) + "\n")
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"\nWrote {len(chunk_records)} chunks to {out_path} ({size_mb:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
