#!/usr/bin/env python3
"""
Phase 1: Course-Level Tag Enrichment via Gemini AI
Enriches courses with better tags using Gemini based on:
- Course title and existing metadata
- Extracted tags (pattern-based)  
- Available transcripts (if mappable)

This uses the existing Cloud Function or direct API.

Usage:
  python scripts/enrich_courses_gemini.py --limit 5
  python scripts/enrich_courses_gemini.py --dry-run
"""
import json
import os
import time
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Try to load environment variables
load_dotenv()

CONTENT_DIR = Path("content")
VIDEO_LIBRARY = CONTENT_DIR / "video_library_enriched.json"
TAGS_FILE = CONTENT_DIR / "tags.json"

# Rate limiting
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
RATE_LIMIT_DELAY = 1.0  # seconds between API calls

# Valid UE5 system tags for validation
VALID_UE5_SYSTEMS = {
    "Niagara", "Blueprint", "Materials", "Sequencer", "Animation",
    "Lighting", "Lumen", "Nanite", "Control Rig", "MetaHuman",
    "Landscape", "Foliage", "World Partition", "Data Layers",
    "Audio", "MetaSound", "AI", "Behavior Tree", "State Tree",
    "Mass", "Physics", "Chaos", "Networking", "Replication",
    "UI", "UMG", "Slate", "CommonUI", "Datasmith", "VR", "AR",
    "Virtual Production", "ICVFX", "nDisplay", "Live Link",
    "Path Tracer", "Ray Tracing", "Post Process", "PCG",
}


def load_library():
    with open(VIDEO_LIBRARY, "r", encoding="utf-8") as f:
        return json.load(f)


def save_library(library):
    with open(VIDEO_LIBRARY, "w", encoding="utf-8") as f:
        json.dump(library, f, indent=2, ensure_ascii=False)


def get_course_context(course):
    """Build context string for Gemini prompt from course metadata."""
    parts = [f"Title: {course.get('title', 'Unknown')}"]
    
    if course.get("topic"):
        parts.append(f"Topic: {course['topic']}")
    
    if course.get("industry"):
        parts.append(f"Industry: {course['industry']}")
        
    if course.get("extracted_tags"):
        parts.append(f"Existing Tags: {', '.join(course['extracted_tags'][:10])}")
    
    if course.get("topics"):
        parts.append(f"Topics: {', '.join(course['topics'][:5])}")
    
    return "\n".join(parts)


def call_gemini_api(prompt):
    """Call Gemini API for enrichment."""
    if not GEMINI_API_KEY:
        print("  [SKIP] No GEMINI_API_KEY in environment")
        return None
    
    import requests
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 500,
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        
        # Parse JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group())
        return None
        
    except Exception as e:
        print(f"  [ERROR] API call failed: {e}")
        return None


def enrich_course(course):
    """Enrich a single course using Gemini."""
    context = get_course_context(course)
    
    prompt = f"""Analyze this UE5 training course and provide enriched metadata.

{context}

Based on the title and existing tags, provide:
1. system_tags: 2-5 specific UE5 systems/tools covered (e.g., Niagara, Blueprint, Sequencer)
2. skill_level: Beginner, Intermediate, or Advanced
3. learning_outcomes: 2-3 specific things learner will be able to do
4. recommended_prerequisites: 0-2 courses or skills to know first

Valid UE5 systems: Niagara, Blueprint, Materials, Sequencer, Animation, Lighting, Lumen, Nanite, Control Rig, MetaHuman, Landscape, Foliage, World Partition, Audio, MetaSound, AI, Behavior Tree, Physics, Networking, UI, UMG, Datasmith, VR, AR, Virtual Production, ICVFX, Live Link, Path Tracer, Ray Tracing, PCG

Respond with JSON only:
{{
  "system_tags": ["Niagara", "Blueprint"],
  "skill_level": "Intermediate", 
  "learning_outcomes": ["Create particle effects", "Use Niagara systems"],
  "recommended_prerequisites": ["Blueprint fundamentals"]
}}"""

    result = call_gemini_api(prompt)
    
    if result:
        # Validate and merge
        course["gemini_enriched"] = True
        course["gemini_system_tags"] = [t for t in result.get("system_tags", []) 
                                        if t in VALID_UE5_SYSTEMS]
        course["gemini_skill_level"] = result.get("skill_level")
        course["gemini_outcomes"] = result.get("learning_outcomes", [])
        course["gemini_prerequisites"] = result.get("recommended_prerequisites", [])
        
        # Update main tags if empty
        if not course.get("extracted_tags"):
            course["extracted_tags"] = course["gemini_system_tags"]
        
        return True
    return False


def main():
    parser = argparse.ArgumentParser(description="Enrich courses via Gemini API")
    parser.add_argument("--limit", type=int, default=5, help="Max courses to process")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed")
    parser.add_argument("--force", action="store_true", help="Re-enrich already enriched courses")
    args = parser.parse_args()
    
    if not GEMINI_API_KEY and not args.dry_run:
        print("ERROR: GEMINI_API_KEY environment variable not set")
        print("Set it with: export GEMINI_API_KEY=your_key")
        return
    
    library = load_library()
    courses = library.get("courses", [])
    
    # Find courses needing enrichment
    to_process = []
    for c in courses:
        if not args.force and c.get("gemini_enriched"):
            continue
        to_process.append(c)
        if len(to_process) >= args.limit:
            break
    
    print(f"Found {len(to_process)} courses to enrich (limit: {args.limit})")
    
    if args.dry_run:
        for c in to_process[:10]:
            print(f"  - {c.get('title', 'Unknown')[:50]}")
        return
    
    enriched = 0
    for i, course in enumerate(to_process):
        title = course.get("title", "Unknown")[:40]
        print(f"[{i+1}/{len(to_process)}] {title}...")
        
        if enrich_course(course):
            enriched += 1
            print(f"  → Tags: {course.get('gemini_system_tags', [])}")
        
        time.sleep(RATE_LIMIT_DELAY)
    
    # Save updated library
    save_library(library)
    
    print(f"\nSUMMARY: Enriched {enriched}/{len(to_process)} courses")


if __name__ == "__main__":
    main()
