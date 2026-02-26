"""Reconcile VTT transcripts with manifest — find truly missing videos."""
import json
from pathlib import Path

manifest = json.load(open("content/epic_learning/video_manifest.json"))
transcript_dir = Path("content/epic_learning/transcripts")

existing_files = list(transcript_dir.glob("*.txt"))
existing_stems = {t.stem for t in existing_files}

# Count CMS transcripts we saved (cms_ prefix files)
cms_transcripts = [s for s in existing_stems if s.startswith("cms_")]
yt_transcripts = [s for s in existing_stems if not s.startswith("cms_")]

print(f"=== TRANSCRIPT INVENTORY ===")
print(f"YouTube transcripts:  {len(yt_transcripts)}")
print(f"CMS VTT transcripts:  {len(cms_transcripts)}")
print(f"Total transcript files: {len(existing_files)}")
print()

# Map cms transcripts back to articles via hash_id
# CMS files are named: cms_{article_hash}_{video_id_or_suffix}.txt
cms_hashes_with_transcripts = set()
for stem in cms_transcripts:
    parts = stem.split("_", 2)  # cms, hash, rest
    if len(parts) >= 2:
        cms_hashes_with_transcripts.add(parts[1])

# Group all CMS videos by article
articles = {}
for v in manifest.get("cms_videos", []):
    title = v.get("article_title", "Unknown")
    ahash = v.get("article_hash", "")
    if title not in articles:
        articles[title] = {"hash": ahash, "total": 0, "has_transcript": 0, "url": v.get("article_url", "")}
    articles[title]["total"] += 1

# Mark which articles have transcripts
for title, info in articles.items():
    h = info["hash"]
    count = sum(1 for s in cms_transcripts if f"cms_{h}_" in s)
    info["has_transcript"] = count

# Split into covered vs missing
missing_articles = {}
for title, info in articles.items():
    missing_count = info["total"] - info["has_transcript"]
    if missing_count > 0:
        missing_articles[title] = {**info, "missing": missing_count}

sorted_missing = sorted(missing_articles.items(), key=lambda x: x[1]["missing"], reverse=True)
total_missing = sum(a["missing"] for _, a in sorted_missing)
total_covered = sum(info["has_transcript"] for info in articles.values())

print(f"=== COVERAGE SUMMARY ===")
print(f"Total CMS videos in manifest: {sum(a['total'] for a in articles.values())}")
print(f"Videos WITH transcript:        {total_covered}")
print(f"Videos WITHOUT transcript:     {total_missing}")
print(f"Coverage:                      {total_covered*100/(total_covered+total_missing):.0f}%")
print()

# Category tagging
TUTORIAL_KW = ["tips", "trick", "tutorial", "how to", "begin play", "getting started", 
               "overview", "quick start", "workflow", "create", "using", "making", "building"]
TECH_KW = ["nanite", "lumen", "niagara", "pcg", "blueprint", "rendering", "animation",
           "shader", "material", "lighting", "physics", "chaos", "metahuman", "geometry",
           "mesh", "pipeline", "optimization", "performance", "cpu", "gpu", "ray tracing",
           "tsr", "vsm", "dmx", "hmi", "ai ", "procedural", "control rig"]

print(f"=== MISSING VIDEOS BY ARTICLE (sorted by # missing) ===")
print()
print(f"{'#':>3} | {'Miss':>4} | {'Tot':>3} | {'Category':<12} | Article Title")
print("----+------+-----+--------------+" + "-" * 70)

for i, (title, info) in enumerate(sorted_missing, 1):
    tl = title.lower()
    if any(kw in tl for kw in TECH_KW):
        cat = "TECHNICAL"
    elif any(kw in tl for kw in TUTORIAL_KW):
        cat = "TUTORIAL"
    elif "fest" in tl or "gdc" in tl or "summit" in tl:
        cat = "CONFERENCE"
    elif "webinar" in tl:
        cat = "WEBINAR"
    else:
        cat = "OTHER"
    
    short = title[:65]
    print(f"{i:3} | {info['missing']:>4} | {info['total']:>3} | {cat:<12} | {short}")
