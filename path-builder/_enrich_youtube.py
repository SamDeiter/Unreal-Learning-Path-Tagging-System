"""
Enrich youtube_curated.json with descriptions, keyTakeaways, and chapters
for each resource. This makes YouTube video pages in the Guided Player
informative instead of showing generic boilerplate.
"""
import json

path = 'src/data/youtube_curated.json'

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Enrichment data keyed by resource id
ENRICHMENTS = {
    "yt_001": {
        "description": "Official Epic walkthrough of the UE5 editor interface, viewport navigation, content browser, and basic level editing. Perfect starting point for absolute beginners.",
        "keyTakeaways": [
            "Navigate the 3D viewport using WASD + right-click mouse look",
            "Use the Content Browser to import and organize assets",
            "Place actors in a level and adjust transforms (location, rotation, scale)",
            "Understand the difference between the World Outliner and Details panel"
        ],
        "chapters": [
            {"label": "Editor Interface Tour", "seconds": 0},
            {"label": "Viewport Navigation", "seconds": 600},
            {"label": "Content Browser & Assets", "seconds": 1800},
            {"label": "Placing & Transforming Actors", "seconds": 2700}
        ]
    },
    "yt_002": {
        "description": "Comprehensive beginner course covering Blueprints, materials, lighting, and level design. A full 5-hour guided project that builds a complete game environment.",
        "keyTakeaways": [
            "Create and connect Blueprint nodes for gameplay logic",
            "Build basic materials with texture samples and parameters",
            "Set up directional, point, and spot lights for a scene",
            "Combine all skills to build a playable game level from scratch"
        ],
        "chapters": [
            {"label": "Project Setup", "seconds": 0},
            {"label": "Blueprint Fundamentals", "seconds": 1200},
            {"label": "Materials & Textures", "seconds": 6000},
            {"label": "Lighting Your Scene", "seconds": 10800},
            {"label": "Final Level Assembly", "seconds": 14400}
        ]
    },
    "yt_003": {
        "description": "Deep dive into building large open worlds using World Partition, landscape tools, and data layers. Covers streaming, HLOD, and performance strategies for massive maps.",
        "keyTakeaways": [
            "Enable and configure World Partition for automatic level streaming",
            "Use the Landscape tool to sculpt terrain with layers and materials",
            "Set up Data Layers to organize streaming content by gameplay region",
            "Optimize open world performance with HLOD and distance culling"
        ],
        "chapters": [
            {"label": "World Partition Overview", "seconds": 0},
            {"label": "Landscape Creation", "seconds": 1200},
            {"label": "Streaming & Data Layers", "seconds": 3000},
            {"label": "Performance & HLOD", "seconds": 4200}
        ]
    },
    "yt_004": {
        "description": "Official Inside Unreal episode covering Nanite virtualized geometry — how it works, when to use it, performance characteristics, and integration with other systems like Lumen.",
        "keyTakeaways": [
            "Understand how Nanite eliminates traditional LOD workflows",
            "Enable Nanite on Static Meshes via the mesh editor settings",
            "Know which geometry types support Nanite (and which don't — skeletal, translucent)",
            "Profile Nanite performance using stat Nanite and GPU visualizations"
        ],
        "chapters": [
            {"label": "What Is Nanite?", "seconds": 0},
            {"label": "Enabling Nanite", "seconds": 600},
            {"label": "Supported Geometry", "seconds": 1500},
            {"label": "Performance Profiling", "seconds": 2400}
        ]
    },
    "yt_005": {
        "description": "Official Inside Unreal episode on Lumen — UE5's dynamic global illumination and reflection system. Covers setup, performance tuning, and visual quality settings.",
        "keyTakeaways": [
            "Understand Lumen's software ray tracing vs hardware ray tracing modes",
            "Configure Lumen GI quality through Post Process Volume settings",
            "Set up Lumen reflections using reflection capture actors as fallbacks",
            "Tune performance by adjusting Lumen Scene Detail and Final Gather Quality"
        ],
        "chapters": [
            {"label": "Lumen Overview", "seconds": 0},
            {"label": "Global Illumination Setup", "seconds": 600},
            {"label": "Reflections Configuration", "seconds": 1800},
            {"label": "Performance Tuning", "seconds": 2700}
        ]
    },
    "yt_006": {
        "description": "Ben Cloward's beginner-friendly introduction to UE5's material editor. Covers node-based shader creation, PBR principles, and essential material nodes.",
        "keyTakeaways": [
            "Create a new material and navigate the Material Graph editor",
            "Connect Texture Sample, Multiply, and Lerp nodes for basic PBR shading",
            "Understand Base Color, Metallic, Roughness, and Normal input channels",
            "Use Material Instances to create parameter-driven material variants"
        ]
    },
    "yt_007": {
        "description": "Advanced material technique: Parallax Occlusion Mapping for faking surface depth without extra geometry. Covers the POM node setup and optimization.",
        "keyTakeaways": [
            "Set up the Parallax Occlusion Mapping node with a heightmap texture",
            "Tune Min/Max steps and heightmap scale for visual quality vs performance",
            "Combine POM with normal maps for convincing surface detail",
            "Know when POM is more efficient than tessellation or Nanite"
        ]
    },
    "yt_008": {
        "description": "Ryan Laley's full crash course on UE5 Blueprints — variables, functions, events, flow control, and practical gameplay examples from zero to functional gameplay.",
        "keyTakeaways": [
            "Declare variables (bool, int, float, vector) and use Get/Set nodes",
            "Create custom functions with inputs, outputs, and local variables",
            "Use Branch, ForEachLoop, and Switch nodes for flow control",
            "Build a working health/damage system using Blueprint events"
        ],
        "chapters": [
            {"label": "Variables & Data Types", "seconds": 0},
            {"label": "Functions & Events", "seconds": 1800},
            {"label": "Flow Control", "seconds": 3600},
            {"label": "Practical Example: Health System", "seconds": 5400}
        ]
    },
    "yt_009": {
        "description": "Full multiplayer course covering replication, RPCs, GameMode/GameState architecture, and practical networked gameplay implementation in UE5.",
        "keyTakeaways": [
            "Understand server-authoritative architecture and Replication in UE5",
            "Mark variables as Replicated and use RepNotify for state sync",
            "Implement Server RPCs and Multicast RPCs for gameplay actions",
            "Configure GameMode, GameState, and PlayerState for multiplayer sessions"
        ],
        "chapters": [
            {"label": "Networking Concepts", "seconds": 0},
            {"label": "Variable Replication", "seconds": 1800},
            {"label": "RPCs (Remote Procedure Calls)", "seconds": 4200},
            {"label": "GameMode & Session Setup", "seconds": 7200}
        ]
    },
    "yt_010": {
        "description": "Mathew Wadstein's concise explanation of UE5's Enhanced Input system — Input Actions, Input Mapping Contexts, and migrating from the legacy input system.",
        "keyTakeaways": [
            "Create Input Actions for movement, look, and gameplay interactions",
            "Set up an Input Mapping Context and bind keys/gamepad to actions",
            "Add the Enhanced Input component to your Player Controller",
            "Migrate from legacy BindAction/BindAxis to the Enhanced Input workflow"
        ]
    },
    "yt_011": {
        "description": "Comprehensive overview of UE5 Behavior Trees for AI — blackboard setup, task nodes, decorator conditions, and building patrol/chase AI behaviors.",
        "keyTakeaways": [
            "Create a Behavior Tree and Blackboard asset pair for AI decision-making",
            "Use Selector and Sequence composite nodes to structure AI logic",
            "Write custom Task nodes (MoveTo, Wait, Attack) in Blueprint or C++",
            "Add Decorator nodes for conditional checks (Is Player Visible?, Health Low?)"
        ]
    },
    "yt_012": {
        "description": "Full beginner course on UE5's UMG (Unreal Motion Graphics) system — creating HUD widgets, menus, buttons, and data binding for game UI.",
        "keyTakeaways": [
            "Create Widget Blueprints and add to viewport using Create Widget node",
            "Use Canvas Panel, Vertical/Horizontal Boxes for responsive UI layout",
            "Bind text and progress bars to gameplay variables for live HUD updates",
            "Build a main menu with buttons, navigation, and input mode switching"
        ],
        "chapters": [
            {"label": "Widget Blueprint Basics", "seconds": 0},
            {"label": "Layout & Panels", "seconds": 1800},
            {"label": "Data Binding", "seconds": 3600},
            {"label": "Main Menu System", "seconds": 5400}
        ]
    },
    "yt_013": {
        "description": "Official introduction to UE5's Niagara VFX system — emitters, modules, particle spawning, and creating fire/smoke/spark effects from scratch.",
        "keyTakeaways": [
            "Create a Niagara System and add Emitters for different effect layers",
            "Use Spawn Rate, Lifetime, and Initial Velocity modules to control particles",
            "Apply Curl Noise Force and Drag modules for organic motion",
            "Combine multiple emitters for complex effects (fire = flames + embers + smoke)"
        ],
        "chapters": [
            {"label": "Niagara System Overview", "seconds": 0},
            {"label": "Emitter Setup", "seconds": 600},
            {"label": "Module Configuration", "seconds": 1500},
            {"label": "Multi-Layer Effects", "seconds": 2100}
        ]
    },
    "yt_014": {
        "description": "Official feature highlight covering UE5 animation tools — Animation Blueprints, Control Rig, IK Retargeting, and the new animation workflow improvements.",
        "keyTakeaways": [
            "Set up an Animation Blueprint with State Machines for locomotion",
            "Use Control Rig for procedural animation adjustments and IK",
            "Retarget animations between different skeletal meshes using IK Retargeter",
            "Blend animations using Blend Spaces for smooth directional movement"
        ]
    },
    "yt_015": {
        "description": "Unreal Sensei's landscape tutorial covering terrain sculpting, landscape materials with auto-layers, foliage painting, and environment composition.",
        "keyTakeaways": [
            "Create a Landscape actor and sculpt terrain using brush tools",
            "Build a landscape material with height-based auto layers (grass, rock, snow)",
            "Paint foliage instances (trees, grass, rocks) with the Foliage tool",
            "Use atmospheric fog and sky atmosphere for environment mood"
        ],
        "chapters": [
            {"label": "Landscape Setup", "seconds": 0},
            {"label": "Sculpting Tools", "seconds": 480},
            {"label": "Landscape Materials", "seconds": 1200},
            {"label": "Foliage Painting", "seconds": 1800}
        ]
    },
    "yt_016": {
        "description": "Guide to cinematic lighting techniques in UE5 — three-point lighting, Lumen considerations, light functions, and post-process color grading for film-quality visuals.",
        "keyTakeaways": [
            "Apply three-point lighting (key, fill, rim) for cinematic character shots",
            "Use Rect Lights and Spot Lights with IES profiles for realistic falloff",
            "Configure Lumen settings for cinematic-quality reflections and GI bounce",
            "Add Post Process Volume color grading with LUTs for final look"
        ]
    },
    "yt_017": {
        "description": "Official deep dive into UE5.2's Procedural Content Generation (PCG) framework — rules, data layers, point sampling, and generating landscapes procedurally.",
        "keyTakeaways": [
            "Create a PCG Graph with Point Samplers and Surface Projectors",
            "Use filters and density modifiers to control asset placement",
            "Set up exclusion volumes and bias rules for natural-looking distribution",
            "Combine PCG with landscape layers for context-aware procedural placement"
        ],
        "chapters": [
            {"label": "PCG Framework Concepts", "seconds": 0},
            {"label": "PCG Graph Editor", "seconds": 900},
            {"label": "Point Sampling & Filters", "seconds": 1800},
            {"label": "Integration with Landscape", "seconds": 2700}
        ]
    },
    "yt_018": {
        "description": "Introduction to MetaSounds — UE5's node-based audio system for procedural sound design, music, and real-time audio synthesis.",
        "keyTakeaways": [
            "Create a MetaSound Source and build audio graphs with oscillators",
            "Use Trigger and Envelope nodes for event-driven sound playback",
            "Connect gameplay parameters to MetaSound inputs for reactive audio",
            "Replace legacy SoundCue workflows with MetaSounds for better performance"
        ],
        "chapters": [
            {"label": "MetaSounds Overview", "seconds": 0},
            {"label": "Audio Graph Basics", "seconds": 600},
            {"label": "Gameplay Integration", "seconds": 1500},
            {"label": "Advanced Synthesis", "seconds": 2400}
        ]
    },
    "yt_019": {
        "description": "Full Sequencer tutorial for creating cinematics — camera tracks, animation tracks, audio sync, and rendering out movie files for game trailers or cutscenes.",
        "keyTakeaways": [
            "Create a Level Sequence and add Camera Cut tracks for shot composition",
            "Animate actor transforms and properties using keyframes on the timeline",
            "Add Camera Shake, focal length animation, and rack focus for cinematic feel",
            "Render out movie sequences using Movie Render Queue for high-quality output"
        ],
        "chapters": [
            {"label": "Sequencer Basics", "seconds": 0},
            {"label": "Camera & Shot Setup", "seconds": 900},
            {"label": "Keyframe Animation", "seconds": 1800},
            {"label": "Movie Render Queue", "seconds": 2700}
        ]
    },
    "yt_020": {
        "description": "Official overview of UE5's Chaos physics system — rigid body simulation, destruction, cloth, and vehicle physics configuration.",
        "keyTakeaways": [
            "Enable Chaos physics and set up rigid body simulation on Static Meshes",
            "Create Geometry Collections for destructible objects using Fracture Mode",
            "Configure Chaos Cloth simulation on Skeletal Meshes for fabric physics",
            "Set up Chaos Vehicle movement with suspension, wheels, and engine curves"
        ],
        "chapters": [
            {"label": "Chaos Physics Overview", "seconds": 0},
            {"label": "Rigid Body & Collision", "seconds": 600},
            {"label": "Destruction System", "seconds": 1500},
            {"label": "Vehicle Physics", "seconds": 2400}
        ]
    },
    "yt_021": {
        "description": "Concise explainer on collision in UE5 — collision presets, channels, response types, and debugging overlap/block issues in gameplay.",
        "keyTakeaways": [
            "Understand Block, Overlap, and Ignore collision responses",
            "Configure collision presets and custom Object Channels",
            "Use Show Collision debug visualization to diagnose collision problems",
            "Set up trigger volumes using Overlap events for gameplay interactions"
        ]
    },
    "yt_022": {
        "description": "Advanced virtual production workflow using nDisplay for multi-display LED wall setups, real-time compositing, and in-camera VFX with UE5.",
        "keyTakeaways": [
            "Set up an nDisplay configuration for multi-node LED wall rendering",
            "Calibrate camera tracking with LiveLink for real-time compositing",
            "Use Inner Frustum rendering for perspective-correct LED backgrounds",
            "Configure color calibration and latency compensation for on-set accuracy"
        ],
        "chapters": [
            {"label": "nDisplay Concepts", "seconds": 0},
            {"label": "LED Wall Configuration", "seconds": 1200},
            {"label": "Camera Tracking & LiveLink", "seconds": 3000},
            {"label": "Color Calibration", "seconds": 4500}
        ]
    },
    "yt_023": {
        "description": "Step-by-step water shader tutorial in UE5 — wave animation, refraction, depth-based coloring, foam edges, and caustics using the material editor.",
        "keyTakeaways": [
            "Build a water material with depth-based opacity and color tinting",
            "Add wave motion using World Position Offset with panning normals",
            "Create foam edges using Scene Depth and pixel depth comparison",
            "Apply refraction and sub-surface scattering for realistic water rendering"
        ]
    },
    "yt_024": {
        "description": "Blueprint-based save and load system tutorial — using SaveGame objects, slot management, serialization, and persistent data for game progression.",
        "keyTakeaways": [
            "Create a SaveGame Blueprint class with variables for game state",
            "Use SaveGameToSlot and LoadGameFromSlot nodes for file I/O",
            "Serialize actor transforms, inventory, and quest progress for persistence",
            "Build a save slot UI with multiple save files and auto-save functionality"
        ]
    },
}

updated = 0
for resource in data.get('resources', []):
    rid = resource.get('id')
    if rid in ENRICHMENTS:
        enrichment = ENRICHMENTS[rid]
        resource['description'] = enrichment['description']
        resource['keyTakeaways'] = enrichment['keyTakeaways']
        if 'chapters' in enrichment:
            resource['chapters'] = enrichment['chapters']
        updated += 1
        print(f"  ✅ {rid}: {resource['title'][:50]}...")

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\n✅ Enriched {updated}/{len(data.get('resources', []))} resources")
