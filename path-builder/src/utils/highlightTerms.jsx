/**
 * highlightTerms — Scans text for UE5 terms and wraps them in <strong>.
 *
 * Handles:
 *  - Quoted terms: 'Enable Nanite Support' → <strong>Enable Nanite Support</strong>
 *  - Menu paths: Edit → Project Settings
 *  - Known UE5 subsystems/keywords
 */
import React from "react";

// UE5 subsystems and important keywords (case-insensitive match)
const UE5_TERMS = [
  // Rendering
  "Lumen",
  "Nanite",
  "Niagara",
  "Virtual Shadow Maps",
  "VSM",
  "Path Tracing",
  "Forward Shading",
  "Deferred Shading",
  "Ray Tracing",
  "Screen Space Reflections",
  // Core Systems
  "World Partition",
  "Level Streaming",
  "Data Layers",
  "Blueprint",
  "Blueprints",
  "C\\+\\+",
  "Actor",
  "Component",
  "Pawn",
  "Character",
  "GameMode",
  "PlayerController",
  "AnimBlueprint",
  // UI/Editor
  "Content Browser",
  "Details panel",
  "World Outliner",
  "Static Mesh Editor",
  "Material Editor",
  "Blueprint Editor",
  "Sequencer",
  "Level Sequence",
  "Project Settings",
  "World Settings",
  "Rendering Settings",
  // Assets
  "Static Mesh",
  "Skeletal Mesh",
  "Material Instance",
  "Quixel",
  "Megascans",
  "MetaHuman",
  // Features
  "Chaos Physics",
  "Enhanced Input",
  "Gameplay Ability System",
  "GAS",
  "Common UI",
  "UMG",
];

// Build regex: match quoted terms OR known UE5 terms
const quotedPattern = "'([^']{2,60})'";
const menuPathPattern = "([A-Z][\\w ]+(?:\\s*(?:→|->|>)\\s*[A-Z][\\w ]+)+)";
const termsPattern = UE5_TERMS.map((t) => `\\b${t}\\b`).join("|");
const HIGHLIGHT_RE = new RegExp(`${quotedPattern}|${menuPathPattern}|${termsPattern}`, "gi");

/**
 * Takes a plain text string and returns React elements with
 * important terms wrapped in <strong>.
 */
export default function highlightTerms(text) {
  if (!text || typeof text !== "string") return text;

  const parts = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  HIGHLIGHT_RE.lastIndex = 0;

  while ((match = HIGHLIGHT_RE.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Determine display text
    const quoted = match[1]; // Group 1: content inside single quotes
    const menuPath = match[2]; // Group 2: menu path like Edit → Settings
    const display = quoted || menuPath || match[0];

    parts.push(
      <strong key={match.index} className="hl-term">
        {display}
      </strong>
    );

    lastIndex = HIGHLIGHT_RE.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no matches found, return original string
  return parts.length > 0 ? parts : text;
}
