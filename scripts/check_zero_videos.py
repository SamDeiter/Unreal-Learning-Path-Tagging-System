"""Analyze remaining 44 courses with 0 videos vs drive file codes."""
import json
import re

with open("path-builder/src/data/video_library_enriched.json") as f:
    data = json.load(f)
courses = data if isinstance(data, list) else data.get("courses", [])

with open("content/drive_video_metadata_final.json") as f:
    drive = json.load(f)

# Get empty course codes
empty = {c.get("code"): c.get("title", "?") for c in courses if (c.get("video_count") or 0) == 0}
print(f"Empty courses ({len(empty)}):")
for code, title in sorted(empty.items()):
    print(f"  {code} {title}")

# Get all drive codes
drive_codes = set()
for d in drive:
    m = re.match(r'^(\d{3}\.\d{2})', d.get("name", ""))
    if m:
        drive_codes.add(m.group(1))

print(f"\nDrive codes ({len(drive_codes)}):")
# Check overlap
overlap = set(empty.keys()) & drive_codes
missing_from_drive = set(empty.keys()) - drive_codes
print(f"  Overlap with empty: {len(overlap)}")
print(f"  Empty codes NOT in drive: {len(missing_from_drive)}")
for code in sorted(missing_from_drive):
    print(f"    {code} {empty[code]}")

# Check if any drive files have codes like "104.01" with different naming
print("\nSample drive filenames for debugging:")
for d in drive[:5]:
    print(f"  {d['name']}")

# Check names that contain empty course codes as substring
print("\nDrive files containing empty course codes (substring):")
for code in sorted(list(missing_from_drive)[:5]):
    matches = [d["name"] for d in drive if code.replace(".", "") in d["name"].replace(".", "") or code in d["name"]]
    if matches:
        print(f"  {code}: {matches[:3]}")
