/**
 * skillStateWriter.js — Upsert per-user skillState from learning signals.
 *
 * Schema: docs/skillState-schema.md
 *
 * All writes are defensive: missing uid is a no-op, errors are swallowed
 * and logged. Never throws to the caller — telemetry and feedback paths
 * rely on fire-and-forget semantics.
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

const VALID_SIGNALS = new Set([
  "encountered",
  "completed",
  "mastered",
  "struggled",
  "rejected",
]);

const LEVELS = ["beginner", "intermediate", "expert"];

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function levelForConfidence(currentLevel, confidence) {
  let lvl = LEVELS.includes(currentLevel) ? currentLevel : "beginner";
  if (confidence > 0.85) lvl = "expert";
  else if (confidence > 0.5 && lvl === "beginner") lvl = "intermediate";
  return lvl;
}

function downgradeLevel(currentLevel, confidence) {
  let lvl = LEVELS.includes(currentLevel) ? currentLevel : "beginner";
  if (lvl === "expert" && confidence < 0.7) lvl = "intermediate";
  if (lvl === "intermediate" && confidence < 0.35) lvl = "beginner";
  return lvl;
}

function computeNextEntry(existing, signal, weight) {
  const prev = (existing && typeof existing === "object") ? existing : {};
  const prevLevel = LEVELS.includes(prev.level) ? prev.level : "beginner";
  const prevConfidence = Number.isFinite(prev.confidence) ? prev.confidence : 0;
  const prevEncounters = Number.isFinite(prev.encounters) ? prev.encounters : 0;

  let level = prevLevel;
  let confidence = prevConfidence;
  let changed = true;

  switch (signal) {
    case "encountered": {
      const w = Number.isFinite(weight) ? weight : 0.02;
      confidence = clamp01(prevConfidence + w);
      level = levelForConfidence(prevLevel, confidence);
      break;
    }
    case "completed": {
      const w = Number.isFinite(weight) ? weight : 0.2;
      confidence = clamp01(prevConfidence + w);
      level = levelForConfidence(prevLevel, confidence);
      break;
    }
    case "mastered": {
      level = "expert";
      confidence = 1.0;
      break;
    }
    case "struggled": {
      const w = Number.isFinite(weight) ? weight : 0.15;
      confidence = clamp01(prevConfidence - w);
      level = downgradeLevel(prevLevel, confidence);
      break;
    }
    case "rejected": {
      changed = false;
      break;
    }
    default:
      changed = false;
  }

  return {
    changed,
    next: {
      level,
      confidence,
      encounters: prevEncounters + 1,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
}

async function applyBatch(uid, signals) {
  const db = admin.firestore();
  const ref = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const existing = snap.exists ? (snap.data() || {}) : null;
    const skillState = (existing && existing.skillState && typeof existing.skillState === "object")
      ? { ...existing.skillState }
      : {};
    const topicsLearned = Array.isArray(existing && existing.topicsLearned)
      ? existing.topicsLearned.slice()
      : [];

    const update = {};
    let anyChange = false;

    for (const sig of signals) {
      if (!sig || typeof sig !== "object") continue;
      const { tag, signal, weight } = sig;
      if (!tag || typeof tag !== "string") continue;
      if (!VALID_SIGNALS.has(signal)) continue;

      if (signal === "rejected") {
        logger.info(JSON.stringify({
          severity: "INFO",
          message: "skill_signal_rejected",
          uid,
          tag,
        }));
        continue;
      }

      const prev = skillState[tag];
      const { changed, next } = computeNextEntry(prev, signal, weight);
      if (!changed) continue;

      skillState[tag] = {
        level: next.level,
        confidence: next.confidence,
        encounters: next.encounters,
        lastSeenAt: next.lastSeenAt,
      };
      anyChange = true;

      if ((next.level === "intermediate" || next.level === "expert")
          && !topicsLearned.includes(tag)) {
        topicsLearned.push(tag);
      }
    }

    if (!snap.exists) {
      update.createdAt = now;
    }

    if (anyChange || !snap.exists) {
      update.skillState = skillState;
      update.topicsLearned = topicsLearned;
      update.lastQueryAt = now;
      update.updatedAt = now;
      tx.set(ref, update, { merge: true });
    }
  });
}

async function applySkillSignal(uid, { tag, signal, weight } = {}) {
  if (!uid || typeof uid !== "string") return;
  if (!tag || typeof tag !== "string") return;
  if (!VALID_SIGNALS.has(signal)) return;
  try {
    await applyBatch(uid, [{ tag, signal, weight }]);
  } catch (err) {
    logger.warn(JSON.stringify({
      severity: "WARNING",
      message: "skill_state_write_error",
      uid,
      tag,
      signal,
      error: err && err.message ? err.message : String(err),
    }));
  }
}

async function applySkillSignals(uid, signals) {
  if (!uid || typeof uid !== "string") return;
  if (!Array.isArray(signals) || signals.length === 0) return;
  try {
    await applyBatch(uid, signals);
  } catch (err) {
    logger.warn(JSON.stringify({
      severity: "WARNING",
      message: "skill_state_batch_write_error",
      uid,
      count: signals.length,
      error: err && err.message ? err.message : String(err),
    }));
  }
}

module.exports = {
  applySkillSignal,
  applySkillSignals,
  VALID_SIGNALS,
};
