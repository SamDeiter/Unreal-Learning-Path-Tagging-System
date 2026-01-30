"""
Phase 3: Transcript Tag Extraction
Extracts UE5 tags from Whisper transcripts and enriches course data.
"""
import json
import re
from pathlib import Path
from collections import Counter

CONTENT_DIR = Path("content")
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"

# Comprehensive UE5 terms vocabulary
UE5_TERMS = {
    # Rendering & Visuals
    "niagara", "lumen", "nanite", "material", "shader", "lighting",
    "ray tracing", "raytracing", "virtual shadow", "post process", 
    "fog", "volumetric", "bloom", "exposure", "tonemapping", "path tracer",
    "global illumination", "reflection", "refraction", "subsurface",
    
    # Scripting
    "blueprint", "blueprints", "node", "variable", "function", "event", 
    "graph", "cast", "interface", "macro", "component", "actor", "pawn",
    "character", "controller", "game mode", "gameplay",
    
    # Animation
    "animation", "skeletal", "retarget", "montage", "blend space",
    "state machine", "control rig", "ik", "inverse kinematics", 
    "animation blueprint", "anim notify", "pose", "additive",
    
    # Environment
    "landscape", "foliage", "terrain", "sculpt", "heightmap",
    "world partition", "level streaming", "lod", "hlod", "grass",
    "procedural", "spline", "volume", "level", "sublevel", "biome",
    
    # Physics
    "chaos", "physics", "collision", "rigid body", "constraint",
    "destruction", "fracture", "cloth", "simulation", "vehicle",
    
    # Audio
    "metasounds", "audio", "sound", "attenuation", "reverb",
    "sound cue", "sound class", "ambient",
    
    # Cinematic
    "sequencer", "camera", "track", "keyframe", "take recorder",
    "movie render", "cinematic", "cutscene", "virtual production",
    "led volume", "nDisplay",
    
    # Characters
    "metahuman", "groom", "hair", "skin", "facial", "mocap",
    "skeleton", "rig", "body",
    
    # Multiplayer
    "replication", "rpc", "multiplayer", "server", "client",
    "network", "session", "dedicated server", "online",
    
    # AI
    "behavior tree", "blackboard", "ai", "navigation", "navmesh",
    "perception", "eqs", "crowd", "pathfinding", "smart object",
    
    # UI
    "umg", "widget", "ui", "hud", "menu", "button", "slate",
    "common ui", "user interface",
    
    # Build & Deploy
    "packaging", "cooking", "build", "compile", "optimization",
    "target", "platform", "performance", "profiling",
    
    # Tools
    "editor", "plugin", "tool", "python", "data asset", "data table",
    
    # PCG & Procedural
    "pcg", "procedural content", "rule", "density", "scatter",
    "world building", "modular",
    
    # Version-specific
    "motion design", "mograph", "motion graphics",
}

def extract_terms(text, min_count=1):
    """Extract UE5 terms from text with occurrence counts."""
    if not text:
        return {}
    
    text_lower = text.lower()
    words = Counter(re.findall(r'\b\w+\b', text_lower))
    found = {}
    
    for term in UE5_TERMS:
        if ' ' not in term:
            # Single word term
            count = words.get(term, 0)
        else:
            # Multi-word term
            count = text_lower.count(term)
        
        if count >= min_count:
            found[term] = count
    
    return found


def main():
    print("=" * 60)
    print("PHASE 3: Transcript Tag Extraction")
    print("=" * 60)
    
    # Load data
    drive_videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())
    library = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    courses = library.get("courses", [])
    
    transcript_ids = {p.stem for p in TRANSCRIPTS_DIR.glob("*.json")}
    name_to_id = {v["name"]: v["id"] for v in drive_videos}
    
    print(f"Transcripts available: {len(transcript_ids)}")
    print(f"Drive videos: {len(drive_videos)}")
    print(f"Courses: {len(courses)}")
    
    # Process each course
    enriched_count = 0
    total_tags = 0
    
    for course in courses:
        course_text = ""
        matched_vids = 0
        
        for vid in course.get("videos", []):
            # Use drive_id field if available (new), else fallback to name lookup
            drive_id = vid.get("drive_id")
            if not drive_id:
                vid_name = vid.get("name", "")
                drive_id = name_to_id.get(vid_name)
            
            if drive_id and drive_id in transcript_ids:
                transcript_file = TRANSCRIPTS_DIR / f"{drive_id}.json"
                try:
                    t_data = json.loads(transcript_file.read_text())
                    text = t_data.get("text", "") if isinstance(t_data, dict) else ""
                    course_text += " " + text
                    matched_vids += 1
                except Exception as e:
                    pass
        
        if course_text.strip():
            terms = extract_terms(course_text)
            top_tags = sorted(terms.items(), key=lambda x: -x[1])[:15]
            
            course["transcript_tags"] = [t[0] for t in top_tags]
            course["transcript_video_count"] = matched_vids
            enriched_count += 1
            total_tags += len(course["transcript_tags"])
    
    avg_tags = total_tags / enriched_count if enriched_count else 0
    
    print(f"\n✅ Courses enriched: {enriched_count}")
    print(f"📊 Average tags per course: {avg_tags:.1f}")
    
    # Show samples
    print("\n--- Sample Results ---")
    for c in courses[:5]:
        if c.get("transcript_tags"):
            code = c.get("code", "?")
            tags = c.get("transcript_tags", [])
            vids = c.get("transcript_video_count", 0)
            print(f"{code}: {vids} videos -> {tags[:6]}")
    
    # Save updated library
    library["courses"] = courses
    (CONTENT_DIR / "video_library_enriched.json").write_text(
        json.dumps(library, indent=2, ensure_ascii=False)
    )
    print(f"\n💾 Saved: {CONTENT_DIR / 'video_library_enriched.json'}")


if __name__ == "__main__":
    main()
