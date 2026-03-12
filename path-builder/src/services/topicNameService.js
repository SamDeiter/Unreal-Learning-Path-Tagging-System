/**
 * topicNameService.js — Generate descriptive display names for courses/steps.
 *
 * Replaces raw filenames like "PGT_219.00_07_Setting Up Base Materials"
 * with structured topic names like "World Building - Base Materials Setup".
 *
 * Uses existing enrichment data (tags.topic, canonical_tags, ai_tags, title)
 * via a local heuristic — no Gemini call needed.
 */

// ── Canonical tag → human label mapping ────────────────────────────
const CANONICAL_LABELS = {
  "scripting.blueprint": "Blueprints",
  "scripting.cpp": "C++",
  "scripting.python": "Python",
  "rendering.material": "Materials",
  "rendering.lighting": "Lighting",
  "rendering.lumen": "Lumen",
  "rendering.nanite": "Nanite",
  "rendering.postprocess": "Post Processing",
  "rendering.niagara": "Niagara VFX",
  "rendering.general": "Rendering",
  "animation.general": "Animation",
  "animation.controlrig": "Control Rig",
  "animation.sequencer": "Sequencer",
  "animation.ik": "IK & Retargeting",
  "environment.landscape": "Landscape",
  "environment.foliage": "Foliage",
  "environment.water": "Water",
  "procedural.pcg": "PCG",
  "procedural.houdini": "Houdini",
  "cinematic.sequencer": "Cinematic Sequencer",
  "cinematic.virtualcamera": "Virtual Camera",
  "physics.chaos": "Chaos Physics",
  "physics.general": "Physics",
  "audio.metasound": "MetaSounds",
  "audio.general": "Audio",
  "networking.replication": "Replication",
  "networking.general": "Networking",
  "ui.umg": "UMG UI",
  "ui.commonui": "Common UI",
  "ai.behaviortree": "Behavior Trees",
  "ai.masssystem": "Mass AI",
  "vp.composure": "Virtual Production",
  "vp.ndisplay": "nDisplay",
};

// ── Title cleaning helpers ─────────────────────────────────────────

/** Strip file extensions, version numbers, course codes, and formatting artifacts. */
function stripTitleNoise(title) {
  if (!title) return "";
  return title
    .replace(/\.(mp4|mov|avi|mkv|webm|mp3|wav|pdf|docx?)$/i, "") // extensions
    .replace(/^PGT_\d+\.\d+_\d+_/i, "")   // PGT_219.00_07_ prefix
    .replace(/^\d{1,3}\.\d{1,2}_\d+_/g, "") // 311.01_02_ prefix
    .replace(/^\d{1,3}[-_.]\s*/g, "")        // leading "01_", "001-", "1. "
    .replace(/_\d+\.\d+$/g, "")              // trailing version "_5.00"
    .replace(/_\d{2}$/g, "")                 // trailing version "_56"
    .replace(/[_]/g, " ")                    // underscores → spaces
    .replace(/([a-z])([A-Z])/g, "$1 $2")     // camelCase → words
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // ABCDef → ABC Def
    .replace(/\s{2,}/g, " ")                 // collapse spaces
    .trim();
}

/** Title case a string. */
function titleCase(str) {
  if (!str) return "";
  const small = new Set(["a", "an", "the", "and", "or", "but", "in", "on", "of", "for", "to", "with", "vs"]);
  return str
    .split(" ")
    .map((w, i) => {
      if (i === 0 || !small.has(w.toLowerCase())) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      }
      return w.toLowerCase();
    })
    .join(" ");
}

/** Extract the most specific/useful keyword from a cleaned title. */
function extractFocus(cleanedTitle) {
  if (!cleanedTitle) return "";
  // Skip generic words
  const skipWords = new Set([
    "intro", "introduction", "overview", "outro", "thankyou", "thank you",
    "course outline", "courseoutline", "part 1", "part 2", "part 3",
  ]);
  const lower = cleanedTitle.toLowerCase();
  if (skipWords.has(lower)) return "";
  return cleanedTitle;
}

// ── Main export ────────────────────────────────────────────────────

/**
 * Generate a descriptive display name for a course or step.
 *
 * @param {Object} item - A course or path step object
 * @returns {string} - Formatted display name like "Landscape - Sculpting Terrain"
 */
export function getDisplayName(item) {
  if (!item) return "Untitled Step";

  // ── 1. Determine the topic/category prefix ──
  let prefix = "";

  // Priority A: tags.topic (most reliable structured data)
  if (item.tags?.topic) {
    prefix = item.tags.topic;
  }
  // Priority B: first canonical_tag label
  else if (item.canonical_tags?.length > 0) {
    const firstTag = item.canonical_tags[0];
    prefix = CANONICAL_LABELS[firstTag] || formatCanonicalTag(firstTag);
  }
  // Priority C: segment category for bespoke path steps
  else if (item.segment?.source === "epic_docs") {
    prefix = "Documentation";
  }
  else if (item.source === "ai_generated" || item.code?.startsWith?.("ai-")) {
    prefix = "AI Guide";
  }

  // ── 2. Determine the specific focus from title ──
  const rawTitle = item.segment?.title || item.title || "";
  const cleaned = stripTitleNoise(rawTitle);
  const focus = extractFocus(cleaned);

  // ── 3. Build the display name ──
  if (prefix && focus) {
    // Avoid redundancy: if focus already contains the prefix, just show focus
    if (focus.toLowerCase().includes(prefix.toLowerCase())) {
      return titleCase(focus).substring(0, 55);
    }
    return `${titleCase(prefix)} - ${titleCase(focus)}`.substring(0, 55);
  }

  if (prefix && !focus) {
    // Have a topic but title is generic (e.g. "Intro" or "Overview")
    return titleCase(prefix);
  }

  if (!prefix && focus) {
    return titleCase(focus).substring(0, 55);
  }

  // Absolute fallback
  return item.code || "Untitled Step";
}

/**
 * Format a canonical tag string into a readable label.
 * e.g. "rendering.lumen" → "Lumen", "environment.landscape" → "Landscape"
 */
function formatCanonicalTag(tag) {
  if (!tag) return "";
  // Check lookup first
  if (CANONICAL_LABELS[tag]) return CANONICAL_LABELS[tag];
  // Otherwise take the last segment and title-case it
  const parts = tag.split(".");
  const last = parts[parts.length - 1] || "";
  return titleCase(last.replace(/[_-]/g, " "));
}

export default { getDisplayName };
