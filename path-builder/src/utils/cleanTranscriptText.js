/**
 * cleanTranscriptText.js — Shared transcript cleaning utility
 *
 * Strips conversational filler, lesson transitions, informal phrasing,
 * and Epic Games documentation boilerplate (version selectors, nav elements)
 * from raw text before displaying in SCORM export, preview, or in-app views.
 *
 * @param {string} text — Raw transcript / description text
 * @returns {string} — Cleaned text suitable for display (may be "" if all garbage)
 */
export function cleanTranscriptText(text) {
  if (!text || typeof text !== "string") return "";

  // ── 1. Strip entire version-selector blocks ──────────────────────────
  // Epic docs pages begin with a dropdown listing every engine version.
  // Detect 3+ consecutive "Unreal Engine X.Y" lines and nuke the block.
  let cleaned = text.replace(
    /(?:Unreal Engine\s+\d+\.\d+\s*\\?n?\s*){3,}/gi,
    " "
  );

  // ── 2. Transcript filler patterns ────────────────────────────────────
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
  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // ── 3. Epic docs boilerplate ─────────────────────────────────────────
  const docsBoilerplate = [
    // Individual "Unreal Engine X.XX" mentions (catches 4.27, 5.7, etc.)
    /Unreal Engine\s+\d+\.\d+(?: Documentation)?/gi,
    /Epic Developer Community/gi,
    // Tolerant Table-of-Contents match: scraped text often gets truncated
    // mid-word ("Table of Conte"), so match any prefix of "Contents".
    /Table of Cont(?:ents?|ent|en|e)?/gi,
    /##?\s*What's New\??/gi,
    // Community / nav links that leak into scraped text
    /Ask questions and help your peers\s*Developer Forums/gi,
    /Write your own tutorials or read those from others\s*Learning Library/gi,
    /\|/g, // stray pipe characters from header breadcrumbs
  ];
  for (const pattern of docsBoilerplate) {
    cleaned = cleaned.replace(pattern, "");
  }

  // ── 4. Detect and remove truncated trailing sentences ────────────────
  // If text ends mid-word (no sentence-ending punctuation), trim the
  // last partial sentence so the user doesn't see cut-off fragments.
  cleaned = cleaned.replace(/[.!?]\s+[A-Z][^.!?]{0,60}$/s, (match) => {
    // Only trim if the fragment is clearly incomplete (< 40 chars)
    const fragment = match.slice(match.indexOf(" ") + 1);
    return fragment.length < 40 ? match[0] : match; // keep the period
  });

  // ── 5. Whitespace cleanup ───────────────────────────────────────────
  cleaned = cleaned
    .replace(/\\n/g, " ")       // literal \n from JSON
    .replace(/\s{2,}/g, " ")    // collapse multiple spaces
    .replace(/^[\s,;.]+|[\s,;]+$/g, "")  // trim leading/trailing junk
    .replace(/^\s+/gm, "")      // trim line-leading whitespace
    .trim();

  // If cleaning removed most of the content, return empty string
  // so the caller can provide a proper fallback (e.g. title-based).
  if (cleaned.length < 20) return "";

  return cleaned;
}

