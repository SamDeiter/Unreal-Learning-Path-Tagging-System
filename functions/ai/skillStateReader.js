/**
 * skillStateReader.js — Read per-user skillState from Firestore and build
 * a prompt-friendly snippet for Gemini handlers.
 *
 * Schema: docs/skillState-schema.md
 *   users/{uid} doc with fields:
 *     skillState: { [tag]: {
 *       level, confidence, encounters, lastSeenAt,
 *       successes, failures, opportunities, mastery  // PFA (Phase 2A)
 *     } }
 *     topicsLearned: string[]
 *     persona: string?
 *     lastQueryAt: timestamp?
 *     lastPathId: string?
 *
 * All reads are defensive — a missing doc is the common case, not an error.
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

const STALE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_TOPICS = 8;

const EMPTY_STATE = Object.freeze({
  skillState: {},
  topicsLearned: [],
  persona: null,
  lastQueryAt: null,
  lastPathId: null,
});

function emptyState() {
  return {
    skillState: {},
    topicsLearned: [],
    persona: null,
    lastQueryAt: null,
    lastPathId: null,
  };
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof v.toMillis === "function") {
    try { return v.toMillis(); } catch (_) { return 0; }
  }
  if (v.seconds) return v.seconds * 1000;
  return 0;
}

async function readSkillState(uid) {
  if (!uid || typeof uid !== "string") return emptyState();
  try {
    const db = admin.firestore();
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return emptyState();
    const d = snap.data() || {};
    return {
      skillState: (d.skillState && typeof d.skillState === "object") ? d.skillState : {},
      topicsLearned: Array.isArray(d.topicsLearned) ? d.topicsLearned.slice(0, 200) : [],
      persona: typeof d.persona === "string" ? d.persona : null,
      lastQueryAt: d.lastQueryAt || null,
      lastPathId: typeof d.lastPathId === "string" ? d.lastPathId : null,
    };
  } catch (err) {
    logger.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "skill_state_read_error",
        uid,
        error: err && err.message ? err.message : String(err),
      })
    );
    return emptyState();
  }
}

function buildSkillStateSnippet(state) {
  if (!state || typeof state !== "object") return "";
  const { skillState = {}, topicsLearned = [], persona = null, lastPathId = null } = state;

  const now = Date.now();
  const entries = Object.entries(skillState)
    .filter(([tag, v]) => {
      if (!tag || !v || typeof v !== "object") return false;
      const seen = toMillis(v.lastSeenAt);
      if (seen > 0 && now - seen > STALE_MS) return false;
      return true;
    })
    .map(([tag, v]) => ({
      tag,
      level: typeof v.level === "string" ? v.level : "beginner",
      encounters: Number.isFinite(v.encounters) ? v.encounters : 0,
      mastery: Number.isFinite(v.mastery) ? v.mastery : 0,
      opportunities: Number.isFinite(v.opportunities) ? v.opportunities : 0,
    }))
    .sort((a, b) => b.encounters - a.encounters)
    .slice(0, MAX_TOPICS);

  const hasPersona = !!persona;
  const hasTopics = entries.length > 0;
  const hasLearned = Array.isArray(topicsLearned) && topicsLearned.length > 0;
  const hasPath = !!lastPathId;

  if (!hasPersona && !hasTopics && !hasLearned && !hasPath) return "";

  const lines = ["Learner profile:"];
  if (hasPersona) lines.push(`- Persona: ${persona}`);
  if (hasTopics) {
    const topicStr = entries
      .map((e) => {
        if (e.opportunities > 0) {
          const m = e.mastery.toFixed(2);
          return `${e.tag} (${e.level}, mastery ${m})`;
        }
        return `${e.tag} (${e.level})`;
      })
      .join(", ");
    lines.push(`- Known topics: ${topicStr}`);
  } else if (hasLearned) {
    lines.push(`- Completed topics: ${topicsLearned.slice(0, MAX_TOPICS).join(", ")}`);
  }
  if (hasPath) lines.push(`- Prior path: ${lastPathId}`);

  return lines.join("\n");
}

module.exports = {
  readSkillState,
  buildSkillStateSnippet,
  EMPTY_STATE,
};
