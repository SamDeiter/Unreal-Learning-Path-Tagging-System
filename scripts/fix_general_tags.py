"""Fix duplicate 'General' display names in tags.json.

Renames tags like 'audio.general' from 'General' to 'Audio (General)'.
"""
import json
import os

TAGS_PATHS = [
    "path-builder/src/data/tags.json",
    "tags/tags.json",
    "sample_data/tags.json",
]

def fix_general_tags(path):
    if not os.path.exists(path):
        print(f"  SKIP (not found): {path}")
        return False

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    tags = data.get("tags", data) if isinstance(data, dict) else data
    fixed = 0

    for tag in tags:
        tag_id = tag.get("tag_id", "")
        display = tag.get("display_name", "")

        if display.lower() == "general" and "." in tag_id and tag_id.endswith(".general"):
            # Extract the category prefix: "audio.general" -> "Audio"
            prefix = tag_id.split(".")[0].replace("_", " ").title()
            new_name = f"{prefix} (General)"
            print(f"  {tag_id}: '{display}' -> '{new_name}'")
            tag["display_name"] = new_name
            fixed += 1

    if fixed > 0:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  Fixed {fixed} tags in {path}")
    else:
        print(f"  No fixes needed in {path}")

    return fixed > 0

print("Fixing duplicate 'General' display names...")
for path in TAGS_PATHS:
    print(f"\nProcessing: {path}")
    fix_general_tags(path)

print("\nDone!")
