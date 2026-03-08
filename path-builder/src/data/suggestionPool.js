/**
 * suggestionPool.js — Pre-built UE5 question suggestions
 *
 * Topic-tagged suggestions that appear as pills in the BespokePath
 * query input. Tags drive keyword-based filtering as the user types.
 */

const SUGGESTION_POOL = [
  // Animation & Movement
  {
    q: "How do I fix character animation jittering in multiplayer?",
    tags: ["animation", "character", "jitter", "multiplayer", "network", "movement"],
  },
  {
    q: "Why does my animation montage not replicate to other clients?",
    tags: ["animation", "montage", "replicate", "multiplayer", "network"],
  },
  {
    q: "How to blend animations smoothly in an animation blueprint?",
    tags: ["animation", "blend", "blueprint", "anim"],
  },
  // Materials & Rendering
  {
    q: "Why does my material look different in Lumen vs path tracing?",
    tags: ["material", "lumen", "path tracing", "rendering", "lighting"],
  },
  {
    q: "Why is my landscape material tiling so visible at distance?",
    tags: ["landscape", "material", "tiling", "distance", "terrain"],
  },
  {
    q: "How to create a glass or translucent material in UE5?",
    tags: ["material", "glass", "translucent", "shader", "rendering"],
  },
  {
    q: "Why is my Lumen lighting flickering or not working?",
    tags: ["lumen", "lighting", "flicker", "rendering", "GI"],
  },
  // Nanite & Performance
  {
    q: "How to optimize Nanite meshes for open world performance?",
    tags: ["nanite", "optimize", "performance", "open world", "mesh"],
  },
  {
    q: "How do I profile and fix frame rate drops?",
    tags: ["performance", "profile", "frame rate", "optimize", "fps", "stat"],
  },
  {
    q: "Why does my game stutter when loading new areas?",
    tags: ["performance", "stutter", "loading", "streaming", "level"],
  },
  // Blueprints
  {
    q: "How do Blueprints communicate with each other?",
    tags: ["blueprint", "communicate", "interface", "event", "dispatch", "cast"],
  },
  {
    q: "When should I Cast vs use Interfaces for Blueprint communication?",
    tags: ["blueprint", "cast", "interface", "communicate", "architecture"],
  },
  // GAS & Combat
  {
    q: "Setting up Gameplay Ability System for a melee combat game",
    tags: ["GAS", "gameplay ability", "combat", "melee", "ability"],
  },
  {
    q: "How to set up combo attacks using GAS gameplay effects?",
    tags: ["GAS", "gameplay ability", "combo", "attack", "effect"],
  },
  // Networking
  {
    q: "How does replication work for actors in multiplayer?",
    tags: ["replication", "multiplayer", "network", "actor", "server"],
  },
  {
    q: "How to set up dedicated server multiplayer in UE5?",
    tags: ["server", "dedicated", "multiplayer", "network", "session"],
  },
  // AI
  {
    q: "How to set up an AI behavior tree for enemy patrol?",
    tags: ["AI", "behavior tree", "enemy", "patrol", "NPC"],
  },
  {
    q: "How to use Environment Query System for AI decision making?",
    tags: ["AI", "EQS", "environment query", "decision", "NPC"],
  },
  // World Building
  {
    q: "How should I organize my UE5 project files and folders?",
    tags: ["project", "organize", "folder", "file", "structure", "content browser"],
  },
  {
    q: "What is World Partition and when do I need it?",
    tags: ["world partition", "open world", "streaming", "level", "landscape"],
  },
  // Physics
  {
    q: "How to set up physics simulation for destructible objects?",
    tags: ["physics", "destructible", "chaos", "destruction", "simulate"],
  },
  // UI
  {
    q: "How to create a responsive HUD using UMG widgets?",
    tags: ["UI", "HUD", "UMG", "widget", "UMG", "responsive"],
  },
  // Niagara
  {
    q: "How to create particle effects using Niagara?",
    tags: ["niagara", "particle", "effect", "VFX", "emitter"],
  },
];

export const DEFAULT_SUGGESTIONS = SUGGESTION_POOL.slice(0, 5).map((s) => s.q);

export default SUGGESTION_POOL;
