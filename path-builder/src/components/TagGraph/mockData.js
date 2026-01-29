/**
 * Mock Data for TagGraph Demo
 *
 * Provides sample tags and edges for testing the Tag Connection Graph.
 * This simulates a realistic tag network with various connection strengths.
 */

// Sample tags with varying counts (frequency/importance)
export const mockTags = [
  { id: "blueprints", label: "Blueprints", count: 89 },
  { id: "materials", label: "Materials", count: 67 },
  { id: "landscape", label: "Landscape", count: 54 },
  { id: "lighting", label: "Lighting", count: 48 },
  { id: "animation", label: "Animation", count: 45 },
  { id: "rendering", label: "Rendering", count: 42 },
  { id: "physics", label: "Physics", count: 38 },
  { id: "ai", label: "AI / Behavior Trees", count: 35 },
  { id: "ui", label: "UI / UMG", count: 33 },
  { id: "audio", label: "Audio", count: 28 },
  { id: "niagara", label: "Niagara VFX", count: 27 },
  { id: "sequencer", label: "Sequencer", count: 25 },
  { id: "world-building", label: "World Building", count: 24 },
  { id: "optimization", label: "Optimization", count: 22 },
  { id: "networking", label: "Networking", count: 20 },
  { id: "cpp", label: "C++ Programming", count: 19 },
  { id: "python", label: "Python Scripting", count: 15 },
  { id: "pcg", label: "PCG (Procedural)", count: 14 },
  { id: "cinematics", label: "Cinematics", count: 13 },
  { id: "virtual-production", label: "Virtual Production", count: 12 },
  { id: "metahumans", label: "MetaHumans", count: 11 },
  { id: "quixel", label: "Quixel / Megascans", count: 10 },
  { id: "lumen", label: "Lumen GI", count: 9 },
  { id: "nanite", label: "Nanite", count: 9 },
  { id: "chaos", label: "Chaos Physics", count: 8 },
  { id: "water", label: "Water System", count: 7 },
  { id: "foliage", label: "Foliage", count: 7 },
  { id: "splines", label: "Splines", count: 6 },
  { id: "data-tables", label: "Data Tables", count: 5 },
  { id: "gameplay-abilities", label: "Gameplay Abilities", count: 5 },
];

// Sample edges with varying weights (connection strength)
export const mockEdges = [
  // Strong connections (high weight)
  { sourceTagId: "blueprints", targetTagId: "cpp", weight: 85 },
  { sourceTagId: "materials", targetTagId: "rendering", weight: 92 },
  { sourceTagId: "lighting", targetTagId: "rendering", weight: 88 },
  { sourceTagId: "landscape", targetTagId: "foliage", weight: 90 },
  { sourceTagId: "animation", targetTagId: "sequencer", weight: 78 },
  { sourceTagId: "niagara", targetTagId: "materials", weight: 75 },
  { sourceTagId: "lumen", targetTagId: "lighting", weight: 95 },
  { sourceTagId: "nanite", targetTagId: "rendering", weight: 88 },
  { sourceTagId: "metahumans", targetTagId: "animation", weight: 82 },

  // Medium connections
  { sourceTagId: "blueprints", targetTagId: "ui", weight: 65 },
  { sourceTagId: "blueprints", targetTagId: "ai", weight: 70 },
  { sourceTagId: "blueprints", targetTagId: "physics", weight: 60 },
  { sourceTagId: "materials", targetTagId: "landscape", weight: 55 },
  { sourceTagId: "materials", targetTagId: "quixel", weight: 72 },
  { sourceTagId: "lighting", targetTagId: "cinematics", weight: 68 },
  { sourceTagId: "animation", targetTagId: "metahumans", weight: 82 },
  { sourceTagId: "ai", targetTagId: "gameplay-abilities", weight: 58 },
  { sourceTagId: "world-building", targetTagId: "landscape", weight: 75 },
  { sourceTagId: "world-building", targetTagId: "pcg", weight: 70 },
  { sourceTagId: "sequencer", targetTagId: "cinematics", weight: 85 },
  { sourceTagId: "virtual-production", targetTagId: "cinematics", weight: 80 },
  { sourceTagId: "virtual-production", targetTagId: "sequencer", weight: 65 },
  { sourceTagId: "chaos", targetTagId: "physics", weight: 90 },
  { sourceTagId: "water", targetTagId: "landscape", weight: 72 },
  { sourceTagId: "pcg", targetTagId: "landscape", weight: 68 },
  { sourceTagId: "pcg", targetTagId: "foliage", weight: 65 },

  // Weaker connections
  { sourceTagId: "blueprints", targetTagId: "networking", weight: 45 },
  { sourceTagId: "blueprints", targetTagId: "optimization", weight: 50 },
  { sourceTagId: "blueprints", targetTagId: "audio", weight: 35 },
  { sourceTagId: "cpp", targetTagId: "optimization", weight: 55 },
  { sourceTagId: "cpp", targetTagId: "networking", weight: 52 },
  { sourceTagId: "python", targetTagId: "blueprints", weight: 40 },
  { sourceTagId: "python", targetTagId: "data-tables", weight: 48 },
  { sourceTagId: "materials", targetTagId: "niagara", weight: 75 },
  { sourceTagId: "materials", targetTagId: "lighting", weight: 60 },
  { sourceTagId: "ui", targetTagId: "cpp", weight: 42 },
  { sourceTagId: "audio", targetTagId: "sequencer", weight: 38 },
  { sourceTagId: "audio", targetTagId: "cinematics", weight: 35 },
  { sourceTagId: "rendering", targetTagId: "optimization", weight: 65 },
  { sourceTagId: "rendering", targetTagId: "nanite", weight: 88 },
  { sourceTagId: "rendering", targetTagId: "lumen", weight: 82 },
  { sourceTagId: "ai", targetTagId: "blueprints", weight: 70 },
  { sourceTagId: "ai", targetTagId: "cpp", weight: 55 },
  { sourceTagId: "animation", targetTagId: "physics", weight: 45 },
  { sourceTagId: "animation", targetTagId: "niagara", weight: 40 },
  { sourceTagId: "splines", targetTagId: "blueprints", weight: 55 },
  { sourceTagId: "splines", targetTagId: "landscape", weight: 48 },
  { sourceTagId: "data-tables", targetTagId: "blueprints", weight: 62 },
  { sourceTagId: "gameplay-abilities", targetTagId: "blueprints", weight: 65 },
  { sourceTagId: "quixel", targetTagId: "landscape", weight: 58 },
  { sourceTagId: "quixel", targetTagId: "world-building", weight: 55 },
  { sourceTagId: "foliage", targetTagId: "pcg", weight: 65 },
  { sourceTagId: "foliage", targetTagId: "world-building", weight: 60 },

  // Cross-domain connections
  { sourceTagId: "virtual-production", targetTagId: "lumen", weight: 50 },
  { sourceTagId: "virtual-production", targetTagId: "materials", weight: 45 },
  { sourceTagId: "metahumans", targetTagId: "materials", weight: 55 },
  { sourceTagId: "metahumans", targetTagId: "lighting", weight: 48 },
  { sourceTagId: "cinematics", targetTagId: "audio", weight: 35 },
  { sourceTagId: "networking", targetTagId: "optimization", weight: 42 },
  { sourceTagId: "physics", targetTagId: "chaos", weight: 90 },
  { sourceTagId: "physics", targetTagId: "niagara", weight: 52 },
  { sourceTagId: "water", targetTagId: "materials", weight: 55 },
  { sourceTagId: "water", targetTagId: "niagara", weight: 48 },
];

export default { mockTags, mockEdges };
