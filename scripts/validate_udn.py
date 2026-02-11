"""Quick validation of udn_docs.json"""
import json

data = json.load(open("content/udn_docs.json", "r", encoding="utf-8"))

# Spot check key entries
for key in ["nanite", "blueprints", "connectingnodes", "lumen"]:
    if key in data:
        d = data[key]
        print(f"=== {key} ===")
        print(f"  label: {d['label']}")
        print(f"  tags: {d.get('tags', [])}")
        print(f"  type: {d.get('type')}")
        print(f"  sections: {d.get('sections', [])[:4]}")
        print(f"  keySteps ({len(d.get('keySteps', []))}): ", end="")
        if d.get("keySteps"):
            print(d["keySteps"][0][:80])
        else:
            print("(none)")
        print(f"  seeAlso: {len(d.get('seeAlso', []))} refs")
        print(f"  readTime: {d.get('readTimeMinutes')} min")
        print()

# Check for entries missing required fields
missing = {"label": 0, "url": 0, "description": 0}
for k, v in data.items():
    for field in missing:
        if not v.get(field):
            missing[field] += 1

print("Missing fields:")
for f, c in missing.items():
    print(f"  {f}: {c}/{len(data)}")
