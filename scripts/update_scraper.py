import sys
import os

file_path = r'c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\scripts\scrape-demand-intel.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Config to parse engine
engine_parsing = """
// ── Command Line Args ─────────────────────────────────────────────
const args = process.argv.slice(2);
const engine = args.includes("--engine") ? args[args.indexOf("--engine") + 1] : "UE5";
console.log(`Running in ${engine} mode...`);

// ── Paths ──────────────────────────────────────────────────────────
const BENCHMARKS_FILENAME = engine === "UEFN" ? "demand_benchmarks_uefn.json" : "demand_benchmarks.json";
const BENCHMARKS_PATH = path.join(
  __dirname,
  "../path-builder/src/data",
  BENCHMARKS_FILENAME
);
"""

# Replace old paths block
import re
content = re.sub(r'// ── Paths ──.*?\);', engine_parsing, content, flags=re.DOTALL)

# 2. Update Reddit search query
old_reddit_search = r'const query = encodeURIComponent\(`unreal engine 5 \${subtopic}`\);'
new_reddit_search = 'const queryPrefix = engine === "UEFN" ? "uefn verse" : "unreal engine 5";\n  const query = encodeURIComponent(`${queryPrefix} ${subtopic}`);'
content = content.replace(old_reddit_search, new_reddit_search)

old_reddit_sub = r'const url = `https://www\.reddit\.com/r/unrealengine/search\.json\?q=\${query}&sort=relevance&t=month&limit=10`;'
new_reddit_sub = 'const redditSub = engine === "UEFN" ? "FortniteCreative" : "unrealengine";\n  const url = `https://www.reddit.com/r/${redditSub}/search.json?q=${query}&sort=relevance&t=month&limit=10`;'
content = content.replace(old_reddit_sub, new_reddit_sub)

# 3. Update scrapeTrendingQuestions prompt keywords
old_trending_prompt = r'You are a UE5 community research assistant\. Search for REAL questions that Unreal Engine 5 learners'
new_trending_prompt = 'You are a ${engine} community research assistant. Search for REAL questions that ${engine === "UEFN" ? "UEFN and Verse" : "Unreal Engine 5"} learners'
content = content.replace(old_trending_prompt, new_trending_prompt)

# Update Trending sources
old_trending_sources = """- Reddit r/unrealengine (recent posts with upvotes)
- forums.unrealengine.com (Epic official forums)
- stackoverflow.com [unreal-engine5] tag"""

new_trending_sources = """- ${engine === "UEFN" ? "Reddit r/FortniteCreative (recent posts with upvotes)" : "Reddit r/unrealengine (recent posts with upvotes)"}
- forums.unrealengine.com (Epic official forums)
- ${engine === "UEFN" ? "stackoverflow.com [fortnite-creative] tag" : "stackoverflow.com [unreal-engine5] tag"}"""
content = content.replace(old_trending_sources, new_trending_sources)

# 4. Update scrapePainPoints prompt keywords
old_pain_prompt = r'You are a UE5 community research assistant\. Search for the most common struggles and confusion points that Unreal Engine 5 learners'
new_pain_prompt = 'You are a ${engine} community research assistant. Search for the most common struggles and confusion points that ${engine === "UEFN" ? "UEFN and Verse" : "Unreal Engine 5"} learners'
content = content.replace(old_pain_prompt, new_pain_prompt)

old_pain_reddit = r'- Reddit r/unrealengine'
new_pain_reddit = '- ${engine === "UEFN" ? "Reddit r/FortniteCreative" : "Reddit r/unrealengine"}'
content = content.replace(old_pain_reddit, new_pain_reddit)

# 5. Update buildReport metadata
old_report_scraped_by = r'scrapedBy: "github-action",'
new_report_scraped_by = 'scrapedBy: "github-action",\n    engine: engine,'
content = content.replace(old_report_scraped_by, new_report_scraped_by)

# 6. Update Firestore write calls
old_firestore_latest = r'await db\.doc\("demand_intel/latest"\)\.set\(report\);'
new_firestore_latest = 'const collectionName = engine === "UEFN" ? "demand_intel_uefn" : "demand_intel";\n      await db.doc(`${collectionName}/latest`).set(report);'
content = re.sub(old_firestore_latest, new_firestore_latest, content)

old_firestore_history = r'await db\.doc\(`demand_intel/history_\${today}`\)\.set\({'
new_firestore_history = 'await db.doc(`${collectionName}/history_${today}`).set({'
content = re.sub(r'await db\.doc\(`demand_intel/history_\${today}`\)\.set\(', new_firestore_history, content)

# Update specific Firestore lookups (youtube_metrics, google_trends)
# These might still be shared, but UEFN might need its own.
# For now, let's keep them shared but maybe engine-scoped later if needed.
# Actually, let's engine-scope them to avoid pollution.
content = content.replace('await ytDb.doc("demand_intel/youtube_metrics").get()', 'await ytDb.doc(`${collectionName}/youtube_metrics`).get()')
content = content.replace('await db.doc("demand_intel/google_trends").get()', 'await db.doc(`${collectionName}/google_trends`).get()')
content = content.replace("await db.doc('demand_intel/reddit_sentiment').get()", "await db.doc(`${collectionName}/reddit_sentiment`).get()")


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated scrape-demand-intel.js")
