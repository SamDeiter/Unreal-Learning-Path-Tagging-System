/**
 * videoSplicer.js — Video Splice Plan Generator
 *
 * Creates splice instructions for FFmpeg to extract and concatenate
 * segments from existing instructor videos into new topic-focused clips.
 *
 * NOTE: Actual FFmpeg execution happens in a Cloud Function.
 * This service only builds the splice plan (client-side).
 */

// ── Segment Extraction ─────────────────────────────────────────────

/**
 * Extract relevant timestamp ranges from video transcripts.
 *
 * @param {Object} video — Video object with transcript segments
 * @param {string} topic — Topic to extract segments for
 * @param {Object} [opts] — Options
 * @param {number} [opts.minDuration=10] — Min segment duration in seconds
 * @param {number} [opts.maxDuration=300] — Max segment duration in seconds
 * @param {number} [opts.contextPadding=3] — Seconds of padding before/after
 * @returns {Array<{ start: number, end: number, text: string, relevance: number }>}
 */
export function extractTopicSegments(video, topic, opts = {}) {
  const { minDuration = 10, maxDuration = 300, contextPadding = 3 } = opts;

  if (!video?.transcript_segments?.length) return [];

  const topicWords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (topicWords.length === 0) return [];

  const segments = [];
  let currentSegment = null;

  video.transcript_segments.forEach((seg) => {
    const text = (seg.text || "").toLowerCase();
    const matchCount = topicWords.filter((w) => text.includes(w)).length;
    const relevance = matchCount / topicWords.length;

    if (relevance >= 0.4) {
      // Relevant — extend or start segment
      if (currentSegment) {
        currentSegment.end = seg.end || seg.start + 10;
        currentSegment.text += " " + seg.text;
        currentSegment.relevance = Math.max(currentSegment.relevance, relevance);
      } else {
        currentSegment = {
          start: Math.max(0, (seg.start || 0) - contextPadding),
          end: (seg.end || seg.start + 10) + contextPadding,
          text: seg.text || "",
          relevance,
        };
      }
    } else if (currentSegment) {
      // Gap found — finalize current segment
      finalizeSegment(currentSegment, segments, minDuration, maxDuration);
      currentSegment = null;
    }
  });

  // Finalize any trailing segment
  if (currentSegment) {
    finalizeSegment(currentSegment, segments, minDuration, maxDuration);
  }

  return segments.sort((a, b) => b.relevance - a.relevance);
}

/**
 * @private — Finalize a segment with duration bounds.
 */
function finalizeSegment(seg, output, minDuration, maxDuration) {
  const duration = seg.end - seg.start;
  if (duration >= minDuration && duration <= maxDuration) {
    output.push({ ...seg, duration });
  }
}

// ── Splice Plan ────────────────────────────────────────────────────

/**
 * Build an FFmpeg splice plan from multiple videos.
 *
 * @param {Array} videos — Video objects with transcript_segments
 * @param {string} topic — Topic to build the new video around
 * @param {Object} [opts] — Options
 * @param {number} [opts.targetDuration=600] — Target output duration (seconds)
 * @param {string} [opts.skillLevel="Intermediate"] — Skill level filter
 * @returns {{ splicePlan: Array, totalDuration: number, sourceCount: number }}
 */
export function buildSplicePlan(videos, topic, opts = {}) {
  const { targetDuration = 600, skillLevel = "Intermediate" } = opts;

  // Collect segments from all videos
  const allSegments = [];
  videos.forEach((video) => {
    const segs = extractTopicSegments(video, topic);
    segs.forEach((seg) => {
      allSegments.push({
        ...seg,
        videoCode: video.code || video.video_id,
        videoTitle: video.title || "Untitled",
        sourceUrl: video.url || video.source_url || "",
        _skillLevel: skillLevel, // metadata only
      });
    });
  });

  // Sort by relevance descending, then take until we hit target duration
  allSegments.sort((a, b) => b.relevance - a.relevance);

  const splicePlan = [];
  let totalDuration = 0;
  const usedSources = new Set();

  for (const seg of allSegments) {
    if (totalDuration + seg.duration > targetDuration) continue;
    splicePlan.push({
      videoCode: seg.videoCode,
      videoTitle: seg.videoTitle,
      sourceUrl: seg.sourceUrl,
      start: roundToDecimal(seg.start, 2),
      end: roundToDecimal(seg.end, 2),
      duration: roundToDecimal(seg.duration, 2),
      relevance: roundToDecimal(seg.relevance, 2),
      previewText: seg.text.slice(0, 120),
    });
    totalDuration += seg.duration;
    usedSources.add(seg.videoCode);
  }

  return {
    splicePlan,
    totalDuration: roundToDecimal(totalDuration, 1),
    sourceCount: usedSources.size,
    topic,
    skillLevel,
  };
}

// ── FFmpeg Command Generation ──────────────────────────────────────

/**
 * Generate FFmpeg filter_complex command parts for the splice plan.
 *
 * @param {Array} splicePlan — From buildSplicePlan result
 * @returns {{ inputs: string[], filterComplex: string, outputArgs: string[] }}
 */
export function generateFFmpegCommands(splicePlan) {
  if (splicePlan.length === 0) {
    return { inputs: [], filterComplex: "", outputArgs: [] };
  }

  const inputs = [];
  const filterParts = [];
  const concatInputs = [];

  splicePlan.forEach((seg, idx) => {
    inputs.push(`-ss ${seg.start} -to ${seg.end} -i "${seg.sourceUrl}"`);
    filterParts.push(`[${idx}:v]setpts=PTS-STARTPTS[v${idx}]`);
    filterParts.push(`[${idx}:a]asetpts=PTS-STARTPTS[a${idx}]`);
    concatInputs.push(`[v${idx}][a${idx}]`);
  });

  const filterComplex = [
    ...filterParts,
    `${concatInputs.join("")}concat=n=${splicePlan.length}:v=1:a=1[outv][outa]`,
  ].join("; ");

  const outputArgs = [
    `-map "[outv]"`,
    `-map "[outa]"`,
    `-c:v libx264 -preset medium -crf 23`,
    `-c:a aac -b:a 128k`,
  ];

  return { inputs, filterComplex, outputArgs };
}

// ── Helpers ────────────────────────────────────────────────────────

function roundToDecimal(num, places) {
  const factor = Math.pow(10, places);
  return Math.round(num * factor) / factor;
}
