"""Extract engineRef candidates from Hodor-fetched Jira deprecation tickets.

Reads a clean Jira issues JSON file (produced by Hodor + summarize_hodor_jira_dump.py),
asks Gemini 2.5 Flash to pull out structured engineRef candidates, and either:
  - prints them to stdout (default, --dry-run)
  - writes them to Firestore engineRefs/ as status="draft" (--write)

Auth is ADC end-to-end. No API keys.
- Vertex AI on development-317819 (per reference_vertex_ai_auth)
- Firestore on development-317819

Usage:
    # Default — dry run, prints proposed engineRefs as JSON
    python scripts/extract_engine_refs.py data/hodor/jira_5_7_deprecations.json

    # Write to Firestore (requires curator approval before learners see them)
    python scripts/extract_engine_refs.py data/hodor/jira_5_7_deprecations.json --write

    # Limit to first N issues for quick smoke testing
    python scripts/extract_engine_refs.py data/hodor/jira_5_7_deprecations.json --limit 5
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

VERTEX_PROJECT = "development-317819"  # Vertex AI / Gemini billing
FIRESTORE_PROJECT = "ue5-learning-paths"  # Firebase backend for path-builder
LOCATION = "us-central1"
MODEL = "gemini-2.5-flash"

REF_KINDS = [
    "module", "class", "function", "property", "blueprint_node",
    "menu_path", "console_cmd", "plugin", "shortcut",
    "default_value", "workflow_step", "asset_type",
]

EXTRACTION_PROMPT = """\
You are extracting structured "engineRef" change records from Unreal Engine deprecation tickets.

For each ticket, identify ONE primary engine element being changed. If the ticket touches multiple
unrelated elements, pick the most prominent one.

CRITICAL — aliases must be LEARNER-FACING names, not engineering syntax. The whole point of
aliases is to match how this thing appears in tutorial video titles and descriptions. Generate
3-6 aliases that a tutorial creator would actually say, not what an engineer would type:

  Engineering name (canonicalName)              Learner-facing aliases (what tutorials say)
  ───────────────────────────────────────────   ──────────────────────────────────────────
  MetaHumanCaptureSource Module               → "MetaHuman Capture Source", "MetaHuman capture", "MetaHuman footage capture"
  FCollisionData::query/sim data fields       → "collision filter data", "shape filter", "collision query data"
  UCanvas::DrawText (ANSI string overload)    → "Draw Text on Canvas", "Canvas DrawText", "HUD draw text"
  IKRetargetPelvisMotionOpSettings            → "IK Retarget pelvis motion", "pelvis offset", "retarget pelvis settings"

Skip aliases shorter than 5 characters or too generic ("Module", "Settings", "Property" alone).

Return strict JSON matching this schema:
{
  "found": true | false,
  "kind": "<one of: module, class, function, property, blueprint_node, menu_path, console_cmd, plugin, shortcut, default_value, workflow_step, asset_type>",
  "canonicalName": "<the engineering name of the element>",
  "aliases": ["<learner-facing alias>", "<another>", ...],
  "changeType": "<one of: deprecated, removed, renamed, moved, default_changed>",
  "severity": "<one of: breaking, minor>",
  "summary": "<one sentence: what changed and why a learner should care>",
  "replacement": "<name of the replacement, or null if just deprecated with no successor>"
}

If the ticket isn't actually about a deprecation/rename/removal of a user-facing element (e.g. it's
an internal CI fix, a bug, or unclear), return {"found": false} and nothing else.

Be conservative: it's better to return found=false than to invent fields.

Ticket:
"""


def adf_to_text(adf: Any) -> str:
    """Atlassian Document Format -> plain text."""
    if adf is None:
        return ""
    if isinstance(adf, str):
        return adf
    if not isinstance(adf, dict):
        return ""
    out: list[str] = []
    if adf.get("type") == "text" and adf.get("text"):
        out.append(adf["text"])
    for child in adf.get("content", []) or []:
        out.append(adf_to_text(child))
    return " ".join(s for s in out if s)


def make_ref_id(kind: str, name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return f"ref_{kind}_{slug}"[:120]


def build_prompt(issue: dict) -> str:
    summary = issue.get("summary", "")
    desc = adf_to_text(issue.get("description"))
    components = ", ".join(c.get("name", "") for c in (issue.get("components") or []))
    labels = ", ".join(issue.get("labels") or [])
    fix_versions = ", ".join(v.get("name", "") for v in (issue.get("fixVersions") or []))
    issuetype = (issue.get("issuetype") or {}).get("name", "")
    body = (
        f"key: {issue['key']}\n"
        f"issuetype: {issuetype}\n"
        f"fixVersions: {fix_versions}\n"
        f"components: {components}\n"
        f"labels: {labels}\n"
        f"summary: {summary}\n"
        f"description: {desc[:1500]}"
    )
    return EXTRACTION_PROMPT + body


def call_gemini(prompts: list[str]) -> list[dict]:
    """Call Gemini 2.5 Flash with structured output. ADC auth."""
    import google.auth
    from vertexai import init as vertex_init
    from vertexai.generative_models import GenerationConfig, GenerativeModel

    creds, _ = google.auth.default()
    vertex_init(project=VERTEX_PROJECT, location=LOCATION, credentials=creds)
    model = GenerativeModel(MODEL)

    cfg = GenerationConfig(
        temperature=0.1,
        response_mime_type="application/json",
    )

    out: list[dict] = []
    for i, prompt in enumerate(prompts, 1):
        try:
            resp = model.generate_content(prompt, generation_config=cfg)
            data = json.loads(resp.text)
        except Exception as e:
            print(f"  [{i}/{len(prompts)}] Gemini error: {e}", file=sys.stderr)
            data = {"found": False, "_error": str(e)}
        out.append(data)
    return out


def to_engine_ref(issue: dict, extracted: dict, source_version: str = "5.6", target_version: str = "5.7") -> dict | None:
    if not extracted.get("found"):
        return None
    kind = extracted.get("kind")
    name = extracted.get("canonicalName")
    if not kind or not name:
        return None
    if kind not in REF_KINDS:
        return None
    components = issue.get("components") or []
    area = components[0]["name"] if components else None
    change_type = extracted.get("changeType", "deprecated")
    return {
        "refId": make_ref_id(kind, name),
        "kind": kind,
        "canonicalName": name,
        "aliases": extracted.get("aliases") or [],
        "area": area,
        "versions": {
            source_version: {"exists": True, "notes": ""},
            target_version: {
                "exists": change_type != "removed",
                "deprecatedIn": target_version if change_type in ("deprecated", "removed") else None,
                "removedIn": target_version if change_type == "removed" else None,
                "replacement": extracted.get("replacement"),
                "notes": "",
            },
        },
        "changeLog": [
            {
                "from": source_version,
                "to": target_version,
                "changeType": change_type,
                "severity": extracted.get("severity", "breaking"),
                "summary": extracted.get("summary", issue.get("summary", "")),
                "source": {
                    "provider": "jira",
                    "ref": issue["key"],
                    "url": f"https://epicgames.atlassian.net/browse/{issue['key']}",
                },
            }
        ],
        "status": "draft",
    }


def write_to_firestore(refs: list[dict]) -> None:
    """Write engineRefs as status=draft. Requires ADC + Firestore IAM."""
    import google.auth
    from google.cloud import firestore

    creds, _ = google.auth.default()
    db = firestore.Client(project=FIRESTORE_PROJECT, credentials=creds)
    batch = db.batch()
    coll = db.collection("engineRefs")
    for ref in refs:
        doc = coll.document(ref["refId"])
        batch.set(doc, {**ref, "createdAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP})
    batch.commit()
    print(f"Wrote {len(refs)} engineRefs to Firestore (status=draft).")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Path to clean Jira issues JSON (array of issue dicts)")
    parser.add_argument("--write", action="store_true", help="Write to Firestore (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="Process only first N issues")
    parser.add_argument("--source-version", default="5.6")
    parser.add_argument("--target-version", default="5.7")
    parser.add_argument("--out", default=None, help="Optional output JSON path for proposed refs")
    args = parser.parse_args()

    issues = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if args.limit:
        issues = issues[: args.limit]

    print(f"Building prompts for {len(issues)} issues...", file=sys.stderr)
    prompts = [build_prompt(i) for i in issues]

    print("Calling Gemini 2.5 Flash via Vertex (ADC)...", file=sys.stderr)
    extractions = call_gemini(prompts)

    refs: list[dict] = []
    skipped = 0
    for issue, extracted in zip(issues, extractions, strict=False):
        ref = to_engine_ref(issue, extracted, args.source_version, args.target_version)
        if ref is None:
            skipped += 1
            continue
        refs.append(ref)

    print(f"\nExtracted {len(refs)} engineRefs ({skipped} skipped).", file=sys.stderr)

    if args.out:
        Path(args.out).write_text(json.dumps(refs, indent=2), encoding="utf-8")
        print(f"Wrote proposals to {args.out}", file=sys.stderr)

    if args.write:
        if not refs:
            print("Nothing to write.", file=sys.stderr)
            return
        write_to_firestore(refs)
    else:
        print("\n--- DRY RUN — proposed engineRefs ---")
        print(json.dumps(refs, indent=2))


if __name__ == "__main__":
    main()
