import { bench, describe } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

const basePassages = [
  "Lumen enables real-time global illumination and reflections in Unreal Engine 5",
  "Nanite virtualized geometry system allows for massive polygon counts without traditional LODs",
  "Virtual Shadow Maps provide consistent high-resolution shadowing for large worlds",
  "The Niagara effects system is used for complex particle simulations in real-time",
  "Blueprint visual scripting allows designers to create logic without writing C++ code",
  "MetaSounds provide a high-performance audio engine with procedural generation",
  "Chaos Physics system handles destruction and cloth simulation in UE5",
  "World Partition system automates level streaming and collaborative workflows",
  "The Modeling Toolkit enables editing static meshes directly within the editor",
  "Common UI plugin helps building cross-platform user interfaces with ease",
  "Enhanced Input system provides a modular approach to handling player actions",
  "Substrate is a new material system replacing the legacy monolithic shading model",
  "State Tree is a general-purpose hierarchical state machine for AI and gameplay",
  "Motion Warping allows characters to dynamically adjust animations to hit targets",
  "IK Rig and IK Retargeter simplify animation reuse across different skeletons",
  "Data Assets provide a structured way to store configuration data in the engine",
  "The Gameplay Ability System (GAS) is a framework for building RPG-style abilities",
  "Mass Entity system enables high-performance simulation of thousands of agents",
  "Neural Network Inference (NNI) plugin allows running ML models in real-time",
  "Remote Control API enables controlling Unreal Engine from external devices",
];

// Create a larger set of passages for more stress
const passages = [];
for (let i = 0; i < 5; i++) {
  passages.push(...basePassages.map((p, idx) => `${p} ${idx}_${i}`));
}

describe("wordJaccard Benchmarks (100 passages)", () => {
  bench("Original wordJaccard loop (100 passages, O(N^2))", () => {
    const results = [];
    for (let i = 0; i < passages.length; i++) {
      const isDupe = results.some(
        (kept) => wordJaccard(kept, passages[i]) > 0.7
      );
      if (!isDupe) results.push(passages[i]);
    }
  });

  bench("Optimized wordJaccard loop (100 passages, pre-calculated Sets)", () => {
    const wordSetMap = new Map();
    for (const p of passages) {
      wordSetMap.set(p, getWordSet(p));
    }

    const results = [];
    for (const p of passages) {
      const pSet = wordSetMap.get(p);
      const isDupe = results.some(
        (kept) => wordJaccardFromSets(wordSetMap.get(kept), pSet) > 0.7
      );
      if (!isDupe) results.push(p);
    }
  });
});
