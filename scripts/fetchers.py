"""Unified Content Fetcher Infrastructure.

Phase 8D: Standardized Python fetcher layer that provides a unified
`RawContent` interface for all external content sources.

Each fetcher returns a list of RawContent dicts:
  {
    "source": "google_trends" | "epic_docs" | "youtube",
    "type": "insight" | "article" | "video",
    "title": str,
    "description": str,
    "url": str | None,
    "metadata": dict,
    "fetched_at": str (ISO timestamp)
  }

Usage:
  from scripts.fetchers import run_all_fetchers, fetch_google_trends
  results = run_all_fetchers()
"""

import json
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "path-builder" / "src" / "data"


def _make_raw_content(source, content_type, title, description, url=None, metadata=None):
    """Create a standardized RawContent dict."""
    return {
        "source": source,
        "type": content_type,
        "title": title,
        "description": description,
        "url": url,
        "metadata": metadata or {},
        "fetched_at": datetime.now().isoformat(),
    }


# ============================================================================
# Google Trends Fetcher
# ============================================================================

def fetch_google_trends(keywords=None, max_retries=3, retry_delay=60):
    """Fetch Google Trends data using pytrends.
    Returns list of RawContent dicts.
    """
    if keywords is None:
        keywords = ["unreal engine 5", "metahuman", "nanite"]

    try:
        from pytrends.request import TrendReq
    except ImportError:
        print("⚠️ pytrends not installed — skipping Google Trends")
        return [_make_raw_content(
            "google_trends", "insight",
            "Trends data unavailable",
            "pytrends package not installed. Run: pip install pytrends",
            metadata={"priority": "low"},
        )]

    results = []
    pytrends = TrendReq(hl="en-US", tz=360, retries=2, backoff_factor=0.5)

    for attempt in range(max_retries):
        try:
            print(f"  📊 Google Trends attempt {attempt + 1}/{max_retries}...")
            pytrends.build_payload(keywords, timeframe="today 3-m")
            interest = pytrends.interest_over_time()

            if not interest.empty:
                for keyword in keywords:
                    if keyword not in interest.columns:
                        continue
                    recent = interest[keyword].tail(4).mean()
                    older = interest[keyword].head(8).mean()

                    if older > 0:
                        change = ((recent - older) / older) * 100
                        if change > 20:
                            results.append(_make_raw_content(
                                "google_trends", "insight",
                                f"{keyword.title()} interest rising",
                                f"Search interest increased {change:.0f}% over the last 3 months.",
                                metadata={"priority": "high" if change > 50 else "medium", "change_pct": round(change, 1)},
                            ))
                        elif change < -20:
                            results.append(_make_raw_content(
                                "google_trends", "insight",
                                f"{keyword.title()} interest declining",
                                f"Search interest decreased {abs(change):.0f}% over the last 3 months.",
                                metadata={"priority": "low", "change_pct": round(change, 1)},
                            ))
            break  # Success

        except Exception as e:
            print(f"  ❌ Google Trends error: {e}")
            if attempt < max_retries - 1:
                print(f"  ⏳ Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                results.append(_make_raw_content(
                    "google_trends", "insight",
                    "Trends data unavailable",
                    "Could not fetch Google Trends data. Will retry next run.",
                    metadata={"priority": "low"},
                ))

    return results


# ============================================================================
# Stub: Epic Docs Fetcher (future)
# ============================================================================

def fetch_epic_docs():
    """Placeholder for Epic Games documentation fetcher."""
    print("  📄 Epic Docs fetcher: not yet implemented (stub)")
    return []


# ============================================================================
# Stub: YouTube Channel Fetcher (future)
# ============================================================================

def fetch_youtube_channel():
    """Placeholder for YouTube channel/video metadata fetcher."""
    print("  🎥 YouTube fetcher: not yet implemented (stub)")
    return []


# ============================================================================
# Orchestrator
# ============================================================================

_FETCHER_REGISTRY = {
    "google_trends": fetch_google_trends,
    "epic_docs": fetch_epic_docs,
    "youtube": fetch_youtube_channel,
}


def run_all_fetchers(sources=None):
    """Run all (or selected) fetchers and merge results into external_sources.json.

    Args:
        sources: list of source names to run, or None for all
    """
    to_run = sources or list(_FETCHER_REGISTRY.keys())
    all_results = []

    print(f"🔄 Running {len(to_run)} fetchers: {to_run}")
    for name in to_run:
        fetcher = _FETCHER_REGISTRY.get(name)
        if not fetcher:
            print(f"  ⚠️ Unknown fetcher: {name}")
            continue
        results = fetcher()
        all_results.extend(results)
        print(f"  ✅ {name}: {len(results)} items")

    # Merge into external_sources.json
    output_path = OUTPUT_DIR / "external_sources.json"
    if output_path.exists():
        data = json.loads(output_path.read_text(encoding="utf-8"))
    else:
        data = {"insights": [], "_meta": {}}

    # Remove previous entries from the fetched sources
    fetched_sources = {r["source"] for r in all_results}
    data["insights"] = [
        i for i in data.get("insights", [])
        if i.get("source") not in fetched_sources
        and i.get("type") != "trends"  # backward compat
    ]
    data["insights"].extend(all_results)
    data["_meta"]["lastFetched"] = datetime.now().isoformat()
    data["_meta"]["sources"] = list(fetched_sources)

    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n💾 Saved {len(all_results)} items to {output_path}")

    return all_results


if __name__ == "__main__":
    run_all_fetchers()
