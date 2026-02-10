/**
 * TranscriptCards — Shows relevant transcript timestamps during video playback.
 * Matches segments by keyword relevance to the user's problem.
 */
import { useMemo, useCallback, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { SEARCH_STOPWORDS } from "../../domain/constants";

const TOPIC_SKIP = new Set([
  "gonna", "going", "really", "actually", "basically", "right", "thing",
  "things", "about", "would", "could", "should", "there", "their", "these",
  "those", "where", "which", "being", "doing", "using", "other", "first",
  "second", "third", "after", "before", "every", "still", "again", "already",
  "engine", "unreal", "because", "simply", "called", "allows", "looking", "provides",
]);

/** Normalize a video/transcript key for fuzzy matching */
function normalize(s) {
  return (s || "")
    .replace(/\.mp4$/i, "")
    .replace(/^[\d._]+/, "")
    .replace(/[\s_]+/g, "")
    .toLowerCase();
}

export default function TranscriptCards({ courseCode, videoTitle, problemSummary, matchedKeywords }) {
  // Lazy-load transcript_segments.json (4MB) on first mount
  const [transcriptSegments, setTranscriptSegments] = useState(null);
  useEffect(() => {
    let cancelled = false;
    import("../../data/transcript_segments.json").then((mod) => {
      if (!cancelled) setTranscriptSegments(mod.default || mod);
    });
    return () => { cancelled = true; };
  }, []);

  const cards = useMemo(() => {
    if (!courseCode || !transcriptSegments) return [];

    const courseTranscripts = transcriptSegments[courseCode];
    if (!courseTranscripts) return [];

    const normalizedTitle = normalize(videoTitle);

    // Find matching transcript key (exact, then partial)
    let segments = null;
    for (const [key, segs] of Object.entries(courseTranscripts)) {
      if (normalize(key) === normalizedTitle) {
        segments = segs;
        break;
      }
    }
    if (!segments) {
      for (const [key, segs] of Object.entries(courseTranscripts)) {
        const nk = normalize(key);
        if (nk.includes(normalizedTitle) || normalizedTitle.includes(nk)) {
          segments = segs;
          break;
        }
      }
    }
    if (!segments || segments.length === 0) return [];

    // Build keyword list from problem + matched keywords
    const keywords = [];
    if (problemSummary) {
      keywords.push(
        ...problemSummary
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3 && !SEARCH_STOPWORDS.has(w))
      );
    }
    if (matchedKeywords) {
      keywords.push(
        ...matchedKeywords.map((k) =>
          (typeof k === "string" ? k : k.display_name || k.id || "").toLowerCase()
        )
      );
    }

    if (keywords.length === 0) {
      const step = Math.max(1, Math.floor(segments.length / 3));
      return segments
        .filter((_, i) => i % step === 0)
        .slice(0, 3)
        .map((seg) => ({ ...seg, score: 0, isChapter: true }));
    }

    // Score segments by keyword matches
    const scored = segments.map((seg) => {
      const text = seg.text.toLowerCase();
      let score = 0;
      const hits = [];
      for (const kw of keywords) {
        if (text.includes(kw)) {
          score += 10;
          if (!hits.includes(kw)) hits.push(kw);
        }
      }
      return { ...seg, score, hits: [...new Set(hits)] };
    });

    const relevant = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    if (relevant.length > 0) {
      // Pick top 3 by relevance, then re-sort chronologically by timestamp
      const top = relevant.slice(0, 3);
      top.sort((a, b) => {
        const toSec = (t) => { const p = (t || "0:00").split(":").map(Number); return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+(p[1]||0); };
        return toSec(a.start) - toSec(b.start);
      });
      return top;
    }

    // Fallback: evenly spaced
    const step = Math.max(1, Math.floor(segments.length / 3));
    return segments
      .filter((_, i) => i % step === 0)
      .slice(0, 3)
      .map((seg) => ({ ...seg, score: 0, isChapter: true }));
  }, [courseCode, videoTitle, problemSummary, matchedKeywords, transcriptSegments]);

  const getTopicLabel = useCallback((seg) => {
    if (seg.summary) return seg.summary;
    const text = seg.text || "";
    const words = text
      .replace(/[.,;:!?'"()]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !TOPIC_SKIP.has(w.toLowerCase()))
      .map((w) => w.toLowerCase());
    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    const topTerms = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
    return topTerms.length > 0 ? topTerms.join(", ") : "Overview";
  }, []);

  if (cards.length === 0) return null;

  return (
    <div className="video-info-cards">
      <div className="info-card transcript-card">
        <h4>
          {cards[0]?.isChapter
            ? "📋 Video Chapters"
            : `🎯 🎬 Video Callouts: ${problemSummary || "your search"}`}
        </h4>
        <div className="timestamp-list">
          {cards.map((seg, i) => (
            <div key={i} className={`timestamp-item ${seg.score > 0 ? "relevant" : ""}`}>
              <span className="timestamp-badge">{seg.start}</span>
              <span className="timestamp-text">{getTopicLabel(seg)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

TranscriptCards.propTypes = {
  courseCode: PropTypes.string,
  videoTitle: PropTypes.string,
  problemSummary: PropTypes.string,
  matchedKeywords: PropTypes.array,
};
