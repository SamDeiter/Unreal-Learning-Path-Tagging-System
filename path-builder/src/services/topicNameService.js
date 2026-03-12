/**
 * topicNameService.js — Generate descriptive display names for courses/steps.
 *
 * Replaces raw filenames like "PGT_219.00_07_Setting Up Base Materials"
 * with structured topic names like "World Building - Base Materials Setup".
 *
 * Uses existing enrichment data (tags.topic, canonical_tags, ai_tags, title)
 * via a local heuristic — no Gemini call needed.
 */

const MAX_NAME_LENGTH = 60;

/** Truncate at the nearest word boundary without clipping mid-word. */
function smartTruncate(str, max = MAX_NAME_LENGTH) {
  if (!str || str.length <= max) return str;
  const truncated = str.substring(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > max * 0.6 ? truncated.substring(0, lastSpace) + "…" : truncated + "…";
}

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

/**
 * Generate a descriptive display name for a course or step.
 *
 * @param {Object} item - A course or path step object
 * @returns {string} - Formatted display name like "Landscape - Sculpting Terrain"
 */
export function getDisplayName(item) {
  if (!item) return "Untitled Step";

  // ── Doc-sourced steps: use doc-specific fields ──
  if (isDocItem(item)) {
    return smartTruncate(getDocDisplayName(item));
  }

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
  // Priority C: AI-generated content
  else if (item.source === "ai_generated" || item.code?.startsWith?.("ai-")) {
    prefix = "AI Guide";
  }

  // ── 2. Determine the specific focus ──
  // Priority: AI summary > step summary > cleaned title
  let focus = "";

  // Try AI-generated summary first (best quality)
  const aiSummary = item.gemini_enriched?.one_sentence_summary || "";
  if (aiSummary) {
    focus = extractShortPhrase(aiSummary);
  }

  // Try step summary (set by pathSequencer)
  if (!focus) {
    const stepSummary = item.summary || "";
    if (stepSummary && stepSummary.length > 10) {
      focus = extractShortPhrase(stepSummary);
    }
  }

  // Fallback to cleaned title
  if (!focus) {
    const rawTitle = item.segment?.title || item.title || "";
    const cleaned = stripTitleNoise(rawTitle);
    focus = extractFocus(cleaned);
  }

  // ── 3. Build the display name ──
  if (prefix && focus) {
    if (focus.toLowerCase().includes(prefix.toLowerCase())) {
      return smartTruncate(titleCase(focus));
    }
    return smartTruncate(`${titleCase(prefix)} - ${titleCase(focus)}`);
  }

  if (prefix && !focus) {
    return titleCase(prefix);
  }

  if (!prefix && focus) {
    return smartTruncate(titleCase(focus));
  }

  // Absolute fallback
  return item.code || "Untitled Step";
}

/**
 * Extract a short, descriptive phrase from a summary sentence.
 * E.g. "This video covers how to set up VSM receiver masks for lights"
 * → "Setting Up VSM Receiver Masks"
 */
function extractShortPhrase(summary) {
  if (!summary || summary.length < 10) return "";

  // Strip common filler prefixes
  let cleaned = summary
    .replace(/^(this\s+(video|lesson|step|section|module|tutorial|guide)\s+(covers?|explains?|demonstrates?|shows?|teaches?|walks?\s+through)\s+(how\s+to\s+)?)/i, "")
    .replace(/^(learn(ing)?\s+(how\s+to\s+|about\s+)?)/i, "")
    .replace(/^(how\s+to\s+)/i, "")
    .replace(/^(in\s+this\s+(video|lesson|step|section),?\s*)/i, "")
    .replace(/^(an?\s+overview\s+of\s+)/i, "")
    .replace(/^(introduction\s+to\s+)/i, "")
    .trim();

  if (!cleaned) return "";

  // Take first meaningful clause (before comma, period, semicolon, or "and")
  const clause = cleaned.split(/[,;.]|\band\b/)[0]?.trim() || cleaned;

  // Take 3-6 words
  const words = clause.split(/\s+/).slice(0, 6);
  const phrase = words.join(" ");

  // Skip if too short or too generic
  if (phrase.length < 5) return "";
  const generic = ["the", "a", "an", "unreal", "engine"];
  if (generic.includes(phrase.toLowerCase())) return "";

  return phrase;
}

// ── Doc-specific naming ────────────────────────────────────────────

/** Check if item is from the docs pipeline. */
function isDocItem(item) {
  return (
    item.source === "epic_docs" ||
    item.segment?.source === "epic_docs" ||
    item.type === "doc" ||
    item.code?.startsWith?.("doc_") ||
    item.code?.startsWith?.("doc-")
  );
}

/**
 * Generate a unique name for documentation items.
 * Uses: label > key > section + title to differentiate segments.
 */
function getDocDisplayName(item) {
  // Try doc-specific fields first (from docsSearchService / coverageAnalyzer)
  const label = item.label || "";
  const key = item.key || "";
  const section = item.section || item.segment?.section || "";
  const subsystem = item.subsystem || item.segment?.subsystem || "";
  const rawTitle = item.segment?.title || item.title || "";
  const description = item.description || item.segment?.description || "";

  // Best case: label is the doc page title (e.g., "Lumen Global Illumination and Reflections")
  // + section differentiates within it (e.g., "Performance Settings")
  if (label && section) {
    // Use section as the differentiator within the same doc
    const cleanSection = titleCase(section.replace(/[-_]/g, " "));
    return `${cleanLabel(label)} — ${cleanSection}`;
  }

  // If we have label only, try to enrich it with subsystem
  if (label) {
    if (subsystem && !label.toLowerCase().includes(subsystem.toLowerCase())) {
      return `${titleCase(subsystem)} - ${cleanLabel(label)}`;
    }
    return cleanLabel(label);
  }

  // If we have key (e.g., "lumen-global-illumination"), format it
  if (key) {
    const formatted = titleCase(key.replace(/[-_]/g, " "));
    if (section) {
      return `${formatted} — ${titleCase(section.replace(/[-_]/g, " "))}`;
    }
    return formatted;
  }

  // Fallback: use cleaned title + extract first unique phrase from description
  const cleaned = stripTitleNoise(rawTitle);
  if (cleaned && description) {
    const descFocus = extractDescFocus(description, cleaned);
    if (descFocus) {
      return `${titleCase(cleaned)} — ${titleCase(descFocus)}`;
    }
  }

  if (cleaned) {
    return titleCase(cleaned);
  }

  return "Documentation Step";
}

/** Clean a doc label (remove "UE5" prefix noise, trim). */
function cleanLabel(label) {
  return label
    .replace(/^(Unreal Engine \d+(\.\d+)?|UE\d+)\s*[-:–]\s*/i, "")
    .trim();
}

/** Extract a short differentiating phrase from description text. */
function extractDescFocus(description, titleUsed) {
  if (!description) return "";
  // Take first sentence or first 40 chars
  const firstSentence = description.split(/[.!?]/)[0]?.trim() || "";
  if (!firstSentence) return "";
  // Skip if it just repeats the title
  if (firstSentence.toLowerCase().includes(titleUsed.toLowerCase())) return "";
  // Take first 3-4 meaningful words
  const words = firstSentence.split(/\s+/).slice(0, 4).join(" ");
  return words.length > 5 ? words : "";
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
