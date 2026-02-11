"""UE5 Vocabulary and Tag Mappings.

Contains the official UE5 terminology, normalization rules,
and canonical tag mappings used for tag extraction.
"""

# UE5-specific terms to look for in transcripts
UE5_TERMS = {
    # Rendering & Visuals
    "niagara", "lumen", "nanite", "material", "shader", "lighting",
    "ray tracing", "virtual shadow", "screen space", "post process",
    "fog", "volumetric", "bloom", "exposure", "tonemapping",

    # Scripting
    "blueprint", "node", "variable", "function", "event", "graph",
    "cast", "interface", "macro", "component", "actor", "pawn",
    "character", "controller", "game mode", "game state",

    # Animation
    "animation", "skeletal", "retarget", "montage", "blend space",
    "state machine", "control rig", "ik", "fk", "anim notify",
    "animation blueprint", "pose", "additive", "slot",

    # Environment
    "landscape", "foliage", "terrain", "sculpt", "heightmap",
    "world partition", "level streaming", "lod", "hlod", "grass",
    "procedural", "spline", "volume", "level", "sublevel",

    # Physics
    "chaos", "physics", "collision", "rigid body", "constraint",
    "destruction", "fracture", "cloth", "simulation",

    # Audio
    "metasounds", "audio", "sound", "attenuation", "reverb",
    "concurrency", "sound cue", "sound class",

    # Cinematic
    "sequencer", "camera", "track", "keyframe", "take recorder",
    "movie render", "cinematic", "cutscene",

    # Characters
    "metahuman", "groom", "hair", "skin", "facial", "mocap",
    "body", "skeleton", "rig",

    # Multiplayer
    "replication", "rpc", "multiplayer", "server", "client",
    "network", "session", "dedicated server",

    # AI
    "behavior tree", "blackboard", "ai", "navigation", "navmesh",
    "perception", "eqs", "crowd", "pathfinding",

    # UI
    "umg", "widget", "ui", "hud", "menu", "button", "slate",
    "common ui", "focus",

    # Build & Deploy
    "packaging", "cooking", "shipping", "build", "compile",
    "target", "platform", "ios", "android", "console",

    # Tools
    "editor", "plugin", "tool", "automation", "python",
    "data asset", "data table", "struct", "enum",

    # PCG & Procedural
    "pcg", "procedural content generation", "rule", "density",
    "scatter", "biome", "world building",

    # Version-specific features
    "motion design", "mograph", "motion graphics",
}

# Normalize variations to canonical forms
NORMALIZATION_MAP = {
    # Blueprint variations
    "bp": "blueprint",
    "blueprints": "blueprint",
    "blueprint graph": "blueprint",
    "event graph": "blueprint",

    # Niagara variations
    "niagara system": "niagara",
    "niagara emitter": "niagara",
    "particle": "niagara",
    "particles": "niagara",
    "vfx": "niagara",
    "visual effects": "niagara",

    # Control Rig variations
    "control rigs": "control_rig",
    "control rig": "control_rig",
    "controlrig": "control_rig",

    # Animation variations
    "animations": "animation",
    "anim": "animation",
    "anims": "animation",
    "skeletal mesh": "animation",

    # Landscape variations
    "landscapes": "landscape",
    "terrain": "landscape",
    "heightmap": "landscape",

    # Material variations
    "materials": "material",
    "mat": "material",
    "shader": "material",
    "shaders": "material",

    # Sequencer variations
    "sequence": "sequencer",
    "sequences": "sequencer",
    "cinematics": "sequencer",
    "cinematic": "sequencer",

    # MetaHuman variations
    "meta human": "metahuman",
    "metahumans": "metahuman",

    # Lighting variations
    "lights": "lighting",
    "light": "lighting",
    "lumen gi": "lumen",

    # UI/UMG variations
    "widget": "umg",
    "widgets": "umg",
    "user interface": "umg",

    # Physics variations
    "physics simulation": "physics",
    "rigid bodies": "physics",
    "chaos physics": "chaos",

    # PCG variations
    "procedural generation": "pcg",
    "procedural content": "pcg",
}

# Map normalized tags to canonical tag IDs
CANONICAL_MAP = {
    # Scripting
    "blueprint": "scripting.blueprint",
    "c++": "scripting.cpp",
    "python": "scripting.python",

    # Rendering
    "niagara": "rendering.niagara",
    "lumen": "rendering.lumen",
    "nanite": "rendering.nanite",
    "material": "rendering.material",
    "lighting": "rendering.lighting",

    # Environment
    "landscape": "environment.landscape",
    "foliage": "environment.foliage",
    "world_partition": "environment.world_partition",
    "level_design": "environment.level_design",

    # Animation
    "animation": "animation.general",
    "control_rig": "animation.control_rig",
    "retarget": "animation.retargeting",

    # Characters
    "metahuman": "character.metahuman",
    "groom": "character.groom",

    # Cinematic
    "sequencer": "cinematic.sequencer",

    # Audio
    "metasounds": "audio.metasounds",
    "audio": "audio.general",

    # Physics
    "chaos": "physics.chaos",
    "physics": "physics.general",

    # AI
    "behavior_tree": "ai.behavior_tree",
    "navigation": "ai.navigation",

    # Multiplayer
    "replication": "multiplayer.replication",
    "networking": "multiplayer.networking",

    # UI
    "umg": "ui.umg",

    # Build
    "packaging": "build.packaging",

    # Procedural
    "pcg": "procedural.pcg",
}

def normalize_tag(tag: str) -> str:
    """Normalize a tag to its canonical form."""
    tag_lower = tag.lower().strip()
    return NORMALIZATION_MAP.get(tag_lower, tag_lower)

def to_canonical(tag: str) -> str | None:
    """Convert a normalized tag to its canonical ID."""
    normalized = normalize_tag(tag)
    return CANONICAL_MAP.get(normalized)

def is_ue5_term(word: str) -> bool:
    """Check if a word is a known UE5 term."""
    return word.lower() in UE5_TERMS
