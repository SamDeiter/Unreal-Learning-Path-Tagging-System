/**
 * resolveStepTitle.js — Single source of truth for step title display.
 *
 * Centralizes the title resolution logic that was previously duplicated
 * across PathStep.jsx, BespokePath.jsx, WebPlayerPreview.jsx, and scormPackager.js.
 *
 * Priority chain:
 *   1. step.title (AI-generated descriptive title from pathSequencer)
 *   2. segment.title (original content title)
 *   3. segment.videoTitle (video source title)
 *   4. Fallback: "Step N"
 *
 * All titles are cleaned via cleanVideoTitle to strip conference/brand suffixes.
 */

import { cleanVideoTitle } from "./cleanVideoTitle";

/**
 * Resolve the display title for a learning path step.
 *
 * @param {Object} step — path step object (any pipeline shape)
 * @param {number} [index=0] — step index (for fallback numbering)
 * @returns {string} — cleaned display title
 */
export function resolveStepTitle(step, index = 0) {
  if (!step) return `Step ${index + 1}`;

  const segment = step.segment || {};

  const rawTitle =
    step.title ||
    segment.title ||
    segment.videoTitle ||
    "";

  if (!rawTitle) {
    return `Step ${index + 1}`;
  }

  // Clean conference/brand suffixes and decode HTML entities
  let cleaned = cleanVideoTitle(rawTitle);

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

  return cleaned || `Step ${index + 1}`;
}
