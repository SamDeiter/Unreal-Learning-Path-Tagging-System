"""
Phases 4-5: Edge Regeneration + Gemini Enrichment
Generates edges from tag co-occurrence and enriches sparse courses with Gemini.
"""
import json
import os
from pathlib import Path
from collections import Counter
from itertools import combinations

from dotenv import load_dotenv
load_dotenv()

CONTENT_DIR = Path("content")

def generate_edges(courses, min_weight=2):
    """Generate edges from tag co-occurrence across courses."""
    print("\n🔗 PHASE 4: Edge Regeneration")
    print("-" * 40)
    
    # Collect all tags per course
    course_tags = {}
    for course in courses:
        code = course.get("code", "")
        tags = []
        
        # Combine all tag sources
        tags.extend(course.get("transcript_tags", []))
        tags.extend(course.get("ai_tags", []))
        tags.extend(course.get("gemini_system_tags", []))
        tags.extend(course.get("extracted_tags", []))
        
        # Normalize
        tags = [t.lower() for t in tags if t]
        
        if tags and code:
            course_tags[code] = list(set(tags))
    
    print(f"Courses with tags: {len(course_tags)}")
    
    # Calculate co-occurrence
    co_occurrence = Counter()
    for code, tags in course_tags.items():
        for t1, t2 in combinations(sorted(tags), 2):
            co_occurrence[(t1, t2)] += 1
    
    # Generate edges
    edges = []
    for (source, target), weight in co_occurrence.items():
        if weight >= min_weight:
            edges.append({
                "source": source,
                "target": target,
                "type": "related",
                "weight": weight,
            })
    
    # Sort by weight
    edges.sort(key=lambda e: -e["weight"])
    
    print(f"✅ Generated {len(edges)} edges")
    
    if edges[:5]:
        print("Top relationships:")
        for e in edges[:5]:
            print(f"  {e['source']} <-> {e['target']} (weight: {e['weight']})")
    
    return edges


def identify_sparse_courses(courses, min_tags=3):
    """Find courses that need Gemini enrichment."""
    sparse = []
    for course in courses:
        all_tags = []
        all_tags.extend(course.get("transcript_tags", []))
        all_tags.extend(course.get("ai_tags", []))
        all_tags.extend(course.get("gemini_system_tags", []))
        all_tags.extend(course.get("extracted_tags", []))
        
        if len(set(all_tags)) < min_tags:
            sparse.append(course)
    
    return sparse


def enrich_with_gemini(courses, api_key=None, limit=10):
    """Enrich sparse courses using Gemini API."""
    print("\n🤖 PHASE 5: Gemini Enrichment")
    print("-" * 40)
    
    sparse = identify_sparse_courses(courses)
    print(f"Courses needing enrichment: {len(sparse)}")
    
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        print("⚠️ No GEMINI_API_KEY found - skipping Gemini enrichment")
        print("   Set environment variable or pass api_key parameter")
        return 0
    
    # Import Gemini
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
    except ImportError:
        print("⚠️ google-generativeai not installed - skipping")
        return 0
    except Exception as e:
        print(f"⚠️ Gemini setup error: {e}")
        return 0
    
    enriched = 0
    for course in sparse[:limit]:
        title = course.get("title", "Unknown")
        folder = course.get("folder_name", "")
        
        prompt = f"""Analyze this UE5 training course and extract tags:

Course: {title}
Folder: {folder}

Return a JSON object with:
- "system_tags": 3-8 UE5 systems/tools covered (e.g., Blueprint, Niagara, Lumen)
- "skill_level": Beginner, Intermediate, or Advanced
- "topics": 2-4 main learning topics

Respond with ONLY valid JSON, no markdown."""

        try:
            response = model.generate_content(prompt)
            text = response.text.strip()
            
            # Parse JSON
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            data = json.loads(text)
            
            # Update course
            if data.get("system_tags"):
                course["gemini_system_tags"] = data["system_tags"]
            if data.get("skill_level"):
                course["gemini_skill_level"] = data["skill_level"]
            if data.get("topics"):
                course["gemini_topics"] = data["topics"]
            
            course["gemini_enriched"] = True
            enriched += 1
            print(f"  ✅ {course.get('code')}: {data.get('system_tags', [])[:3]}")
            
        except Exception as e:
            print(f"  ❌ {course.get('code')}: {str(e)[:50]}")
    
    print(f"\nEnriched {enriched}/{min(limit, len(sparse))} courses")
    return enriched


def main():
    print("=" * 60)
    print("PHASES 4-5: Edge Regeneration + Gemini Enrichment")
    print("=" * 60)
    
    # Load library
    library = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    courses = library.get("courses", [])
    print(f"Loaded {len(courses)} courses")
    
    # Phase 4: Generate edges
    edges = generate_edges(courses)
    
    # Save edges
    (CONTENT_DIR / "generated_edges.json").write_text(
        json.dumps(edges, indent=2)
    )
    print(f"💾 Saved {len(edges)} edges to generated_edges.json")
    
    # Phase 5: Gemini enrichment (if API key available)
    enriched = enrich_with_gemini(courses, limit=20)
    
    # Save updated library
    (CONTENT_DIR / "video_library_enriched.json").write_text(
        json.dumps(library, indent=2, ensure_ascii=False)
    )
    print(f"\n💾 Saved updated library")
    
    # Copy to path-builder
    pb_data = Path("path-builder/src/data")
    if pb_data.exists():
        import shutil
        shutil.copy(CONTENT_DIR / "video_library_enriched.json", pb_data)
        shutil.copy(CONTENT_DIR / "generated_edges.json", pb_data / "edges.json")
        print(f"📋 Copied to {pb_data}")
    
    print("\n" + "=" * 60)
    print("✅ PIPELINE COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
