"""Tag audit script for governance workflow.

Analyzes tag database and generates audit report.
Per NISO Z39.19: Merge, Purge, Split analysis.
"""

import json
from datetime import datetime
from pathlib import Path

TAGS_FILE = Path("tags/tags.json")
CANDIDATES_FILE = Path("tags/tag_candidates.json")
REPORT_FILE = Path("audit_report.md")


def load_tags() -> list[dict]:
    """Load tags from tags.json."""
    if TAGS_FILE.exists():
        with open(TAGS_FILE) as f:
            return json.load(f).get("tags", [])
    return []


def load_candidates() -> list[dict]:
    """Load candidates from tag_candidates.json."""
    if CANDIDATES_FILE.exists():
        with open(CANDIDATES_FILE) as f:
            return json.load(f).get("candidates", [])
    return []


def analyze_tags(tags: list[dict]) -> dict:
    """Analyze tags for governance issues.

    Returns dict with:
    - merge_candidates: Similar tags that could be merged
    - purge_candidates: Unused/obsolete tags
    - split_candidates: Overly broad tags
    """
    issues = {
        "merge_candidates": [],
        "purge_candidates": [],
        "split_candidates": [],
        "missing_synonyms": [],
        "deprecated_count": 0,
    }

    # Check for deprecated tags
    for tag in tags:
        status = tag.get("governance", {}).get("status", "active")
        if status == "deprecated":
            issues["deprecated_count"] += 1
            issues["purge_candidates"].append(tag["tag_id"])

        # Check for missing synonyms
        synonyms = tag.get("synonyms", [])
        if len(synonyms) < 2:
            issues["missing_synonyms"].append(tag["tag_id"])

    # Find similar tag names (potential merges)
    tag_ids = [t["tag_id"] for t in tags]
    for i, tag1 in enumerate(tag_ids):
        for tag2 in tag_ids[i + 1:]:
            # Simple similarity: share same base name
            base1 = tag1.split(".")[-1]
            base2 = tag2.split(".")[-1]
            if base1 == base2 and tag1 != tag2:
                issues["merge_candidates"].append((tag1, tag2))

    return issues


def generate_report(tags: list[dict], candidates: list[dict], issues: dict) -> str:
    """Generate markdown audit report."""
    report = f"""# Tag Governance Audit Report

**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}

## Summary

| Metric | Count |
|--------|-------|
| Total Tags | {len(tags)} |
| Pending Candidates | {len([c for c in candidates if c.get('status') == 'candidate'])} |
| Deprecated Tags | {issues['deprecated_count']} |
| Tags Missing Synonyms | {len(issues['missing_synonyms'])} |

## Action Items

### 🔀 Merge Candidates
Tags with similar names that may need consolidation:

"""
    if issues["merge_candidates"]:
        for tag1, tag2 in issues["merge_candidates"]:
            report += f"- `{tag1}` ↔ `{tag2}`\n"
    else:
        report += "*None found*\n"

    report += """
### 🗑️ Purge Candidates
Deprecated or unused tags:

"""
    if issues["purge_candidates"]:
        for tag_id in issues["purge_candidates"]:
            report += f"- `{tag_id}`\n"
    else:
        report += "*None found*\n"

    report += """
### ⚠️ Tags Missing Synonyms
Tags that may need synonym expansion:

"""
    if issues["missing_synonyms"][:10]:  # Show first 10
        for tag_id in issues["missing_synonyms"][:10]:
            report += f"- `{tag_id}`\n"
        if len(issues["missing_synonyms"]) > 10:
            report += f"\n*...and {len(issues['missing_synonyms']) - 10} more*\n"
    else:
        report += "*None found*\n"

    report += """
## Pending Candidates

"""
    pending = [c for c in candidates if c.get("status") == "candidate"]
    if pending[:10]:
        for c in pending[:10]:
            report += f"- `{c['term']}` → `{c['suggested_tag_id']}` ({c.get('frequency', 0)}x)\n"
    else:
        report += "*No pending candidates*\n"

    return report


def main():
    """Run audit and generate report."""
    print("🔍 Running tag audit...")

    tags = load_tags()
    candidates = load_candidates()
    issues = analyze_tags(tags)

    report = generate_report(tags, candidates, issues)

    with open(REPORT_FILE, "w") as f:
        f.write(report)

    print(f"✅ Report saved to {REPORT_FILE}")

    # Set environment variable for workflow
    total_issues = (
        len(issues["merge_candidates"])
        + len(issues["purge_candidates"])
        + len(issues["missing_synonyms"])
    )

    if total_issues > 0:
        print(f"⚠️ Found {total_issues} governance issues")
        # Signal to workflow
        import os
        if "GITHUB_ENV" in os.environ:
            with open(os.environ["GITHUB_ENV"], "a") as f:
                f.write("AUDIT_ISSUES=true\n")


if __name__ == "__main__":
    main()
