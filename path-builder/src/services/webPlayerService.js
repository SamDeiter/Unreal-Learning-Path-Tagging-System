/**
 * webPlayerService.js — Web Player data preparation and progress tracking.
 *
 * Transforms raw path step data into display-ready objects for the
 * in-app WebPlayerPreview component. Handles progress persistence
 * via localStorage so learners can resume where they left off.
 */

import { cleanTranscriptText } from "../utils/cleanTranscriptText";
import { getDisplayName } from "./topicNameService";

/**
 * Strip markdown artifacts from text, producing clean plain text.
 * Summaries are transcript/doc extracts, not intentional markdown,
 * so we remove all formatting characters.
 */
function stripMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/#{1,6}\s*/g, "")            // strip markdown headers (# ## ### etc.)
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1") // strip bold/italic markers
    .replace(/`([^`]+)`/g, "$1")           // strip inline code backticks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // convert [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // strip image syntax
    .replace(/^[-*+]\s+/gm, "• ")          // list markers → bullet
    .replace(/^\d+\.\s+/gm, "")            // strip numbered list markers
    .replace(/^>\s?/gm, "")                // strip blockquotes
    .replace(/---+/g, "")                  // strip horizontal rules
    .replace(/\s{2,}/g, " ")              // collapse whitespace
    .trim();
}

// ── Step Data Preparation ──────────────────────────────────────────

/**
 * Build display-ready step data from raw path steps.
 *
 * @param {Array} steps — Raw path steps from pathSequencer
 * @param {Array} bridges — Bridge narration objects
 * @returns {Array<Object>} — Processed steps ready for rendering
 */
export function prepareStepData(steps, bridges = []) {
  return steps.map((step, idx) => {
    const title = getDisplayName(step) || step.segment?.title || step.title || `Step ${idx + 1}`;

    // Summary resolution — same priority chain as scormPackager
    const rawSummary =
      step.gemini_enriched?.one_sentence_summary ||
      step.summary ||
      step.segment?.summary ||
      step.segment?.text ||
      step.description ||
      "";
    let summary = stripMarkdown(cleanTranscriptText(rawSummary));

    // Fallback for empty summaries
    if (!summary) {
      const docSection = step.doc_meta?.section || "";
      const sourceLabel =
        step.source === "epic_docs"
          ? "Official Unreal Engine documentation"
          : "Reference material";
      summary = docSection
        ? `${sourceLabel} covering ${docSection.replace(/-/g, " ")}.`
        : `${sourceLabel} for ${title}.`;
    }

    const category = step.category || "";
    const phase = step.phase || "";
    const tier = step.tier || step.segment?.tier || "";
    const source = step.segment?.source || step.segment?.type || step.source || "";
    const bridge = bridges[idx] || null;
    const bridgeText = bridge?.text || bridge?.narration || "";

    // Video extraction — mirrors scormPackager logic
    const video = extractVideoInfo(step);

    return {
      title,
      summary,
      category,
      phase,
      tier,
      source,
      bridgeText,
      video,
      index: idx,
    };
  });
}

/**
 * Extract video embed info from a step object.
 * Checks drive_id, YouTube URLs, raw video IDs.
 */
function extractVideoInfo(step) {
  const candidateUrls = [
    step.segment?.videoUrl,
    step.segment?.url,
    step._url,
    step.url,
    step.code,
  ].filter(Boolean);

  const firstVideo = step.videos?.[0] || step.segment?.videos?.[0];
  let driveId = null;
  let youtubeId = null;

  // Check explicit drive_id fields
  if (firstVideo?.drive_id) {
    driveId = firstVideo.drive_id;
  } else if (step.segment?.drive_id) {
    driveId = step.segment.drive_id;
  } else if (step.drive_id) {
    driveId = step.drive_id;
  }

  // Try URLs
  if (!driveId && !youtubeId) {
    for (const videoUrl of candidateUrls) {
      if (!videoUrl) continue;
      const driveMatch =
        videoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        videoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        driveId = driveMatch[1];
        break;
      }
      try {
        const vUrl = new URL(videoUrl);
        if (vUrl.hostname.includes("youtube.com")) {
          youtubeId = vUrl.searchParams.get("v");
          break;
        }
        if (vUrl.hostname.includes("youtu.be")) {
          youtubeId = vUrl.pathname.slice(1);
          break;
        }
      } catch {
        /* not a URL */
      }
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
        youtubeId = videoUrl;
        break;
      }
    }
  }

  // Last resort: videoId field
  if (!driveId && !youtubeId && step.segment?.videoId) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(step.segment.videoId)) {
      youtubeId = step.segment.videoId;
    }
  }

  const startSec = Math.round(step.segment?.startTime || 0);
  const endSec = Math.round(step.segment?.endTime || 0);
  const videoTitle = step.segment?.videoTitle || "";

  if (!driveId && !youtubeId) return null;

  return { driveId, youtubeId, startSec, endSec, videoTitle };
}

// ── Progress Tracking ──────────────────────────────────────────────

const PROGRESS_PREFIX = "wp_progress_";

/**
 * Get progress for a path.
 * @param {string} pathId — Unique path identifier
 * @returns {Object} — { completedSteps: Set<number>, lastStep: number }
 */
export function getProgress(pathId) {
  try {
    const raw = localStorage.getItem(PROGRESS_PREFIX + pathId);
    if (!raw) return { completedSteps: new Set(), lastStep: 0 };
    const data = JSON.parse(raw);
    return {
      completedSteps: new Set(data.completed || []),
      lastStep: data.lastStep || 0,
    };
  } catch {
    return { completedSteps: new Set(), lastStep: 0 };
  }
}

/**
 * Mark a step as completed and save progress.
 */
export function markStepComplete(pathId, stepIndex) {
  const progress = getProgress(pathId);
  progress.completedSteps.add(stepIndex);
  progress.lastStep = stepIndex;
  try {
    localStorage.setItem(
      PROGRESS_PREFIX + pathId,
      JSON.stringify({
        completed: [...progress.completedSteps],
        lastStep: progress.lastStep,
        updatedAt: Date.now(),
      })
    );
  } catch {
    /* storage full */
  }
  return progress;
}

/**
 * Generate a unique path ID from the path title.
 */
export function generatePathId(pathTitle) {
  const base = pathTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 48);
  return `wp_${base}_${Date.now().toString(36)}`;
}

// ── Utilities ──────────────────────────────────────────────────────

/**
 * Format seconds to MM:SS.
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Get CSS class for a category.
 */
export function getCategoryClass(category) {
  const c = category.toLowerCase();
  if (c.includes("foundation") || c.includes("prerequisite"))
    return "wp-cat-foundation";
  if (c.includes("transfer") || c.includes("practice"))
    return "wp-cat-transfer";
  return "wp-cat-core";
}
