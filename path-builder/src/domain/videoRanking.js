/**
 * Video Ranking Domain — Flattens courses to ranked video items.
 * Scores videos by title relevance, transcript segments, and feedback.
 */
import { applyFeedbackMultiplier } from "../services/feedbackService";
import { cleanVideoTitle } from "../utils/cleanVideoTitle";
import segmentIndex from "../data/segment_index.json";
import docLinks from "../data/doc_links.json";

/**
 * Display noise words — filtered from matchedKeywords before UI display.
 */
const DISPLAY_NOISE = new Set([
  "help", "helpful", "helps", "use", "used", "using", "make", "made",
  "get", "getting", "look", "going", "come", "know", "thing", "work",
  "working", "want", "need", "show", "start", "take", "right", "well",
]);

/**
 * Flatten matched courses into individual video items for the shopping cart.
 * Videos are ranked by how well their transcript content answers the query.
 */
export function flattenCoursesToVideos(matchedCourses, userQuery, roleMap = {}) {
  const videos = [];
  const queryWords = (userQuery || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Find doc links matching the query
  const matchedDocLinks = [];
  const queryLower = (userQuery || "").toLowerCase();
  for (const [topic, info] of Object.entries(docLinks)) {
    if (queryLower.includes(topic)) {
      matchedDocLinks.push({ label: info.label, url: info.url });
    }
  }

  for (const course of matchedCourses) {
    const courseVideos = course.videos || [];
    if (courseVideos.length === 0) continue;

    for (let i = 0; i < courseVideos.length; i++) {
      const v = courseVideos[i];
      if (!v.drive_id) continue;

      const videoTitle = v.title || v.name || `Video ${i + 1}`;
      const titleLower = videoTitle.toLowerCase();
      const cleanTitle = cleanVideoTitle(videoTitle);

      // Score 1: Title relevance
      const titleMatches = queryWords.filter((w) => titleLower.includes(w)).length;
      const titleScore = titleMatches * 50;

      // Score 2: Transcript segment relevance
      const videoKey = findVideoKeyForIndex(course.code, videoTitle, i);
      const segmentData = getVideoSegmentScore(course.code, videoKey, queryWords);

      // Score 3: Intro penalty
      const isIntro = titleLower.includes("intro") || titleLower.includes("wrap up") || titleLower.includes("outro");
      const introPenalty = isIntro ? -20 : 0;

      // Composite score with feedback adjustment
      const rawScore = titleScore + segmentData.score + introPenalty + (course._relevanceScore || 0);
      const totalScore = applyFeedbackMultiplier(v.drive_id, rawScore);

      // Build timestamp hint
      let watchHint = "▶ Watch full video";
      const jumpSegment = (segmentData.topSegments || [])[0] || segmentData.bestSegment || null;
      if (jumpSegment) {
        const ts = jumpSegment.timestamp || "0:00";
        const preview = jumpSegment.previewText;
        const truncPreview = preview.length > 60 ? preview.substring(0, 57) + "..." : preview;
        watchHint = jumpSegment.startSeconds < 5
          ? `📍 Start of video — "${truncPreview}"`
          : `📍 Jump to ${ts} — "${truncPreview}"`;
      }

      // PathBuilder role/reason
      const pathInfo = roleMap[course.code] || {};

      // Clean matched keywords for display
      const matchedTags = (() => {
        const clean = (course._matchedKeywords || [])
          .filter((kw) => kw.length > 3 && !DISPLAY_NOISE.has(kw.toLowerCase()))
          .slice(0, 3);
        return clean.length > 0
          ? clean
          : [course.topic || course.tags?.topic || "UE5"].flat().slice(0, 3);
      })();

      videos.push({
        driveId: v.drive_id,
        title: cleanTitle,
        duration: v.duration_seconds || 0,
        courseCode: course.code,
        courseName: course.title || course.code,
        matchedTags,
        videoIndex: i,
        relevanceScore: totalScore,
        titleRelevance: titleMatches,
        isIntro,
        timestampHint: segmentData.bestSegment?.timestamp || null,
        startSeconds: segmentData.bestSegment?.startSeconds || 0,
        topSegments: segmentData.topSegments || [],
        watchHint,
        docLinks: matchedDocLinks,
        _curatedMatch: course._curatedMatch || false,
        _curatedExplanation: course._curatedExplanation || null,
        role: pathInfo.role || null,
        reason: pathInfo.reason || null,
        estimatedMinutes: pathInfo.estimatedMinutes || null,
      });
    }
  }

  // Sort by relevance — best answer first
  videos.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Filter out low-relevance videos
  if (videos.length > 3) {
    const scores = videos.map((v) => v.relevanceScore);
    const median = scores[Math.floor(scores.length / 2)];
    const threshold = Math.max(median * 0.5, 10);
    const filtered = videos.filter((v) => v.relevanceScore >= threshold);
    if (filtered.length >= 3) return filtered.slice(0, 6);
  }

  return videos.slice(0, 6);
}

/**
 * Find the matching video key in the segment index.
 */
export function findVideoKeyForIndex(courseCode, videoTitle, videoIndex) {
  const courseData = segmentIndex[courseCode];
  if (!courseData?.videos) return null;

  const normalize = (s) =>
    (s || "").toLowerCase().replace(/\.mp4$/i, "").replace(/_/g, " ").trim();
  const titleNorm = normalize(videoTitle);
  const keys = Object.keys(courseData.videos);

  for (const key of keys) {
    const vidTitle = normalize(courseData.videos[key].title || "");
    const keyNorm = normalize(key);
    if (
      titleNorm.includes(vidTitle) || vidTitle.includes(titleNorm) ||
      titleNorm.includes(keyNorm) || keyNorm.includes(titleNorm)
    ) {
      return key;
    }
  }
  if (videoIndex < keys.length) return keys[videoIndex];
  return keys[0] || null;
}

/**
 * Score a specific video's segments against query keywords.
 */
export function getVideoSegmentScore(courseCode, videoKey, keywords) {
  const fallback = { score: 0, bestSegment: null, topSegments: [] };
  const courseData = segmentIndex[courseCode];
  if (!courseData?.videos || !videoKey) return fallback;

  const videoData = courseData.videos[videoKey];
  if (!videoData?.segments) return fallback;

  const scored = [];
  for (const segment of videoData.segments) {
    const textLower = segment.text.toLowerCase();
    let segScore = 0;
    const matched = [];
    for (const kw of keywords) {
      if (textLower.includes(kw)) {
        const count = textLower.split(kw).length - 1;
        segScore += count * 10;
        matched.push(kw);
      }
    }
    if (segScore > 0) {
      let preview = segment.text;
      if (preview.length > 100) {
        const idx = preview.toLowerCase().indexOf(matched[0] || "");
        if (idx > 30) preview = "..." + preview.substring(idx - 20);
        if (preview.length > 100) preview = preview.substring(0, 97) + "...";
      }
      scored.push({
        timestamp: segment.start,
        startSeconds: segment.start_seconds,
        previewText: preview,
        matchedKeywords: matched,
        score: segScore,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topSegments = scored.slice(0, 3);
  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
  return { score: totalScore, bestSegment: topSegments[0] || null, topSegments };
}
