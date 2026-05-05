"""Curator action: flip an engineRef's status and propagate to its mentions.

When a ref moves draft -> verified (or -> rejected), every engineRefMention
linked to it must have its denormalized `refStatus` updated to match — that's
what the Firestore security rules read when learners list mentions.

Usage:
    # Approve a single ref (and propagate to mentions)
    python scripts/update_engine_ref_status.py ref_workflow_step_unrealstats verified

    # Reject one
    python scripts/update_engine_ref_status.py ref_property_tstaticarray_alignment rejected

    # Batch from a file (one refId per line)
    python scripts/update_engine_ref_status.py --batch approvals.txt verified
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

FIRESTORE_PROJECT = "ue5-learning-paths"
ALLOWED_STATUSES = {"verified", "rejected", "draft"}


def update_one(db, ref_id: str, new_status: str) -> tuple[int, int]:
    """Returns (ref_updated, mentions_updated)."""
    from google.cloud import firestore

    ref_doc = db.collection("engineRefs").document(ref_id)
    snap = ref_doc.get()
    if not snap.exists:
        print(f"  ! engineRef {ref_id} not found, skipping", file=sys.stderr)
        return 0, 0

    # Update the ref
    payload: dict[str, object] = {
        "status": new_status,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if new_status == "verified":
        payload["verifiedAt"] = firestore.SERVER_TIMESTAMP
    elif new_status == "rejected":
        payload["rejectedAt"] = firestore.SERVER_TIMESTAMP
    ref_doc.set(payload, merge=True)

    # Propagate to mentions
    mentions = (
        db.collection("engineRefMentions")
        .where(filter=firestore.FieldFilter("refId", "==", ref_id))
        .stream()
    )
    batch = db.batch()
    n_mentions = 0
    for m in mentions:
        batch.set(m.reference, {"refStatus": new_status}, merge=True)
        n_mentions += 1
        if n_mentions % 450 == 0:
            batch.commit()
            batch = db.batch()
    if n_mentions % 450 != 0:
        batch.commit()

    return 1, n_mentions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ref", nargs="?", help="refId (omit when using --batch)")
    parser.add_argument("status", help="One of: verified, rejected, draft")
    parser.add_argument(
        "--batch",
        help="Path to a text file with one refId per line (overrides positional ref)",
    )
    args = parser.parse_args()

    if args.status not in ALLOWED_STATUSES:
        print(f"status must be one of {sorted(ALLOWED_STATUSES)}", file=sys.stderr)
        sys.exit(1)

    ref_ids: list[str] = []
    if args.batch:
        ref_ids = [
            line.strip()
            for line in Path(args.batch).read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
    elif args.ref:
        ref_ids = [args.ref]
    else:
        parser.error("Provide a refId or --batch <file>")

    import google.auth
    from google.cloud import firestore

    creds, _ = google.auth.default()
    db = firestore.Client(project=FIRESTORE_PROJECT, credentials=creds)

    refs_done = 0
    mentions_done = 0
    for rid in ref_ids:
        r, m = update_one(db, rid, args.status)
        refs_done += r
        mentions_done += m
        print(f"  {rid:<70} -> {args.status}  ({m} mentions)")

    print(
        f"\nUpdated {refs_done} engineRefs and {mentions_done} engineRefMentions "
        f"to status={args.status} on {FIRESTORE_PROJECT}."
    )


if __name__ == "__main__":
    main()
