"""Scrape Google Trends data for ALL 18 UE5 skill categories and write to Firestore.

Uses pytrends (FREE, no API key) to get real search interest data for
every category in demand_benchmarks.json. Writes results to Firestore
at demand_intel/google_trends for consumption by scrape-demand-intel.js.

Usage:
    pip install pytrends firebase-admin google-cloud-firestore
    python scripts/scrape-google-trends.py

Google Trends returns relative interest (0-100) within each query batch.
We use 'unreal engine blueprints' as the anchor across ALL batches so
scores are normalized to a single consistent scale.

Environment Variables:
    FIREBASE_SERVICE_ACCOUNT  — Base64-encoded Firebase service account JSON
                                (optional; if not set, saves local JSON only)
"""

import json
import os
import sys
import time
import base64
from datetime import datetime

try:
    from pytrends.request import TrendReq
except ImportError:
    print("ERROR: pytrends is not installed. Run: pip install pytrends")
    sys.exit(1)

# ── Configuration ─────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

BENCHMARKS_PATH = os.path.join(
    ROOT_DIR, "path-builder", "src", "data", "demand_benchmarks.json"
)
REPORT_DIR = os.path.join(SCRIPT_DIR, "output")
REPORT_PATH = os.path.join(REPORT_DIR, "google_trends_report.json")

TIMEFRAME = "today 12-m"   # Last 12 months for stable averages
GEO = ""                    # Worldwide (empty = global)
MAX_RETRIES = 3
RETRY_DELAY = 30            # seconds between retries
BATCH_PAUSE = 15            # seconds between batches (rate limit avoidance)

# Anchor keyword present in EVERY batch for cross-batch normalization
ANCHOR_CATEGORY = "Blueprints"
ANCHOR_QUERY = "unreal engine blueprints"

# Search terms per category — Google Trends allows max 5 per query,
# so with 1 anchor we get 4 real terms per batch.
CATEGORY_QUERIES = {
    "Blueprints":          "unreal engine blueprints",
    "Niagara":             "unreal engine niagara",
    "Materials":           "unreal engine materials",
    "Animation":           "unreal engine animation",
    "Lighting":            "unreal engine lighting",
    "UI/UMG":              "unreal engine UMG",
    "Landscape":           "unreal engine landscape",
    "Audio":               "unreal engine audio",
    "AI":                  "unreal engine AI behavior tree",
    "Networking":          "unreal engine multiplayer",
    "C++":                 "unreal engine C++",
    "Physics":             "unreal engine chaos physics",
    "Rendering":           "unreal engine nanite",
    "MetaHumans":          "unreal engine metahuman",
    "Optimization":        "unreal engine optimization profiling",
    "Virtual Production":  "unreal engine virtual production",
    "Level Design":        "unreal engine level design",
    "Gameplay Framework":  "unreal engine gameplay framework",
}

MAX_BATCH_SIZE = 4  # 4 real terms + 1 anchor = 5 per Google Trends query


# ── Firebase Setup ────────────────────────────────────────────────────

def init_firebase():
    """Initialize Firebase Admin SDK from FIREBASE_SERVICE_ACCOUNT env var.
    Returns Firestore db client or None if not available."""
    sa_b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not sa_b64:
        print("  ℹ  FIREBASE_SERVICE_ACCOUNT not set — will save locally only")
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        sa_json = base64.b64decode(sa_b64).decode("utf-8")
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)

        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred)

        return firestore.client()
    except Exception as e:
        print(f"  ⚠ Firebase init failed: {e}")
        return None


# ── Google Trends Fetching ────────────────────────────────────────────

def build_batches(category_names):
    """Split categories into batches of MAX_BATCH_SIZE, each including the anchor.
    The anchor category itself is always placed in batch 1."""
    # Remove anchor from the list (it goes in every batch automatically)
    remaining = [c for c in category_names if c != ANCHOR_CATEGORY]

    batches = []
    for i in range(0, len(remaining), MAX_BATCH_SIZE):
        chunk = remaining[i:i + MAX_BATCH_SIZE]
        # Anchor always first in every batch
        batch = [ANCHOR_CATEGORY] + chunk
        batches.append(batch)

    return batches


def fetch_batch(pytrends_client, batch_categories, batch_num, total_batches):
    """Fetch Google Trends interest-over-time for one batch of categories."""
    keywords = [CATEGORY_QUERIES[name] for name in batch_categories]
    print(f"  📡 Batch {batch_num}/{total_batches}: {batch_categories}")

    for attempt in range(MAX_RETRIES):
        try:
            pytrends_client.build_payload(keywords, timeframe=TIMEFRAME, geo=GEO)
            df = pytrends_client.interest_over_time()

            if df.empty:
                print(f"    ⚠ Empty response, retrying ({attempt + 1}/{MAX_RETRIES})...")
                time.sleep(RETRY_DELAY)
                continue

            # Calculate average interest per keyword over the timeframe
            averages = {}
            for name in batch_categories:
                kw = CATEGORY_QUERIES[name]
                if kw in df.columns:
                    averages[name] = round(float(df[kw].mean()), 2)
                else:
                    print(f"    ⚠ Column '{kw}' not found in response")
                    averages[name] = 0

            return averages

        except Exception as e:
            print(f"    ✖ Error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_DELAY * (attempt + 1)
                print(f"    Waiting {wait}s before retry...")
                time.sleep(wait)
            else:
                print("    ✖ All retries exhausted for this batch.")
                return None

    return None


def fetch_related_queries(pytrends_client, category, query):
    """Fetch related/rising queries for a single category."""
    try:
        pytrends_client.build_payload([query], timeframe=TIMEFRAME, geo=GEO)
        related = pytrends_client.related_queries()

        result = {"rising": [], "top": []}
        if query in related:
            rising_df = related[query].get("rising")
            top_df = related[query].get("top")

            if rising_df is not None and not rising_df.empty:
                result["rising"] = rising_df.head(5).to_dict("records")
            if top_df is not None and not top_df.empty:
                result["top"] = top_df.head(5).to_dict("records")

        return result
    except Exception as e:
        print(f"    ⚠ Related queries failed for {category}: {e}")
        return {"rising": [], "top": []}


def normalize_all_batches(batch_results):
    """Normalize all batch scores relative to batch 1 using the shared anchor.

    Google Trends gives relative scores (0-100) within each batch.
    The anchor appears in every batch, so we scale all batches to batch 1's scale.
    """
    if not batch_results:
        return {}

    # Batch 1 anchor value is the reference
    anchor_ref = batch_results[0].get(ANCHOR_CATEGORY, 0)
    if anchor_ref == 0:
        print("  ⚠ Anchor has zero interest in batch 1 — using raw scores")
        anchor_ref = 1  # prevent division by zero

    combined = {}
    for batch_idx, batch_avgs in enumerate(batch_results):
        anchor_val = batch_avgs.get(ANCHOR_CATEGORY, 0)
        scale = anchor_ref / anchor_val if anchor_val > 0 else 1.0

        if batch_idx > 0:
            print(f"    Scale factor for batch {batch_idx + 1}: {scale:.3f} "
                  f"(anchor={anchor_val:.2f} vs ref={anchor_ref:.2f})")

        for name, val in batch_avgs.items():
            if name == ANCHOR_CATEGORY and batch_idx > 0:
                continue  # Already in batch 1
            combined[name] = round(val * scale, 2)

    return combined


def scale_to_100(raw_scores):
    """Scale normalized scores so the max is ~95 (0-100 range)."""
    max_val = max(raw_scores.values()) if raw_scores else 1
    if max_val == 0:
        return {k: 50 for k in raw_scores}  # Fallback

    return {
        name: max(5, min(100, round((val / max_val) * 95)))
        for name, val in raw_scores.items()
    }


# ── Output ────────────────────────────────────────────────────────────

def write_to_firestore(db, trends_data, raw_scores, scaled_scores, related_queries):
    """Write trends data to Firestore demand_intel/google_trends."""
    now = datetime.utcnow()
    doc_data = {
        "scrapedAt": now.isoformat() + "Z",
        "scrapedBy": "scrape-google-trends.py",
        "timeframe": TIMEFRAME,
        "geo": GEO or "Worldwide",
        "categoryCount": len(scaled_scores),
        "categoryTrends": {
            name: {
                "rawInterest": raw_scores.get(name, 0),
                "scaledScore": scaled_scores.get(name, 50),
            }
            for name in scaled_scores
        },
        "relatedQueries": related_queries,
        "anchor": {
            "category": ANCHOR_CATEGORY,
            "query": ANCHOR_QUERY,
        },
    }

    # Write latest
    db.document("demand_intel/google_trends").set(doc_data)
    print(f"  ✅ Written to Firestore: demand_intel/google_trends")

    # Write historical snapshot
    date_str = now.strftime("%Y-%m-%d")
    db.document(f"demand_intel/trends_history_{date_str}").set(doc_data)
    print(f"  ✅ Written to Firestore: demand_intel/trends_history_{date_str}")


def save_local_report(raw_scores, scaled_scores, batch_results, related_queries):
    """Save detailed local JSON report."""
    os.makedirs(REPORT_DIR, exist_ok=True)

    report = {
        "generated_at": datetime.now().isoformat(),
        "timeframe": TIMEFRAME,
        "geo": GEO or "Worldwide",
        "category_count": len(scaled_scores),
        "raw_normalized_scores": raw_scores,
        "scaled_scores_0_100": scaled_scores,
        "batch_results": [
            {f"batch_{i+1}": batch}
            for i, batch in enumerate(batch_results)
        ],
        "related_queries": related_queries,
        "search_terms": CATEGORY_QUERIES,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"  ✅ Saved local report: {REPORT_PATH}")


def print_results_table(scaled_scores, raw_scores):
    """Print a formatted results table."""
    # Sort by scaled score descending
    sorted_cats = sorted(scaled_scores.items(), key=lambda x: x[1], reverse=True)

    print("\n┌──────────────────────────┬────────────┬──────────────┐")
    print("│ Category                 │ Score 0-100│ Raw Interest │")
    print("├──────────────────────────┼────────────┼──────────────┤")
    for name, score in sorted_cats:
        raw = raw_scores.get(name, 0)
        bar = "█" * (score // 5) + "░" * (20 - score // 5)
        print(f"│ {name:<24} │ {score:>10} │ {raw:>12.2f} │")
    print("└──────────────────────────┴────────────┴──────────────┘")


# ── Main ──────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  📊 UE5 Google Trends Scraper — All 18 Categories")
    print("=" * 60)
    print(f"  Timeframe: {TIMEFRAME}")
    print(f"  Geo:       {GEO or 'Worldwide'}")
    print(f"  Categories: {len(CATEGORY_QUERIES)}")
    print()

    # Validate benchmarks file exists
    if not os.path.exists(BENCHMARKS_PATH):
        print(f"  ⚠ Benchmarks file not found: {BENCHMARKS_PATH}")
        print("    Using built-in category list.")

    # Init Firebase (optional)
    db = init_firebase()

    # Init pytrends
    pytrends = TrendReq(hl="en-US", tz=300, retries=0, backoff_factor=0)

    # Build batches
    all_categories = list(CATEGORY_QUERIES.keys())
    batches = build_batches(all_categories)
    print(f"  Batches needed: {len(batches)} "
          f"(4 categories + anchor per batch)\n")

    # Fetch all batches
    batch_results = []
    for i, batch in enumerate(batches):
        result = fetch_batch(pytrends, batch, i + 1, len(batches))
        if result is None:
            print(f"  ✖ Batch {i + 1} failed. Skipping.")
            # Use zeros for failed categories
            result = {name: 0 for name in batch}
        batch_results.append(result)
        print(f"    ✓ Raw averages: {result}")

        # Pause between batches to avoid rate limiting
        if i < len(batches) - 1:
            print(f"\n  ⏳ Waiting {BATCH_PAUSE}s between batches...\n")
            time.sleep(BATCH_PAUSE)

    # Normalize across batches
    print("\n🔄 Normalizing across batches...")
    normalized = normalize_all_batches(batch_results)
    print(f"  Combined scores: {len(normalized)} categories")

    # Scale to 0-100
    print("\n📐 Scaling to 0-100 range...")
    scaled = scale_to_100(normalized)

    # Fetch related/rising queries for top 5 categories
    print("\n🔍 Fetching related queries for top categories...")
    sorted_by_score = sorted(scaled.items(), key=lambda x: x[1], reverse=True)
    top_categories = [name for name, _ in sorted_by_score[:5]]
    related_queries = {}

    for i, cat in enumerate(top_categories):
        query = CATEGORY_QUERIES[cat]
        print(f"  [{i+1}/5] {cat}: '{query}'")
        related_queries[cat] = fetch_related_queries(pytrends, cat, query)
        if i < len(top_categories) - 1:
            time.sleep(5)  # Brief pause

    # Print results
    print_results_table(scaled, normalized)

    # Save locally (always)
    save_local_report(normalized, scaled, batch_results, related_queries)

    # Write to Firestore (if available)
    if db:
        print("\n📤 Writing to Firestore...")
        write_to_firestore(db, batch_results, normalized, scaled, related_queries)

    print("\n🎉 Done! Google Trends data scraped for all 18 categories.")
    if db:
        print("   Firestore: demand_intel/google_trends")
    print(f"   Local: {REPORT_PATH}")


if __name__ == "__main__":
    main()
