"""Reddit PRAW deep-sentiment scraper for UE5 tutorial demand intelligence.

Uses Reddit's authenticated PRAW API (vs the public JSON endpoint) to perform
deeper comment-level sentiment analysis on r/unrealengine tutorial requests.

For each of the 18 UE5 taxonomy categories:
  1. Search r/unrealengine for tutorial/learning posts
  2. Collect top-level comments on top results
  3. Compute keyword-based sentiment (positive/negative/neutral)
  4. Extract frequently-requested subtopics via keyword frequency
  5. Write results to Firestore demand_intel/reddit_sentiment

Environment Variables:
    REDDIT_CLIENT_ID       — Reddit API client ID
    REDDIT_CLIENT_SECRET   — Reddit API client secret
    REDDIT_USER_AGENT      — e.g. "python:ue5-demand-intel:v1.0 (by /u/youruser)"
    FIREBASE_SERVICE_ACCOUNT — Base64-encoded Firebase service account JSON (optional)

Usage:
    pip install praw firebase-admin google-cloud-firestore
    python scripts/scrape-reddit-praw.py
"""

import json
import os
import sys
import base64
import re
from datetime import datetime, timezone
from collections import Counter

try:
    import praw
except ImportError:
    print("ERROR: praw is not installed. Run: pip install praw")
    sys.exit(1)


# ── Configuration ─────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
REPORT_DIR = os.path.join(SCRIPT_DIR, "output")
REPORT_PATH = os.path.join(REPORT_DIR, "reddit_sentiment_report.json")

SUBREDDIT = "unrealengine"
POST_LIMIT = 15          # Posts per category search
COMMENT_LIMIT = 30       # Top-level comments per post
MAX_CATEGORIES = 18

# Search queries per category — tuned for tutorial/learning requests
CATEGORY_QUERIES = {
    "Blueprints":          "blueprints tutorial help learn",
    "Niagara":             "niagara particles tutorial help",
    "Materials":           "materials shader tutorial help",
    "Animation":           "animation tutorial help learn",
    "Lighting":            "lighting lumen tutorial help",
    "UI/UMG":              "UMG UI widget tutorial help",
    "Landscape":           "landscape world partition tutorial",
    "Audio":               "audio metasounds tutorial help",
    "AI":                  "AI behavior tree state tree tutorial",
    "Networking":          "multiplayer replication networking tutorial",
    "C++":                 "C++ unreal tutorial help learn",
    "Physics":             "physics chaos destruction tutorial",
    "Rendering":           "nanite rendering optimization tutorial",
    "MetaHumans":          "metahuman tutorial help learn",
    "Optimization":        "optimization profiling performance tutorial",
    "Virtual Production":  "virtual production nDisplay LED tutorial",
    "Level Design":        "level design blockout tutorial help",
    "Gameplay Framework":  "gameplay framework gamemode tutorial",
}

# ── Sentiment Keywords ────────────────────────────────────────────────
POSITIVE_KEYWORDS = {
    "great", "helpful", "amazing", "excellent", "perfect", "love",
    "recommend", "works", "solved", "thanks", "thank you", "useful",
    "easy", "clear", "intuitive", "finally", "understood", "awesome",
}

NEGATIVE_KEYWORDS = {
    "confused", "frustrating", "broken", "bug", "stuck", "error",
    "crash", "problem", "issue", "wrong", "bad", "terrible",
    "impossible", "outdated", "deprecated", "doesn't work", "help",
    "struggling", "can't", "cannot", "failed", "failing", "worst",
}

NEUTRAL_THRESHOLD = 0  # Score of 0 = neutral


# ── Firebase Setup ────────────────────────────────────────────────────

def init_firebase():
    """Initialize Firebase Admin SDK. Returns Firestore db or None."""
    sa_b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not sa_b64:
        print("  ℹ  FIREBASE_SERVICE_ACCOUNT not set — local output only")
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


# ── Reddit PRAW Setup ─────────────────────────────────────────────────

def init_reddit():
    """Initialize authenticated PRAW Reddit client."""
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    user_agent = os.environ.get(
        "REDDIT_USER_AGENT",
        "python:ue5-demand-intel:v1.0 (by /u/ue5scraper)"
    )

    if not client_id or not client_secret:
        print("ERROR: REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set.")
        print("  Create an app at https://www.reddit.com/prefs/apps")
        sys.exit(1)

    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )


# ── Sentiment Analysis ────────────────────────────────────────────────

def compute_sentiment(text):
    """Simple keyword-based sentiment scoring.

    Returns:
        score (int):   Positive score = positive sentiment, negative = negative
        label (str):   'positive', 'negative', or 'neutral'
        keywords (list): Matched sentiment keywords
    """
    text_lower = text.lower()
    words = set(re.findall(r'\b\w+\b', text_lower))

    pos_matches = words & POSITIVE_KEYWORDS
    neg_matches = words & NEGATIVE_KEYWORDS

    score = len(pos_matches) - len(neg_matches)

    if score > NEUTRAL_THRESHOLD:
        label = "positive"
    elif score < NEUTRAL_THRESHOLD:
        label = "negative"
    else:
        label = "neutral"

    return score, label, list(pos_matches | neg_matches)


def extract_topic_keywords(comments, category):
    """Extract frequently-mentioned topic keywords from comments."""
    # Common UE5 terms we want to count as subtopic mentions
    ue5_terms = {
        "nanite", "lumen", "niagara", "metahuman", "pcg", "chaos",
        "blueprint", "c++", "cpp", "material", "shader", "animation",
        "sequencer", "control rig", "retarget", "ik", "state tree",
        "behavior tree", "navmesh", "perception", "eqs",
        "replication", "rpc", "dedicated server", "prediction",
        "umg", "slate", "common ui", "widget",
        "metasound", "audio", "quartz",
        "world partition", "level streaming", "foliage",
        "virtual shadow", "ray tracing", "path tracing",
        "motion matching", "pose search", "montage",
        "gas", "gameplay ability", "enhanced input",
        "ndisplay", "live link", "composure",
        "profiling", "insights", "draw call", "lod",
    }

    word_counts = Counter()
    for comment in comments:
        text_lower = comment.lower()
        for term in ue5_terms:
            if term in text_lower:
                word_counts[term] += 1

    # Return top 10 most-mentioned terms
    return [
        {"term": term, "mentions": count}
        for term, count in word_counts.most_common(10)
        if count >= 2  # Only include terms mentioned 2+ times
    ]


# ── Scraping ──────────────────────────────────────────────────────────

def scrape_category(reddit, category, query):
    """Scrape Reddit for a single category's tutorial requests."""
    print(f"  📡 {category}: '{query}'")

    subreddit = reddit.subreddit(SUBREDDIT)
    results = {
        "postCount": 0,
        "commentCount": 0,
        "totalUpvotes": 0,
        "avgUpvotes": 0,
        "sentimentBreakdown": {"positive": 0, "negative": 0, "neutral": 0},
        "avgSentimentScore": 0,
        "topPainPoints": [],
        "frequentTopics": [],
        "samplePosts": [],
    }

    all_comments_text = []
    sentiment_scores = []
    pain_points = []

    try:
        posts = list(subreddit.search(query, sort="relevance", time_filter="year", limit=POST_LIMIT))
    except Exception as e:
        print(f"    ✖ Search failed: {e}")
        return results

    results["postCount"] = len(posts)

    for post in posts:
        results["totalUpvotes"] += post.score

        # Collect sample posts
        if len(results["samplePosts"]) < 3:
            results["samplePosts"].append({
                "title": post.title,
                "score": post.score,
                "numComments": post.num_comments,
                "url": f"https://reddit.com{post.permalink}",
                "created": datetime.fromtimestamp(
                    post.created_utc, tz=timezone.utc
                ).isoformat(),
            })

        # Analyze comments
        post.comment_sort = "top"
        post.comments.replace_more(limit=0)  # Skip "load more" links
        comments = list(post.comments)[:COMMENT_LIMIT]

        for comment in comments:
            if not hasattr(comment, "body"):
                continue
            body = comment.body
            if len(body) < 10:
                continue

            results["commentCount"] += 1
            all_comments_text.append(body)

            score, label, keywords = compute_sentiment(body)
            sentiment_scores.append(score)
            results["sentimentBreakdown"][label] += 1

            # Collect negative comments as potential pain points
            if label == "negative" and score <= -2:
                pain_points.append({
                    "text": body[:200],
                    "score": score,
                    "keywords": keywords,
                    "postTitle": post.title,
                    "url": f"https://reddit.com{comment.permalink}",
                })

    # Compute averages
    if results["postCount"] > 0:
        results["avgUpvotes"] = round(results["totalUpvotes"] / results["postCount"], 1)

    if sentiment_scores:
        results["avgSentimentScore"] = round(
            sum(sentiment_scores) / len(sentiment_scores), 2
        )

    # Top pain points (most negative)
    pain_points.sort(key=lambda x: x["score"])
    results["topPainPoints"] = pain_points[:5]

    # Frequent UE5 topic keywords from comments
    results["frequentTopics"] = extract_topic_keywords(all_comments_text, category)

    print(f"    ✓ {results['postCount']} posts, {results['commentCount']} comments, "
          f"sentiment avg={results['avgSentimentScore']:.2f}")

    return results


# ── Output ────────────────────────────────────────────────────────────

def write_to_firestore(db, category_results):
    """Write aggregated sentiment data to Firestore."""
    now = datetime.now(timezone.utc)
    doc_data = {
        "scrapedAt": now.isoformat(),
        "scrapedBy": "scrape-reddit-praw.py",
        "subreddit": SUBREDDIT,
        "categoryCount": len(category_results),
        "categories": category_results,
    }

    db.document("demand_intel/reddit_sentiment").set(doc_data)
    print(f"  ✅ Written to Firestore: demand_intel/reddit_sentiment")

    date_str = now.strftime("%Y-%m-%d")
    db.document(f"demand_intel/reddit_sentiment_{date_str}").set(doc_data)
    print(f"  ✅ Written to Firestore: demand_intel/reddit_sentiment_{date_str}")


def save_local_report(category_results):
    """Save detailed local JSON report."""
    os.makedirs(REPORT_DIR, exist_ok=True)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "subreddit": SUBREDDIT,
        "category_count": len(category_results),
        "categories": category_results,
        "summary": {
            "total_posts": sum(c["postCount"] for c in category_results.values()),
            "total_comments": sum(c["commentCount"] for c in category_results.values()),
            "overall_sentiment": round(
                sum(c["avgSentimentScore"] for c in category_results.values())
                / max(1, len(category_results)),
                2,
            ),
        },
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"  ✅ Saved local report: {REPORT_PATH}")


def print_results_table(category_results):
    """Print formatted results table."""
    sorted_cats = sorted(
        category_results.items(),
        key=lambda x: x[1]["avgSentimentScore"],
        reverse=True,
    )

    print("\n┌──────────────────────────┬────────┬──────────┬───────────┐")
    print("│ Category                 │ Posts  │ Comments │ Sentiment │")
    print("├──────────────────────────┼────────┼──────────┼───────────┤")
    for name, data in sorted_cats:
        sentiment = data["avgSentimentScore"]
        indicator = "🟢" if sentiment > 0 else "🔴" if sentiment < 0 else "⚪"
        print(
            f"│ {indicator} {name:<22} │ {data['postCount']:>6} │ "
            f"{data['commentCount']:>8} │ {sentiment:>+8.2f} │"
        )
    print("└──────────────────────────┴────────┴──────────┴───────────┘")


# ── Main ──────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  🗣️ Reddit PRAW Deep Sentiment Scraper — r/unrealengine")
    print("=" * 60)
    print(f"  Categories: {len(CATEGORY_QUERIES)}")
    print(f"  Posts per category: {POST_LIMIT}")
    print(f"  Comment depth: {COMMENT_LIMIT} per post\n")

    # Init Reddit
    reddit = init_reddit()
    print(f"  ✓ Reddit authenticated as: {reddit.user.me() or 'read-only'}\n")

    # Init Firebase (optional)
    db = init_firebase()

    # Scrape all categories
    category_results = {}
    for i, (category, query) in enumerate(CATEGORY_QUERIES.items()):
        print(f"\n[{i + 1}/{len(CATEGORY_QUERIES)}]")
        category_results[category] = scrape_category(reddit, category, query)

    # Print results
    print_results_table(category_results)

    # Save locally
    save_local_report(category_results)

    # Write to Firestore
    if db:
        print("\n📤 Writing to Firestore...")
        write_to_firestore(db, category_results)

    print(f"\n🎉 Done! Reddit PRAW sentiment scraped for {len(category_results)} categories.")
    if db:
        print("   Firestore: demand_intel/reddit_sentiment")
    print(f"   Local: {REPORT_PATH}")


if __name__ == "__main__":
    main()
