"""Fetch Google Trends data to update UE5 skill demand benchmarks.

Uses pytrends (FREE, no API key) to get real search interest data for
8 UE5 skill categories and writes updated demand_benchmarks.json.

Usage:
    pip install pytrends
    python scripts/fetch_demand_trends.py

Google Trends returns relative interest (0–100) within each query batch.
We use 'unreal engine blueprints' as an anchor in both batches so we can
normalize across the full set of 8 skills.
"""

import json
import os
import sys
import time
from datetime import datetime

try:
    from pytrends.request import TrendReq
except ImportError:
    print("ERROR: pytrends is not installed. Run: pip install pytrends")
    sys.exit(1)

# ── Configuration ─────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

BENCHMARKS_PATH = os.path.join(ROOT_DIR, "path-builder", "src", "data", "demand_benchmarks.json")
REPORT_DIR = os.path.join(SCRIPT_DIR, "output")
REPORT_PATH = os.path.join(REPORT_DIR, "trends_report.json")

TIMEFRAME = "today 12-m"  # Last 12 months for stable averages
GEO = ""  # Worldwide (empty = global)
MAX_RETRIES = 3
RETRY_DELAY = 30  # seconds between retries

# Search terms per skill category
# Google Trends allows max 5 terms per query, so we split into 2 batches
# with "unreal engine blueprints" as the shared anchor for normalization.
SKILL_QUERIES = {
    "Blueprints":  "unreal engine blueprints",
    "Niagara":     "unreal engine niagara",
    "Materials":   "unreal engine materials",
    "Animation":   "unreal engine animation",
    "Lighting":    "unreal engine lighting",
    "UI/UMG":      "unreal engine UMG",
    "Landscape":   "unreal engine landscape",
    "Audio":       "unreal engine audio",
}

# Anchor keyword present in BOTH batches for cross-batch normalization
ANCHOR = "unreal engine blueprints"

# Batch 1: Blueprints (anchor), Niagara, Materials, Animation, Lighting
BATCH_1 = ["Blueprints", "Niagara", "Materials", "Animation", "Lighting"]
# Batch 2: Blueprints (anchor), UI/UMG, Landscape, Audio
BATCH_2 = ["Blueprints", "UI/UMG", "Landscape", "Audio"]


def fetch_batch(pytrends, skill_names, attempt_label=""):
    """Fetch Google Trends interest-over-time for a batch of skill keywords."""
    keywords = [SKILL_QUERIES[name] for name in skill_names]
    print(f"  Querying: {keywords} {attempt_label}")

    for attempt in range(MAX_RETRIES):
        try:
            pytrends.build_payload(keywords, timeframe=TIMEFRAME, geo=GEO)
            df = pytrends.interest_over_time()

            if df.empty:
                print(f"  ⚠ Empty response, retrying ({attempt + 1}/{MAX_RETRIES})...")
                time.sleep(RETRY_DELAY)
                continue

            # Calculate average interest per keyword over the timeframe
            averages = {}
            for name in skill_names:
                kw = SKILL_QUERIES[name]
                if kw in df.columns:
                    averages[name] = round(float(df[kw].mean()), 2)
                else:
                    print(f"  ⚠ Column '{kw}' not found in response")
                    averages[name] = 0

            return averages

        except Exception as e:
            print(f"  ✖ Error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_DELAY * (attempt + 1)
                print(f"  Waiting {wait}s before retry...")
                time.sleep(wait)
            else:
                print("  ✖ All retries exhausted for this batch.")
                return None

    return None


def normalize_batches(batch1_avgs, batch2_avgs):
    """Normalize batch 2 values relative to batch 1 using the anchor keyword.

    Google Trends gives relative scores (0–100) within each batch.
    The anchor (Blueprints) appears in both batches, so we can scale
    batch 2 to be on the same scale as batch 1.
    """
    anchor_b1 = batch1_avgs.get("Blueprints", 0)
    anchor_b2 = batch2_avgs.get("Blueprints", 0)

    if anchor_b2 == 0:
        print("  ⚠ Anchor has zero interest in batch 2 — cannot normalize")
        scale = 1.0
    else:
        scale = anchor_b1 / anchor_b2

    print(f"  Cross-batch scale factor: {scale:.3f} (anchor B1={anchor_b1}, B2={anchor_b2})")

    # Combine: use batch 1 values directly, scale batch 2 values
    combined = {}
    for name, val in batch1_avgs.items():
        combined[name] = val

    for name, val in batch2_avgs.items():
        if name == "Blueprints":
            continue  # Already in batch 1
        combined[name] = round(val * scale, 2)

    return combined


def scale_to_100(raw_scores):
    """Scale raw averaged interest scores so the max is ~100.

    This keeps the values in the same 0–100 range expected by
    demand_benchmarks.json and the UI components.
    """
    max_val = max(raw_scores.values()) if raw_scores else 1
    if max_val == 0:
        return {k: 50 for k in raw_scores}  # Fallback

    scaled = {}
    for name, val in raw_scores.items():
        # Scale so max ≈ 95 (leave headroom)
        scaled[name] = max(5, min(100, round((val / max_val) * 95)))

    return scaled


def load_existing_benchmarks():
    """Load the current demand_benchmarks.json to preserve old data."""
    if os.path.exists(BENCHMARKS_PATH):
        with open(BENCHMARKS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_benchmarks(benchmarks, raw_scores, batch1_raw, batch2_raw):
    """Write updated demand_benchmarks.json and a detailed report."""
    existing = load_existing_benchmarks()

    # Build the updated benchmarks file
    now = datetime.now()
    quarter = (now.month - 1) // 3 + 1
    output = {
        "version": f"Q{quarter}_{now.year}",
        "updated_at": datetime.now().strftime("%Y-%m-%d"),
        "source": "Google Trends via pytrends (12-month average)",
        "notes": (
            "Auto-generated from Google Trends search interest data. "
            "Values are relative (0–100), scaled so the highest-demand skill ≈ 95. "
            "Re-run with: python scripts/fetch_demand_trends.py"
        ),
        "benchmarks": benchmarks,
    }

    # Preserve old benchmarks for comparison
    if "benchmarks" in existing:
        output["previous_benchmarks"] = {
            "version": existing.get("version", "unknown"),
            "source": existing.get("source", "unknown"),
            "values": existing["benchmarks"],
        }

    with open(BENCHMARKS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"\n✅ Updated {BENCHMARKS_PATH}")

    # Save detailed report
    os.makedirs(REPORT_DIR, exist_ok=True)
    report = {
        "generated_at": datetime.now().isoformat(),
        "timeframe": TIMEFRAME,
        "geo": GEO or "Worldwide",
        "raw_batch1_averages": batch1_raw,
        "raw_batch2_averages": batch2_raw,
        "normalized_scores": raw_scores,
        "final_benchmarks": benchmarks,
        "previous_benchmarks": output.get("previous_benchmarks", {}),
        "search_terms": SKILL_QUERIES,
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"✅ Saved detailed report to {REPORT_PATH}")


def print_comparison(benchmarks, existing):
    """Print a comparison table of old vs new benchmarks."""
    old = existing.get("benchmarks", {})
    print("\n┌────────────────┬──────────┬──────────┬────────────┐")
    print("│ Skill          │ Old (%)  │ New (%)  │ Change     │")
    print("├────────────────┼──────────┼──────────┼────────────┤")
    for skill in ["Blueprints", "Niagara", "Materials", "Animation",
                   "Lighting", "UI/UMG", "Landscape", "Audio"]:
        old_val = old.get(skill, "—")
        new_val = benchmarks.get(skill, "—")
        if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
            diff = new_val - old_val
            arrow = "↑" if diff > 0 else "↓" if diff < 0 else "→"
            change = f"{arrow} {abs(diff):+.0f}%"
        else:
            change = "  new"
        print(f"│ {skill:<14} │ {str(old_val):>8} │ {str(new_val):>8} │ {change:>10} │")
    print("└────────────────┴──────────┴──────────┴────────────┘")


def main():
    print("=" * 60)
    print("  📊 UE5 Skill Demand — Google Trends Benchmark Updater")
    print("=" * 60)
    print(f"  Timeframe: {TIMEFRAME}")
    print(f"  Geo: {GEO or 'Worldwide'}")
    print(f"  Skills: {len(SKILL_QUERIES)}")
    print()

    pytrends = TrendReq(hl="en-US", tz=300, retries=0, backoff_factor=0)

    # Fetch batch 1
    print("📡 Batch 1/2...")
    batch1_raw = fetch_batch(pytrends, BATCH_1, "(anchor + 4 skills)")
    if batch1_raw is None:
        print("✖ Batch 1 failed. Cannot continue.")
        sys.exit(1)
    print(f"  ✓ Batch 1 raw averages: {batch1_raw}")

    # Pause between batches to avoid rate limiting
    print("\n⏳ Waiting 15s between batches (rate limit avoidance)...")
    time.sleep(15)

    # Fetch batch 2
    print("📡 Batch 2/2...")
    batch2_raw = fetch_batch(pytrends, BATCH_2, "(anchor + 3 skills)")
    if batch2_raw is None:
        print("✖ Batch 2 failed. Cannot continue.")
        sys.exit(1)
    print(f"  ✓ Batch 2 raw averages: {batch2_raw}")

    # Normalize across batches
    print("\n🔄 Normalizing across batches...")
    normalized = normalize_batches(batch1_raw, batch2_raw)
    print(f"  Combined scores: {normalized}")

    # Scale to 0–100
    print("\n📐 Scaling to 0–100 range...")
    benchmarks = scale_to_100(normalized)
    print(f"  Final benchmarks: {benchmarks}")

    # Load existing for comparison
    existing = load_existing_benchmarks()

    # Print comparison
    print_comparison(benchmarks, existing)

    # Save
    save_benchmarks(benchmarks, normalized, batch1_raw, batch2_raw)

    print("\n🎉 Done! The demand benchmarks have been updated with real Google Trends data.")
    print("   Restart your dev server to see changes in the UI.")


if __name__ == "__main__":
    main()
