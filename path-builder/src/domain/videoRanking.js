/**
 * Video Ranking Domain — Flattens courses to ranked video items.
 * Scores videos by title relevance, transcript segments, and feedback.
 */
import { applyFeedbackMultiplier } from "../services/feedbackService";
import { cleanVideoTitle } from "../utils/cleanVideoTitle";
import { getSegmentIndex } from "../services/segmentSearchService";

// Lazy-loaded doc_links (0.1MB)
let _docLinks = null;
async function getDocLinks() {
  if (!_docLinks) {
    const mod = await import("../data/doc_links.json");
    _docLinks = mod.default || mod;
  }
  return _docLinks;
}

/**
 * Display noise words — filtered from matchedKeywords before UI display.
 */
const DISPLAY_NOISE = new Set([
  "help", "helpful", "helps", "use", "used", "using", "make", "made",
  "get", "getting", "look", "going", "come", "know", "thing", "work",
  "working", "want", "need", "show", "start", "take", "right", "well",
]);

/**
 * Simple stemmer — strips common English suffixes for fuzzy matching.
 * e.g. "meshes" → "mesh", "importing" → "import", "textures" → "textur"
 */
function stem(word) {
  return word
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "")
    .toLowerCase();
}

/**
 * Fuzzy word-overlap match: returns true if any query word stem
 * matches any topic word stem.
 */
function fuzzyTopicMatch(queryWords, topicKey) {
  const topicWords = topicKey.replace(/[-_]/g, " ").split(/\s+/).filter(w => w.length > 2);
  const topicStems = topicWords.map(stem);
  const queryStems = queryWords.map(stem);
  return queryStems.some(qs => topicStems.some(ts => qs.includes(ts) || ts.includes(qs)));
}

/**
 * Flatten matched courses into individual video items for the shopping cart.
 * Videos are ranked by how well their transcript content answers the query.
 */
export async function flattenCoursesToVideos(matchedCourses, userQuery, roleMap = {}) {
  const videos = [];
  const queryWords = (userQuery || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Find doc links matching the query (fuzzy word-overlap matching)
  const docLinks = await getDocLinks();
  const matchedDocLinks = [];
  const queryLower = (userQuery || "").toLowerCase();
  const queryWordList = queryLower.split(/\s+/).filter(w => w.length > 2);
  for (const [topic, info] of Object.entries(docLinks)) {
    if (queryLower.includes(topic) || fuzzyTopicMatch(queryWordList, topic)) {
      matchedDocLinks.push({ label: info.label, url: info.url });
    }
  }

  for (const course of matchedCourses) {
    // --- YouTube courses: single video item from youtube_url ---
    if (course.source === 'youtube' && course.youtube_url) {
      const pathInfo = roleMap[course.code] || {};
      const matchedTags = (() => {
        const clean = (course._matchedKeywords || [])
          .filter((kw) => kw.length > 3 && !DISPLAY_NOISE.has(kw.toLowerCase()))
          .slice(0, 3);
        return clean.length > 0
          ? clean
          : [course.topic || course.tags?.topic || "UE5"].flat().slice(0, 3);
      })();
      videos.push({
        driveId: course.youtube_url,
        title: cleanVideoTitle(course.title || course.code),
        duration: course.duration_seconds || 0,
        courseCode: course.code,
        courseName: course.title || course.code,
        matchedTags,
        videoIndex: 0,
        relevanceScore: course._relevanceScore || 0,
        titleRelevance: 0,
        isIntro: false,
        timestampHint: null,
        startSeconds: 0,
        topSegments: [],
        watchHint: `▶ Watch on YouTube`,
        docLinks: matchedDocLinks,
        _curatedMatch: course._curatedMatch || false,
        _curatedExplanation: course._curatedExplanation || null,
        role: pathInfo.role || null,
        reason: pathInfo.reason || null,
        estimatedMinutes: pathInfo.estimatedMinutes || null,
        _source: 'youtube',
        _externalUrl: course.youtube_url,
        type: 'youtube',
        url: course.youtube_url,
        channel: course.channel_name || course.channel || null,
        channelTrust: course.channel_trust || null,
        topics: course.topics || [],
        description: course.description || '',
        durationMinutes: course.duration_seconds ? Math.round(course.duration_seconds / 60) : 10,
      });
      continue;
    }

    // --- Epic Docs courses: produce a doc card ---
    if (course.source === 'epic_docs') {
      const docUrl = course.url || course.youtube_url || '#';
      const pathInfo = roleMap[course.code] || {};
      const matchedTags = (() => {
        const clean = (course._matchedKeywords || [])
          .filter((kw) => kw.length > 3 && !DISPLAY_NOISE.has(kw.toLowerCase()))
          .slice(0, 3);
        return clean.length > 0
          ? clean
          : [course.topic || course.tags?.topic || "UE5"].flat().slice(0, 3);
      })();
      videos.push({
        driveId: `doc_${course.code}`,
        title: cleanVideoTitle(course.title || course.code),
        duration: 0,
        courseCode: course.code,
        courseName: course.title || course.code,
        matchedTags,
        videoIndex: 0,
        relevanceScore: course._relevanceScore || 0,
        titleRelevance: 0,
        isIntro: false,
        timestampHint: null,
        startSeconds: 0,
        topSegments: [],
        watchHint: `📖 Read Epic Docs`,
        docLinks: [{ label: course.title || 'Epic Docs', url: docUrl }, ...matchedDocLinks],
        _curatedMatch: course._curatedMatch || false,
        _curatedExplanation: course._curatedExplanation || null,
        role: pathInfo.role || null,
        reason: pathInfo.reason || null,
        estimatedMinutes: pathInfo.estimatedMinutes || null,
        _source: 'epic_docs',
        _externalUrl: docUrl,
        type: 'doc',
        url: docUrl,
        topics: course.topics || [],
        description: course.description || '',
        readTimeMinutes: 10,
      });
      continue;
    }

    // --- Standard LMS courses with Drive videos ---
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
      const videoKey = await findVideoKeyForIndex(course.code, videoTitle, i);
      const segmentData = await getVideoSegmentScore(course.code, videoKey, queryWords);

      // Score 3: Intro detection — aggressively penalise non-content videos
      const isIntro = titleLower.includes("intro") || titleLower.includes("introduction") ||
        titleLower.includes("wrap up") || titleLower.includes("outro") ||
        titleLower.includes("overview") || titleLower.includes("getting started") ||
        titleLower.includes("welcome") || titleLower.includes("course intro") ||
        titleLower.includes("what you'll learn") || titleLower.includes("what we'll cover") ||
        titleLower.includes("summary") || titleLower.includes("objectives") ||
        (/\bpart\s*a\b/i.test(videoTitle) && i === 0);
      const introMultiplier = isIntro ? 0.15 : 1.0;

      // Score 4: Segment content bonus — prefer videos with actual matching content
      const segmentBonus = (!isIntro && segmentData.topSegments && segmentData.topSegments.length > 0) ? 15 : 0;

      // Score 5: Duration quality — very short videos are likely intros/overviews
      const durationSec = v.duration_seconds || v.durationSeconds || 0;
      const durationMin = durationSec / 60;
      const durationMultiplier = durationMin < 2 ? 0.4   // < 2 min: likely an intro snippet
        : durationMin < 5 ? 0.7   // 2-5 min: short, possibly overview
        : durationMin > 20 ? 1.1  // > 20 min: deep content, slight boost
        : 1.0;                     // 5-20 min: normal content

      // Score 6: Content relevance gate — if this specific video has NO direct query evidence
      // (no title matches, no transcript segments), the course-level relevance is heavily discounted.
      // This prevents courses like "Tool Creation" (matched because of 'mesh' tag) from surfacing
      // irrelevant videos that happen to be in the same course.
      const hasDirectEvidence = titleMatches > 0 || (segmentData.topSegments && segmentData.topSegments.length > 0);
      const courseRelevanceContribution = hasDirectEvidence
        ? (course._relevanceScore || 0)
        : (course._relevanceScore || 0) * 0.2;

      // Composite score with feedback adjustment (multiplicative penalties)
      const rawScore = (titleScore + segmentData.score + segmentBonus + courseRelevanceContribution) * introMultiplier * durationMultiplier;
      const totalScore = applyFeedbackMultiplier(v.drive_id, rawScore);

      // Build timestamp hint — only use segments within the video's actual duration
      let watchHint = "▶ Watch full video";
      const validSegments = (segmentData.topSegments || [])
        .filter((s) => !durationSec || s.startSeconds <= durationSec);
      const jumpSegment = validSegments[0] ||
        (segmentData.bestSegment && (!durationSec || segmentData.bestSegment.startSeconds <= durationSec)
          ? segmentData.bestSegment : null);
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

      // Filter startSeconds to be within video duration
      const safeStartSeconds = (segmentData.bestSegment?.startSeconds || 0);
      const clampedStartSeconds = durationSec && safeStartSeconds > durationSec ? 0 : safeStartSeconds;

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
        timestampHint: clampedStartSeconds > 0 ? (segmentData.bestSegment?.timestamp || null) : null,
        startSeconds: clampedStartSeconds,
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

  // Deduplicate by driveId — keep the highest-scored entry per unique video
  const uniqueMap = new Map();
  for (const v of videos) {
    const existing = uniqueMap.get(v.driveId);
    if (!existing || v.relevanceScore > existing.relevanceScore) {
      uniqueMap.set(v.driveId, v);
    }
  }
  const deduped = Array.from(uniqueMap.values());

  // Sort by relevance — best answer first
  deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Per-course diversity: keep at most 2 videos per course
  // (allows content video to surface alongside intro, with intro ranked lower)
  const courseCount = new Map();
  const MAX_PER_COURSE = 2;
  const diverse = deduped.filter((v) => {
    const count = courseCount.get(v.courseCode) || 0;
    if (count >= MAX_PER_COURSE) return false;
    courseCount.set(v.courseCode, count + 1);
    return true;
  });

  // Filter out low-relevance videos
  if (diverse.length > 3) {
    const scores = diverse.map((v) => v.relevanceScore);
    const median = scores[Math.floor(scores.length / 2)];
    const threshold = Math.max(median * 0.5, 10);
    const filtered = diverse.filter((v) => v.relevanceScore >= threshold);
    if (filtered.length >= 3) {
      const results = filtered.slice(0, 6);
      addMatchMetadata(results, queryWords);
      return results;
    }
  }

  const results = diverse.slice(0, 6);
  addMatchMetadata(results, queryWords);
  return results;
}

/**
 * Compute matchPercent (relative to top scorer) and matchReason for each video.
 */
function addMatchMetadata(videos, queryWords) {
  if (videos.length === 0) return;
  const topScore = Math.max(videos[0].relevanceScore, 1);

  for (const v of videos) {
    // Percent relative to top result
    v.matchPercent = Math.min(100, Math.round((v.relevanceScore / topScore) * 100));

    // Build human-readable match reason
    const reasons = [];
    if (v._curatedMatch) {
      reasons.push("Known solution for this problem");
    }
    if (v.titleRelevance > 0) {
      const hitWords = queryWords
        .filter((w) => (v.title || "").toLowerCase().includes(w))
        .slice(0, 3);
      if (hitWords.length > 0) {
        reasons.push(`Title matches: ${hitWords.join(", ")}`);
      }
    }
    if (v.topSegments.length > 0) {
      const segKws = new Set();
      for (const seg of v.topSegments) {
        for (const kw of seg.matchedKeywords || []) segKws.add(kw);
      }
      const kwList = [...segKws].slice(0, 4);
      if (kwList.length > 0) {
        reasons.push(`Transcript mentions: ${kwList.join(", ")}`);
      }
    }
    if (v.matchedTags.length > 0 && reasons.length < 2) {
      reasons.push(`Tagged: ${v.matchedTags.slice(0, 3).join(", ")}`);
    }
    v.matchReason = reasons.length > 0 ? reasons.join(" · ") : "Related to your query";
  }
}

/**
 * Find the matching video key in the segment index.
 */
export async function findVideoKeyForIndex(courseCode, videoTitle, videoIndex) {
  const segmentIndex = await getSegmentIndex();
  const courseData = segmentIndex[courseCode];
  if (!courseData?.videos) return null;

  const normalize = (s) =>
    (s || "").toLowerCase().replace(/\.mp4$/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

  // Split title into individual words for matching (avoid substring false positives)
  const titleNorm = normalize(videoTitle);
  const titleWords = titleNorm.split(" ").filter((w) => w.length > 2);
  const keys = Object.keys(courseData.videos);

  // Pass 1: Exact title match
  for (const key of keys) {
    const vidTitle = normalize(courseData.videos[key].title || "");
    if (vidTitle === titleNorm) return key;
  }

  // Pass 2: All significant words present in key/title (avoids 'fitting' matching 'geofittingpresets')
  let bestMatch = null;
  let bestScore = 0;
  for (const key of keys) {
    const vidTitle = normalize(courseData.videos[key].title || "");
    const keyNorm = normalize(key);
    const combined = vidTitle + " " + keyNorm;

    let wordHits = 0;
    for (const w of titleWords) {
      // Use word boundary matching — 'fitting' should match 'fitting' not 'geofittingpresets'
      const wordRegex = new RegExp(`(^|\\s|_)${w.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(\\s|_|$)`, "i");
      if (wordRegex.test(combined)) wordHits++;
    }

    if (wordHits > 0 && wordHits > bestScore) {
      bestScore = wordHits;
      bestMatch = key;
    }
  }
  if (bestMatch && bestScore >= Math.max(1, titleWords.length * 0.5)) return bestMatch;

  // Pass 3: Original substring fallback (catches edge cases)
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
export async function getVideoSegmentScore(courseCode, videoKey, keywords) {
  const fallback = { score: 0, bestSegment: null, topSegments: [] };
  const segmentIndex = await getSegmentIndex();
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
