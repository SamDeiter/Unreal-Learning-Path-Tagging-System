/**
 * Pre-seeded popular learning paths — Cold start content
 *
 * These 10 paths are pre-built for the most common UE5 questions.
 * They ship with the SCORM package for instant access — zero API cost.
 * Each path is a simplified version of what generateBespokePath() produces.
 */

const PRE_SEEDED_PATHS = [
  {
    id: "ps-event-tick",
    query: "Why is Event Tick bad and what should I use instead?",
    difficulty: "simple",
    estimatedMinutes: 8,
    tags: ["Blueprints", "Performance", "Best Practices"],
    steps: [
      {
        category: "foundation",
        title: "Understanding Event Tick in Unreal Engine",
        summary:
          "Event Tick fires every single frame, meaning any logic inside it runs 30-120 times per second. This is the most expensive Blueprint node because it scales linearly with complexity.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "How Event Tick Causes Performance Problems",
        summary:
          "When multiple actors all use Event Tick, the CPU must process each one every frame. A level with 100 actors each doing simple Tick logic can consume 5-10ms per frame — enough to drop from 60fps to 30fps.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Timers, Event Dispatchers, and Tick Intervals",
        summary:
          "Replace Event Tick with Timers (Set Timer by Function Name) for periodic checks, Event Dispatchers for reactive logic, and Tick Intervals for reducing frequency. Most gameplay logic only needs to run every 0.1-0.5 seconds.",
        sourceType: "transcript",
      },
      {
        category: "transfer",
        title: "Performance-First Blueprint Design Patterns",
        summary:
          "The broader principle: push from poll-based to event-driven architecture. Instead of checking every frame, react to changes. This pattern applies to AI, UI updates, physics queries, and overlap checks.",
        sourceType: "epic_learning",
      },
    ],
  },
  {
    id: "ps-nanite-basics",
    query: "How does Nanite work and when should I use it?",
    difficulty: "medium",
    estimatedMinutes: 15,
    tags: ["Nanite", "Rendering", "Optimization"],
    steps: [
      {
        category: "foundation",
        title: "What is Nanite — Virtualized Geometry",
        summary:
          "Nanite is UE5's virtualized geometry system. It breaks meshes into millions of tiny clusters and streams only the visible ones to the GPU. This means you can use film-quality assets directly in real-time.",
        sourceType: "transcript",
      },
      {
        category: "foundation",
        title: "How Nanite Differs from Traditional LODs",
        summary:
          "Traditional LOD systems require artists to create 3-5 reduced versions of each mesh. Nanite automates this entirely — it generates a hierarchy of detail levels and switches between them per-pixel, not per-object.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "When Nanite Doesn't Work — Limitations",
        summary:
          "Nanite does not support translucent materials, skeletal meshes, or world position offset. Foliage with masked materials can work but requires careful setup. Understanding these limits prevents debugging frustration.",
        sourceType: "epic_learning",
      },
      {
        category: "fix",
        title: "Enabling and Configuring Nanite Per-Mesh",
        summary:
          "Enable Nanite on Static Mesh assets via the Details panel. Use 'Nanite Enabled' checkbox. For Megascans assets, Nanite is auto-enabled. Control fallback LOD distance for non-Nanite platforms.",
        sourceType: "transcript",
      },
      {
        category: "transfer",
        title: "Nanite Performance Profiling and Best Practices",
        summary:
          "Use 'stat Nanite' and the GPU Visualizer to profile Nanite performance. Key metrics: triangle count (should stay under 100M visible), cluster count, and overdraw. Nanite performs best with dense, opaque geometry.",
        sourceType: "docs",
      },
    ],
  },
  {
    id: "ps-cast-vs-interface",
    query: "When should I Cast vs use Interfaces for Blueprint communication?",
    difficulty: "medium",
    estimatedMinutes: 12,
    tags: ["Blueprints", "Architecture", "Interfaces"],
    steps: [
      {
        category: "foundation",
        title: "Blueprint Communication — The Core Problem",
        summary:
          "Blueprints need to talk to each other, but direct references create hard dependencies. If Blueprint A casts to Blueprint B, it loads B into memory even if B isn't in the level. This is the #1 cause of 'why is my game using so much memory?'",
        sourceType: "transcript",
      },
      {
        category: "foundation",
        title: "How Cast Works Under the Hood",
        summary:
          "Cast checks if an object IS a specific class. If it succeeds, you get access to all variables and functions. But Cast creates a hard reference — the engine loads the entire class and all its dependencies into memory at startup.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "The Reference Chain Problem",
        summary:
          "When BP_Player casts to BP_Enemy, it loads BP_Enemy. If BP_Enemy references BP_Weapon, that loads too. This chain can pull hundreds of MB into memory. Use the Reference Viewer to see the damage.",
        sourceType: "epic_learning",
      },
      {
        category: "fix",
        title: "Blueprint Interfaces — Soft Communication",
        summary:
          "Interfaces define a contract without a dependency. BP_Player calls 'TakeDamage' via interface — it doesn't care if the receiver is BP_Enemy, BP_Destructible, or BP_NPC. No hard reference, no memory bloat.",
        sourceType: "transcript",
      },
      {
        category: "transfer",
        title: "Decision Framework — When to Use Each",
        summary:
          "Use Cast when: same class hierarchy, guaranteed type, small project. Use Interface when: different class types need same behavior, modular design needed, memory matters. Use Event Dispatchers when: one-to-many notification.",
        sourceType: "epic_learning",
      },
    ],
  },
  {
    id: "ps-bp-communication",
    query: "How do Blueprints communicate with each other?",
    difficulty: "simple",
    estimatedMinutes: 10,
    tags: ["Blueprints", "Communication", "Fundamentals"],
    steps: [
      {
        category: "foundation",
        title: "Direct References — Get Actor of Class",
        summary:
          "The simplest method: use Get Actor of Class or Get All Actors of Class to find and directly reference other Blueprints. Fast to set up but creates hard dependencies and doesn't scale.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Event Dispatchers — Broadcasting Events",
        summary:
          "Event Dispatchers let one Blueprint broadcast a signal that any number of others can listen to. The broadcaster doesn't need to know who's listening. Perfect for UI updates, game state changes, and decoupled systems.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Blueprint Interfaces — The Clean Solution",
        summary:
          "Interfaces define a function signature without an implementation. Any Blueprint that implements the interface must provide the logic. This is the professional approach — used in AAA games for modular, testable code.",
        sourceType: "epic_learning",
      },
      {
        category: "transfer",
        title: "Choosing the Right Communication Pattern",
        summary:
          "Direct Reference: one-to-one, same level. Event Dispatcher: one-to-many, Event Dispatcher: one-to-many, fire-and-forget. Interface: contract-based, polymorphic. Game Instance: persistent across levels.",
        sourceType: "transcript",
      },
    ],
  },
  {
    id: "ps-lumen-flicker",
    query: "Why is my Lumen lighting flickering or not working?",
    difficulty: "complex",
    estimatedMinutes: 20,
    tags: ["Lumen", "Lighting", "Rendering"],
    steps: [
      {
        category: "foundation",
        title: "How Lumen Global Illumination Works",
        summary:
          "Lumen uses a combination of screen traces, mesh distance fields, and optional hardware ray tracing to calculate indirect lighting in real-time. Understanding this pipeline is key to diagnosing flickering.",
        sourceType: "transcript",
      },
      {
        category: "foundation",
        title: "Screen Traces vs Hardware Ray Tracing",
        summary:
          "Lumen first tries screen-space traces (fast, but limited to visible geometry). When those miss, it falls back to mesh distance field traces. Hardware RT is optional and only needed for reflections on complex geometry.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "Common Causes of Lumen Flicker",
        summary:
          "Flickering usually comes from: (1) Mesh distance fields with thin geometry, (2) Translucent/masked materials confusing screen traces, (3) Too-low Lumen quality settings, (4) Moving lights without proper settings.",
        sourceType: "epic_learning",
      },
      {
        category: "diagnosis",
        title: "Diagnosing with Lumen Visualization Modes",
        summary:
          "Use the Lumen Scene visualization mode (View Mode > Lumen Scene) to see what Lumen 'sees'. Missing or broken geometry in this view directly corresponds to lighting artifacts in the final render.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Fixing Lumen Lighting Issues Step by Step",
        summary:
          "Increase Lumen Scene Detail, enable Software Ray Tracing on problem meshes, adjust 'Final Gather Quality', ensure mesh distance fields are generated for all static meshes. For translucent materials, use Front Layer Translucency.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Lumen Settings for Stable Interior Lighting",
        summary:
          "For interiors: set Lumen GI to 'Detail Tracing', increase 'Mesh Distance Field Resolution Scale', enable 'Use Hardware Ray Tracing when Available'. These settings trade performance for stability.",
        sourceType: "docs",
      },
      {
        category: "transfer",
        title: "Lumen Performance vs Quality Tradeoffs",
        summary:
          "The general principle: Lumen trades between speed and accuracy. Screen traces are fast but imprecise. Distance field traces are better but cost more. Hardware RT is most accurate but requires capable GPU. Choose based on your target platform.",
        sourceType: "epic_learning",
      },
    ],
  },
  {
    id: "ps-project-organization",
    query: "How should I organize my UE5 project files and folders?",
    difficulty: "simple",
    estimatedMinutes: 8,
    tags: ["Project Management", "Best Practices", "Content Browser"],
    steps: [
      {
        category: "foundation",
        title: "Why Folder Structure Matters in Unreal",
        summary:
          "UE5 uses a reference-based asset system. Moving or renaming assets creates redirectors that can break references. A good folder structure from day one prevents painful mass-refactoring later.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "The Standard Folder Structure",
        summary:
          "Top-level: Content/[ProjectName]/. Sub-folders: Blueprints/, Maps/, Materials/, Meshes/, Textures/, UI/, Audio/, Effects/, Characters/, Environment/. Keep third-party assets in Content/ThirdParty/.",
        sourceType: "epic_learning",
      },
      {
        category: "fix",
        title: "Naming Conventions That Scale",
        summary:
          "Prefix assets by type: BP_ (Blueprint), M_ (Material), MI_ (Material Instance), SM_ (Static Mesh), SK_ (Skeletal Mesh), T_ (Texture), WBP_ (Widget Blueprint). This makes filtering and searching instant.",
        sourceType: "docs",
      },
      {
        category: "transfer",
        title: "Asset Management for Team Projects",
        summary:
          "For teams: establish a shared Style Guide, use Collection-based workflows, set up Asset Validation rules in Editor Preferences, and use 'Fix Up Redirectors' regularly. Consider using One File Per Actor for collaboration.",
        sourceType: "epic_learning",
      },
    ],
  },
  {
    id: "ps-world-partition",
    query: "What is World Partition and when do I need it?",
    difficulty: "medium",
    estimatedMinutes: 15,
    tags: ["World Partition", "Open World", "Level Design"],
    steps: [
      {
        category: "foundation",
        title: "World Partition — Replacing World Composition",
        summary:
          "World Partition is UE5's system for managing large worlds. It replaces the old World Composition and Level Streaming systems with an automatic grid-based approach that loads and unloads cells based on player proximity.",
        sourceType: "transcript",
      },
      {
        category: "foundation",
        title: "Streaming Sources and Loading Ranges",
        summary:
          "World Partition uses Streaming Sources (typically the player camera) to determine which grid cells to load. You configure loading ranges per-actor class — large landmarks load at distance, small props load nearby.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "When You Need (and Don't Need) World Partition",
        summary:
          "Need it: open world, large outdoor environments, multiplayer maps. Don't need it: linear indoor levels, small arenas, prototypes. World Partition adds complexity — don't use it just because it's new.",
        sourceType: "epic_learning",
      },
      {
        category: "fix",
        title: "Setting Up World Partition Step by Step",
        summary:
          "Enable via World Settings > World Partition. Set grid cell size (typically 12800-25600). Configure HLOD setup. Use One File Per Actor (OFPA) for team collaboration. Test with 'World Partition Editor' minimap.",
        sourceType: "transcript",
      },
      {
        category: "transfer",
        title: "Data Layers and Runtime Flexibility",
        summary:
          "Data Layers let you organize actors into groups that can be loaded/unloaded independently of the grid. Use them for gameplay phases (load boss arena when quest triggers), seasonal content, or multiplayer game modes.",
        sourceType: "docs",
      },
    ],
  },
  {
    id: "ps-optimize-framerate",
    query: "How do I optimize my game's frame rate?",
    difficulty: "complex",
    estimatedMinutes: 22,
    tags: ["Performance", "Optimization", "Profiling"],
    steps: [
      {
        category: "foundation",
        title: "CPU vs GPU Bound — Finding the Bottleneck",
        summary:
          "The first step is always: are you CPU bound or GPU bound? Use 'stat unit' to see Game Thread, Render Thread, and GPU times. The largest number is your bottleneck. Optimizing the wrong one wastes time.",
        sourceType: "transcript",
      },
      {
        category: "foundation",
        title: "Understanding UE5's Rendering Pipeline",
        summary:
          "Every frame goes through: Game Thread (logic) → Render Thread (draw calls) → GPU (actual rendering). Heavy Blueprints slow the Game Thread. Too many draw calls slow the Render Thread. Complex shaders slow the GPU.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "Unreal Insights and the GPU Visualizer",
        summary:
          "Unreal Insights is the most powerful profiling tool. It captures per-frame CPU and GPU timings, memory allocations, and thread activity. The GPU Visualizer shows exactly which rendering pass is expensive.",
        sourceType: "epic_learning",
      },
      {
        category: "fix",
        title: "CPU Optimization — Blueprints and Game Thread",
        summary:
          "Remove Event Tick where possible, use async loading, reduce physics complexity, set Actor Tick intervals, use Level of Detail for AI. Profile with 'stat game' to find expensive gameplay code.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "GPU Optimization — Materials and Draw Calls",
        summary:
          "Reduce material complexity (fewer texture samples), use Instanced Static Meshes for repeated geometry, merge actors to reduce draw calls, use Nanite for dense geometry, optimize shadow-casting lights.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Scalability Settings and Quality Presets",
        summary:
          "UE5's Scalability system lets you define quality presets (Low/Medium/High/Epic) that adjust rendering settings automatically. Configure these for your target platforms to provide the best experience per hardware.",
        sourceType: "docs",
      },
      {
        category: "transfer",
        title: "Performance Budgeting for Production",
        summary:
          "Set per-frame time budgets early: Game Thread 8ms, Render Thread 8ms, GPU 16ms (for 60fps). Test on target hardware regularly. Performance regression in one area affects everything downstream.",
        sourceType: "epic_learning",
      },
    ],
  },
  {
    id: "ps-profiling-stutter",
    query: "Why does my game stutter and how do I profile performance?",
    difficulty: "medium",
    estimatedMinutes: 15,
    tags: ["Performance", "Profiling", "Debugging"],
    steps: [
      {
        category: "foundation",
        title: "Frame Time vs FPS — Understanding Stutter",
        summary:
          "Stutter isn't low FPS — it's inconsistent frame times. A game running 58-62fps feels smooth. A game swinging 30-60fps feels terrible. Focus on frame time consistency (ms), not average FPS.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "Common Stutter Causes in UE5",
        summary:
          "Hitches come from: shader compilation (first-time material rendering), level streaming spikes, garbage collection pauses, texture streaming, blueprint compilation, and audio decompression. Each has different solutions.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Using stat Commands for Quick Diagnosis",
        summary:
          "Start with 'stat fps', 'stat unit', and 'stat unitgraph'. If Game Thread is spiking, use 'stat game'. If GPU is spiking, use the GPU visualizer. For hitches, 'stat hitches' shows frame time spikes.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Unreal Insights — Deep Profiling",
        summary:
          "For persistent stutters, capture a trace with Unreal Insights (trace start, reproduce stutter, trace stop). Analyze the timeline for spikes — zoom into the spike to see exactly which function or system caused it.",
        sourceType: "epic_learning",
      },
      {
        category: "transfer",
        title: "Preventing Stutter in Production",
        summary:
          "Pre-compile shaders with PSO caching, set up async level streaming with generous preload distances, tune garbage collection frequency, and always test on target hardware with cold cache.",
        sourceType: "docs",
      },
    ],
  },
  {
    id: "ps-lumen-nanite-together",
    query: "How do Lumen and Nanite work together and what are the limitations?",
    difficulty: "complex",
    estimatedMinutes: 20,
    tags: ["Lumen", "Nanite", "Rendering", "UE5"],
    steps: [
      {
        category: "foundation",
        title: "The UE5 Rendering Trio — Nanite, Lumen, VSM",
        summary:
          "UE5's rendering revolution is three systems working together: Nanite (geometry), Lumen (lighting), and Virtual Shadow Maps (shadows). They share data structures — Nanite mesh data feeds directly into Lumen's ray tracing.",
        sourceType: "transcript",
      },
      {
        category: "foundation",
        title: "How Nanite Feeds Lumen",
        summary:
          "Lumen's software ray tracing uses Mesh Distance Fields, which Nanite generates automatically for all Nanite-enabled meshes. More Nanite meshes = better Lumen accuracy, at minimal extra cost.",
        sourceType: "transcript",
      },
      {
        category: "diagnosis",
        title: "Where the Integration Breaks Down",
        summary:
          "Non-Nanite meshes (skeletal meshes, foliage with WPO, translucent objects) create gaps in Lumen's scene representation. This causes light leaking, shadow artifacts, and inconsistent GI around these objects.",
        sourceType: "epic_learning",
      },
      {
        category: "diagnosis",
        title: "Performance Interactions and Tradeoffs",
        summary:
          "Nanite reduces draw call overhead but increases GPU memory. Lumen adds significant GPU cost for GI. Together they can exceed GPU budgets on mid-range hardware. Understanding each system's cost is essential for balancing quality.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Configuring Nanite + Lumen for Best Results",
        summary:
          "Enable Nanite on all opaque static meshes. Use Lumen in Detail Tracing mode for interiors. Set appropriate Lumen Scene quality. For non-Nanite objects, ensure Mesh Distance Fields are generated via project settings.",
        sourceType: "transcript",
      },
      {
        category: "fix",
        title: "Virtual Shadow Maps — The Missing Piece",
        summary:
          "VSM works best with Nanite — it uses the same geometry data for pixel-accurate shadows. Enable VSM in project settings and configure shadow resolution scale. Nanite + VSM eliminates traditional shadow map cascades.",
        sourceType: "docs",
      },
      {
        category: "transfer",
        title: "Platform Scalability — Nanite + Lumen Across Hardware",
        summary:
          "For lower-end platforms: disable hardware RT, reduce Lumen quality, use Nanite fallback meshes. The Scalability system can automatically adjust these per quality preset. Always profile on your minimum target spec.",
        sourceType: "epic_learning",
      },
    ],
  },
];

export default PRE_SEEDED_PATHS;
