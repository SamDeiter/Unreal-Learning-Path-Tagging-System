"""Push an existing engineRefs JSON to Firestore engineRefs/ as status=draft.

Avoids re-running Gemini extraction. Use this after extract_engine_refs.py has
already produced a clean JSON.

Usage:
    python scripts/push_engine_refs_to_firestore.py data/hodor/engine_refs_5_7_v2.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

FIRESTORE_PROJECT = "ue5-learning-paths"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Path to engineRefs JSON (array of refs)")
    parser.add_argument("--collection", default="engineRefs")
    args = parser.parse_args()

    refs = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if not isinstance(refs, list) or not refs:
        print("No refs to push.", file=sys.stderr)
        sys.exit(1)

    import google.auth
    from google.cloud import firestore

    creds, _ = google.auth.default()
    db = firestore.Client(project=FIRESTORE_PROJECT, credentials=creds)
    coll = db.collection(args.collection)

    written = 0
    batch = db.batch()
    pending = 0
    for ref in refs:
        ref_id = ref.get("refId")
        if not ref_id:
            continue
        ref.setdefault("status", "draft")
        doc = {
            **ref,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        batch.set(coll.document(ref_id), doc, merge=False)
        pending += 1
        written += 1
        if pending >= 450:
            batch.commit()
            print(f"  committed {written}...", file=sys.stderr)
            batch = db.batch()
            pending = 0
    if pending:
        batch.commit()

    print(f"Wrote {written} docs to {args.collection} on {FIRESTORE_PROJECT}.")


if __name__ == "__main__":
    main()
