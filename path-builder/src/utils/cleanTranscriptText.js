/**
 * cleanTranscriptText.js — Shared transcript cleaning utility
 *
 * Strips conversational filler, lesson transitions, and informal phrasing
 * from raw video transcript text before displaying in SCORM export,
 * SCORM preview, or in-app step views.
 *
 * @param {string} text — Raw transcript text
 * @returns {string} — Cleaned text suitable for display
 */
export function cleanTranscriptText(text) {
  if (!text || typeof text !== "string") return text;

  // Patterns that indicate raw transcript filler
  const fillerPatterns = [
    /^(well,?|okay,?|so,?|alright,?|hey,?|hi,?|now,?)\s+/gi,
    /\b(that's it for this (lesson|video|section|module|tutorial))\b.*$/gim,
    /\b(in the next (lesson|video|section|module))\b.*$/gim,
    /\b(let's (go ahead and|take a look|jump (in|right in)))\b/gi,
    /\b(we're gonna|we are going to|I'm gonna|I am going to)\b/gi,
    /\b(as you can see|as I mentioned|like I said)\b/gi,
    /\b(don't forget to|make sure you|remember to) (like|subscribe|hit the bell)\b.*$/gim,
    /\b(thanks for watching|see you in the next)\b.*$/gim,
  ];

  let cleaned = text;
  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Clean up leftover whitespace and punctuation artifacts
  cleaned = cleaned
    .replace(/\s{2,}/g, " ")    // collapse multiple spaces
    .replace(/^[\s,;.]+|[\s,;]+$/g, "")  // trim leading/trailing punctuation
    .replace(/^\s+/gm, "")      // trim line-leading whitespace
    .trim();

  // If cleaning removed most of the content, fall back to original
  if (cleaned.length < 20 && text.length > 50) return text;

  return cleaned;
}
