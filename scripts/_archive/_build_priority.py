"""Generate whisper_priority.json — the user's selected videos for Whisper transcription."""
import json
from pathlib import Path

manifest = json.load(open("content/epic_learning/video_manifest.json"))
transcript_dir = Path("content/epic_learning/transcripts")
existing = {t.stem for t in transcript_dir.glob("*.txt")}

# User's selected article titles (partial matches)
PRIORITY_TITLES = [
    "Optimizing UE5",
    "TSR, Nanite, Lumen, VSM",
    "PCG: First Steps",
    "De-spaghetti Your Blueprints",
    "Making the Most of Animation Blueprints",
    "Tips and Tricks for Chaos Destruction",
    "Using UVs For Tech Art",
    "Project Titan Mini Tutorials",
    "Fortnite's Real-Time Lighting",
    # Strong matches added
    "Using Niagara Caches",
    "Modular MetaHumans",
    "Control Rig",  # UF 2025
    "Geometry Script - Using a BVH",
    "Geometry Script - Mesh Booleans",
    "Using the Gameplay Ability System",
    "Using Python to Streamline",
    "Accelerating Your In-Editor Workflows",
    "Refactoring the Mesh Drawing Pipeline",
    "How Small Open Doors",
    "A Taste of Chocolate",
    "Creating a Character Navigation Heatmap",
    "Baked River Simulations",
]


def matches_priority(title):
    return True  # Changed to process ALL videos, bypass filter

# Build the priority list
priority = []
for v in manifest.get("cms_videos", []):
    title = v.get("article_title", "")
    if not matches_priority(title):
        continue
    vid = v["id"]
    # Check if we already have a transcript
    has_transcript = any(vid in stem for stem in existing)
    if has_transcript:
        continue
    priority.append({
        "id": vid,
        "article_title": title,
        "article_url": v.get("article_url", ""),
        "article_hash": v.get("article_hash", ""),
    })

# Group by article for summary
by_article = {}
for p in priority:
    t = p["article_title"]
    if t not in by_article:
        by_article[t] = 0
    by_article[t] += 1

print(f"Priority videos: {len(priority)}")
print(f"Across {len(by_article)} articles:")
for title, count in sorted(by_article.items(), key=lambda x: -x[1]):
    print(f"  {count:>3} | {title[:70]}")

out = {"total": len(priority), "videos": priority}
with open("content/epic_learning/whisper_priority.json", "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print(f"\nSaved: content/epic_learning/whisper_priority.json")
