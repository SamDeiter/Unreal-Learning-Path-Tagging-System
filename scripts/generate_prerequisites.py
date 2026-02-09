#!/usr/bin/env python3
"""
generate_prerequisites.py
~~~~~~~~~~~~~~~~~~~~~~~~~
Reads video_library_enriched.json and matches each course's
gemini_prerequisites text against other courses' titles and extracted_tags
to produce a concrete course→prereq_courses mapping.

Output: path-builder/src/data/course_prerequisites.json
"""

import json
import re
import os
import sys
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
LIBRARY_PATH = os.path.join(ROOT, "path-builder", "src", "data", "video_library_enriched.json")
OUTPUT_PATH = os.path.join(ROOT, "path-builder", "src", "data", "course_prerequisites.json")


def tokenize(text):
    """Lowercase, strip punctuation, split into word tokens."""
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def build_course_index(courses):
    """Build a searchable index: for each course, combine title + extracted_tags + topic into tokens."""
    index = {}
    for c in courses:
        code = c.get("code", "")
        title = c.get("title", "")
        extracted = c.get("extracted_tags", []) or []
        topic = ""
        if isinstance(c.get("tags"), dict):
            topic = c["tags"].get("topic", "")
            level = c["tags"].get("level", "")
        else:
            level = ""

        # Combine all searchable text
        bag = f"{title} {' '.join(extracted)} {topic}"
        tokens = tokenize(bag)

        index[code] = {
            "title": title,
            "tokens": tokens,
            "extracted_tags": [t.lower() for t in extracted],
            "topic": topic.lower(),
            "level": level.lower(),
            "raw_bag": bag.lower(),
        }
    return index


def score_match(prereq_text, candidate):
    """Score how well a candidate course satisfies a prerequisite text requirement."""
    prereq_tokens = tokenize(prereq_text)
    if not prereq_tokens:
        return 0

    # Remove common filler words
    filler = {"basic", "understanding", "of", "the", "and", "a", "an", "in", "with",
              "for", "to", "or", "is", "general", "knowledge", "experience",
              "familiarity", "some", "concepts", "fundamentals", "introduction", "intro"}

    meaningful_tokens = prereq_tokens - filler
    if not meaningful_tokens:
        # If only filler words, try matching topic
        meaningful_tokens = prereq_tokens - {"basic", "understanding", "of", "the", "a", "an", "and"}

    if not meaningful_tokens:
        return 0

    # Direct token overlap
    overlap = meaningful_tokens & candidate["tokens"]
    token_score = len(overlap) / len(meaningful_tokens) if meaningful_tokens else 0

    # Check if any extracted tag is a substring of the prereq text
    substr_bonus = 0
    prereq_lower = prereq_text.lower()
    for tag in candidate["extracted_tags"]:
        if tag in prereq_lower:
            substr_bonus += 0.3

    # Check if topic matches
    topic_bonus = 0
    if candidate["topic"] and candidate["topic"] in prereq_lower:
        topic_bonus = 0.4

    # Prefer beginner/intermediate level courses as prerequisites
    level_bonus = 0
    if candidate["level"] in ("beginner", "introductory", "fundamentals"):
        level_bonus = 0.15
    elif candidate["level"] == "intermediate":
        level_bonus = 0.05

    # Check if course title words appear in prereq text
    title_words = tokenize(candidate["title"]) - filler
    title_overlap = title_words & tokenize(prereq_text)
    title_bonus = 0.2 * (len(title_overlap) / max(len(title_words), 1))

    total = token_score + min(substr_bonus, 0.5) + topic_bonus + level_bonus + title_bonus
    return min(total, 2.0)


def generate_prerequisites(courses):
    """Main algorithm: match gemini_prerequisites → courses."""
    index = build_course_index(courses)
    result = {}
    stats = {"matched": 0, "no_prereqs": 0, "no_match": 0}

    for course in courses:
        code = course.get("code", "")
        prereq_texts = course.get("gemini_prerequisites", []) or []

        if not prereq_texts:
            stats["no_prereqs"] += 1
            continue

        matched_prereqs = []
        reasons = {}

        for prereq_text in prereq_texts:
            if not prereq_text or len(prereq_text.strip()) < 3:
                continue

            # Score all other courses
            scores = []
            for cand_code, cand in index.items():
                if cand_code == code:
                    continue  # Don't match self
                s = score_match(prereq_text, cand)
                if s > 0.3:  # Minimum threshold
                    scores.append((cand_code, s, cand["title"]))

            # Sort by score descending, take top match
            scores.sort(key=lambda x: -x[1])
            if scores:
                best_code, best_score, best_title = scores[0]
                if best_code not in matched_prereqs:
                    matched_prereqs.append(best_code)
                    reasons[best_code] = prereq_text.strip()

                # Also add 2nd match if score is close
                if len(scores) > 1 and scores[1][1] > 0.5:
                    sec_code = scores[1][0]
                    if sec_code not in matched_prereqs and len(matched_prereqs) < 3:
                        matched_prereqs.append(sec_code)
                        reasons[sec_code] = prereq_text.strip()

        if matched_prereqs:
            result[code] = {
                "prereqs": matched_prereqs,
                "prereq_texts": prereq_texts,
                "reasons": reasons,
            }
            stats["matched"] += 1
        else:
            stats["no_match"] += 1

    return result, stats


def main():
    print(f"Loading library from {LIBRARY_PATH}")
    with open(LIBRARY_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    courses = data.get("courses", [])
    print(f"Found {len(courses)} courses")

    prereqs, stats = generate_prerequisites(courses)

    print(f"\nResults:")
    print(f"  Courses with matched prereqs: {stats['matched']}")
    print(f"  Courses with no prereq text:  {stats['no_prereqs']}")
    print(f"  Courses with text but no match: {stats['no_match']}")

    # Show sample output
    print(f"\nSample entries:")
    for code, entry in list(prereqs.items())[:5]:
        print(f"  {code}: prereqs={entry['prereqs']}")
        for pc, reason in entry["reasons"].items():
            cname = next((c["title"] for c in courses if c["code"] == pc), "?")
            print(f"    → {pc} ({cname}): \"{reason}\"")

    # Write output
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(prereqs, f, indent=2, ensure_ascii=False)

    print(f"\nWrote {len(prereqs)} entries to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
