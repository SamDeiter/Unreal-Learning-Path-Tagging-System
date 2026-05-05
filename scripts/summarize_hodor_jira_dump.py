"""Summarize a raw Hodor jira_search_issues dump.

The raw file is the MCP tool response: a JSON array [{type, text}] where
text is itself a JSON-encoded Jira search response.
"""

import json
import sys
from collections import Counter
from pathlib import Path


def load_issues(path: Path) -> list[dict]:
    outer = json.loads(path.read_text(encoding="utf-8"))
    inner = json.loads(outer[0]["text"])
    return inner.get("issues", [])


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: summarize_hodor_jira_dump.py <raw_dump.json>", file=sys.stderr)
        sys.exit(1)
    path = Path(sys.argv[1])
    issues = load_issues(path)

    projects: Counter[str] = Counter()
    components: Counter[str] = Counter()
    issuetypes: Counter[str] = Counter()
    labels: Counter[str] = Counter()
    has_desc = 0
    samples: list[tuple[str, str]] = []

    for issue in issues:
        f = issue["fields"]
        # Project key isn't in fields when not requested — derive from issue key
        proj_key = issue["key"].split("-")[0]
        projects[proj_key] += 1
        if f.get("issuetype"):
            issuetypes[f["issuetype"]["name"]] += 1
        for c in f.get("components") or []:
            components[c["name"]] += 1
        for lbl in f.get("labels") or []:
            labels[lbl] += 1
        if f.get("description"):
            has_desc += 1
        samples.append((issue["key"], f.get("summary", "")))

    print(f"Total issues: {len(issues)}")
    print(f"With description: {has_desc}")
    print()
    print("By project:")
    for k, v in projects.most_common():
        print(f"  {k}: {v}")
    print()
    print("Issue types:")
    for k, v in issuetypes.most_common():
        print(f"  {k}: {v}")
    print()
    print("Top 10 components:")
    for k, v in components.most_common(10):
        print(f"  {v:>3}  {k}")
    print()
    print("Top 15 labels:")
    for k, v in labels.most_common(15):
        print(f"  {v:>3}  {k}")
    print()
    print("Summaries:")
    for key, summary in samples:
        print(f"  {key}: {summary[:110]}")


if __name__ == "__main__":
    main()
