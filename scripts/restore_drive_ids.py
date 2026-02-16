"""Restore drive_ids from old enriched data into current enriched data."""
import json
import os
import sys

TEMP = os.environ.get("TEMP", "/tmp")
OLD_PATH = os.path.join(TEMP, "old_enriched.json")
CURRENT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "path-builder", "src", "data", "video_library_enriched.json"
)

def main():
    # Load old data (has drive_ids)
    with open(OLD_PATH, "r", encoding="utf-8") as f:
        old_data = json.load(f)

    # Build lookup: course code -> {video_order -> drive_id}
    drive_lookup = {}
    total_old_ids = 0
    for c in old_data["courses"]:
        code = c.get("code", "")
        if not code:
            continue
        for v in c.get("videos", []):
            did = v.get("drive_id", "")
            if did:
                if code not in drive_lookup:
                    drive_lookup[code] = {}
                order = v.get("order", 0)
                drive_lookup[code][order] = did
                total_old_ids += 1

    print(f"Old data: {total_old_ids} drive_ids across {len(drive_lookup)} courses")

    # Load current data
    with open(CURRENT_PATH, "r", encoding="utf-8") as f:
        current_data = json.load(f)

    # Merge drive_ids into current courses
    restored = 0
    matched_courses = 0
    for c in current_data["courses"]:
        code = c.get("code", "")
        if code in drive_lookup:
            matched_courses += 1
            for v in c.get("videos", []):
                order = v.get("order", 0)
                if order in drive_lookup[code] and not v.get("drive_id"):
                    v["drive_id"] = drive_lookup[code][order]
                    restored += 1

    print(f"Restored {restored} drive_ids across {matched_courses} courses")

    # Verify
    has_drive = sum(
        1 for c in current_data["courses"]
        if any(v.get("drive_id") for v in c.get("videos", []))
    )
    print(f"Current data now has {has_drive} courses with drive_ids (out of {len(current_data['courses'])})")

    # Show samples
    for c in current_data["courses"]:
        for v in c.get("videos", []):
            if v.get("drive_id"):
                print(f"  Sample: {c.get('title', '?')[:50]} -> {v['drive_id'][:40]}")
                break
        else:
            continue
        break

    # Save
    with open(CURRENT_PATH, "w", encoding="utf-8") as f:
        json.dump(current_data, f, indent=2, ensure_ascii=False)
    print(f"\nSaved updated data to {CURRENT_PATH}")

if __name__ == "__main__":
    main()
