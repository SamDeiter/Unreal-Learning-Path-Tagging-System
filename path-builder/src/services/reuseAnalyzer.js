/**
 * reuseAnalyzer.js — Video Content Reuse Analyzer
 *
 * For each step in a V2 learning path, determines whether the topic
 * can be covered by existing video content (REUSE), partially covered
 * (ADAPT), or requires new recording (RECORD).
 *
 * Uses:
 *   - embedQuery Cloud Function → 768-dim embeddings
 *   - vectorSearchSegments Cloud Function → Firestore KNN
 *   - videoSplicer.extractTopicSegments() → relevance scoring
 *   - videoSplicer.generateFFmpegCommands() → splice commands
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { extractTopicSegments, generateFFmpegCommands } from "./videoSplicer";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { devLog, devWarn } from "../utils/logger";

// ── Thresholds ─────────────────────────────────────────────

const REUSE_THRESHOLD = 0.76; // ≥ 0.76 = 🟢 REUSE (existing video closely covers this)
const ADAPT_THRESHOLD = 0.72; // 0.72–0.76 = 🟡 ADAPT (partial match, needs editing)
// < 0.72 = 🔴 RECORD (no match, needs new recording)

const MAX_CONCURRENT = 3; // Limit concurrent embed calls
const CACHE_KEY_PREFIX = "reuse-analysis-v7-";

// ── Helpers ────────────────────────────────────────────────

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function formatTimestamp(seconds) {
  if (seconds == null || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTimestampStr(ts) {
  if (!ts) return null;
  const str = String(ts).trim();
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return Number(str) || null;
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return Number(str) || null;
}

/**
 * Run promises in batches of `size` to avoid rate limits.
 */
async function batchedPromises(items, fn, size = MAX_CONCURRENT) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ── Main Analyzer ──────────────────────────────────────────

/**
 * Analyze video content reuse for a V2 learning path.
 *
 * @param {Object} v2Path — V2 learning path from the Authoring Workbench
 * @param {Object} [opts]
 * @param {Function} [opts.onProgress] — (current, total) progress callback
 * @param {boolean} [opts.skipCache] — Force re-analysis
 * @returns {Promise<{ steps: Array, summary: Object }>}
 */
export async function analyzeReuse(v2Path, opts = {}) {
  const { onProgress, skipCache = false } = opts;

  if (!v2Path?.sections?.length) {
    return { steps: [], summary: emptySummary() };
  }

  // Check cache first
  const combinedText = (v2Path.title || "untitled") + 
    v2Path.sections?.map(s => 
      (s.title || "untitled") + 
      (s.steps?.map(st => st.title || "untitled").join("") || "")
    ).join("");
  const cacheKey = CACHE_KEY_PREFIX + hashString(combinedText);
  if (!skipCache) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed._timestamp < 3600000) {
          devLog("[ReuseAnalyzer] Using cached analysis");
          return parsed.data;
        }
      }
    } catch {
      /* ignore bad cache */
    }
  }

  const app = getFirebaseApp();
  const functions = getFunctions(app, "us-central1");
  const embedFn = httpsCallable(functions, "embedQuery");
  const searchFn = httpsCallable(functions, "vectorSearchSegments");

  // Flatten all steps with their indices (skip Quiz steps)
  const allSteps = [];
  for (let sIdx = 0; sIdx < v2Path.sections.length; sIdx++) {
    const section = v2Path.sections[sIdx];
    for (let stIdx = 0; stIdx < (section.steps || []).length; stIdx++) {
      const step = section.steps[stIdx];
      if (step.lessonType === "Quiz") continue;
      allSteps.push({ step, sIdx, stIdx });
    }
  }

  const total = allSteps.length;
  if (total === 0) return { steps: [], summary: emptySummary() };

  devLog(`[ReuseAnalyzer] Analyzing ${total} steps...`);

  // Analyze each step in batches
  let completed = 0;
  const analyzedSteps = [];

  const results = await batchedPromises(
    allSteps,
    async ({ step, sIdx, stIdx }) => {
      try {
        const result = await analyzeStep(step, sIdx, stIdx, v2Path.title, embedFn, searchFn);
        completed++;
        if (onProgress) onProgress(completed, total);
        return result;
      } catch (err) {
        devWarn(`[ReuseAnalyzer] Step "${step.title}" failed:`, err.message);
        completed++;
        if (onProgress) onProgress(completed, total);
        return makeRecord(step, sIdx, stIdx, 0);
      }
    }
  );

  for (const result of results) {
    analyzedSteps.push(
      result.status === "fulfilled" ? result.value : makeRecord({}, -1, -1, 0)
    );
  }

  const summary = buildSummary(analyzedSteps);
  const report = { steps: analyzedSteps, summary };

  // Cache the result
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ _timestamp: Date.now(), data: report })
    );
  } catch {
    /* localStorage full — non-fatal */
  }

  devLog(
    `[ReuseAnalyzer] Complete: ${summary.reusePercent}% reuse, ` +
      `${summary.adaptPercent}% adapt, ${summary.recordPercent}% record`
  );

  return report;
}

// ── Per-Step Analysis ──────────────────────────────────────

async function analyzeStep(step, sIdx, stIdx, courseTitle, embedFn, searchFn) {
  const title = step.title || "Untitled";
  const searchQuery =
    `Course Context: ${courseTitle || "Unreal Engine"}. Lesson: ${title}. ${step.whyThisMatters || ""} ${step.summary || ""}`.trim();

  // 1. Embed the step's topic
  const embedResult = await retryWithBackoff(
    () => embedFn({ query: searchQuery }),
    { maxRetries: 1, baseDelayMs: 1000, label: "reuseEmbed" }
  );
  const queryVector = embedResult.data?.embedding;
  if (!queryVector) {
    return makeRecord(step, sIdx, stIdx, 0);
  }

  // 2. Search for matching video segments
  const searchResult = await searchFn({ queryVector, topK: 5 });
  const matches = searchResult.data?.results || [];

  if (matches.length === 0) {
    return makeRecord(step, sIdx, stIdx, 0);
  }

  // 3. Find the best matching segment
  const bestMatch = matches[0];
  const similarity = bestMatch.similarity || 0;

  // 4. Try to extract a precise topic segment from the transcript
  let topicSegment = null;
  if (bestMatch.transcript_segments?.length > 0) {
    const segments = extractTopicSegments(
      { transcript_segments: bestMatch.transcript_segments },
      title,
      { minDuration: 5 }
    );
    if (segments.length > 0) {
      topicSegment = segments[0];
    }
  }

  // 5. Classify based on similarity score
  const status =
    similarity >= REUSE_THRESHOLD
      ? "reuse"
      : similarity >= ADAPT_THRESHOLD
        ? "adapt"
        : "record";

  // 6. Build match info
  const matchInfo =
    status !== "record"
      ? {
          videoTitle: bestMatch.video_title || bestMatch.title || "Unknown",
          videoKey: bestMatch.video_key || "",
          courseCode: bestMatch.course_code || "",
          similarity: Math.round(similarity * 100) / 100,
          start: 
            topicSegment?.start ?? 
            Math.floor(
              parseTimestampStr(bestMatch.start_timestamp) ??
              (bestMatch.start_seconds != null ? Number(bestMatch.start_seconds) :
              bestMatch.transcript_segments?.[0]?.start ?? 0)
            ),
          end:
            topicSegment?.end ??
            Math.floor(
              parseTimestampStr(bestMatch.end_timestamp) ??
              (bestMatch.end_seconds != null ? Number(bestMatch.end_seconds) :
              bestMatch.transcript_segments?.[bestMatch.transcript_segments.length - 1]?.end ??
              null)
            ) ??
            (topicSegment?.start ?? parseTimestampStr(bestMatch.start_timestamp) ?? bestMatch.start_seconds ?? 0) + 60,
          startFormatted: formatTimestamp(
            topicSegment?.start ?? 
            parseTimestampStr(bestMatch.start_timestamp) ??
            bestMatch.start_seconds ?? 
            bestMatch.transcript_segments?.[0]?.start ?? 0
          ),
          endFormatted: formatTimestamp(
            topicSegment?.end ?? 
            parseTimestampStr(bestMatch.end_timestamp) ??
            bestMatch.end_seconds ?? 
            bestMatch.transcript_segments?.[bestMatch.transcript_segments.length - 1]?.end ?? 
            ((topicSegment?.start ?? parseTimestampStr(bestMatch.start_timestamp) ?? bestMatch.start_seconds ?? 0) + 60)
          ),
          thumbnailUrl: bestMatch.video_key
            ? `https://img.youtube.com/vi/${bestMatch.video_key}/mqdefault.jpg`
            : null,
          previewText: (topicSegment?.text || bestMatch.text || "").slice(0, 450),
          spliceCommand: null,
        }
      : null;

  // 7. Generate FFmpeg splice command for reuse/adapt
  if (matchInfo && bestMatch.video_key) {
    const splicePlan = [
      {
        videoCode: bestMatch.video_key,
        videoTitle: matchInfo.videoTitle,
        sourceUrl: `https://youtube.com/watch?v=${bestMatch.video_key}`,
        start: matchInfo.start,
        end: matchInfo.end,
        duration: matchInfo.end - matchInfo.start,
        relevance: similarity,
      },
    ];
    const ffmpeg = generateFFmpegCommands(splicePlan);
    matchInfo.spliceCommand =
      ffmpeg.inputs.length > 0
        ? `ffmpeg ${ffmpeg.inputs.join(" ")} -filter_complex "${ffmpeg.filterComplex}" ${ffmpeg.outputArgs.join(" ")} output.mp4`
        : null;
  }

  return {
    stepId: step.id || `${sIdx}-${stIdx}`,
    title,
    sectionIdx: sIdx,
    stepIdx: stIdx,
    status,
    confidence: Math.round(similarity * 100) / 100,
    match: matchInfo,
  };
}

function makeRecord(step, sIdx, stIdx, confidence) {
  return {
    stepId: step.id || `${sIdx}-${stIdx}`,
    title: step.title || "Untitled",
    sectionIdx: sIdx,
    stepIdx: stIdx,
    status: "record",
    confidence,
    match: null,
  };
}

// ── Summary Builder ────────────────────────────────────────

function buildSummary(steps) {
  const total = steps.length || 1;
  const reuseCount = steps.filter((s) => s.status === "reuse").length;
  const adaptCount = steps.filter((s) => s.status === "adapt").length;
  const recordCount = steps.filter((s) => s.status === "record").length;

  // Estimate ~5 min per recording step
  const estimatedRecordingMinutes = recordCount * 5;

  return {
    totalSteps: steps.length,
    reuseCount,
    adaptCount,
    recordCount,
    reusePercent: Math.round((reuseCount / total) * 100),
    adaptPercent: Math.round((adaptCount / total) * 100),
    recordPercent: Math.round((recordCount / total) * 100),
    estimatedRecordingMinutes,
  };
}

function emptySummary() {
  return {
    totalSteps: 0,
    reuseCount: 0,
    adaptCount: 0,
    recordCount: 0,
    reusePercent: 0,
    adaptPercent: 0,
    recordPercent: 0,
    estimatedRecordingMinutes: 0,
  };
}
