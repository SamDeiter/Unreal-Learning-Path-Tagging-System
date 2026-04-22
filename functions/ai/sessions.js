const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

async function writeSession({ uid, mode, query, conversationHistory, result, sessionId }) {
  if (!uid) return null;
  try {
    const db = admin.firestore();
    const sessionsRef = db.collection("users").doc(uid).collection("sessions");
    const id = sessionId || sessionsRef.doc().id;
    const docRef = sessionsRef.doc(id);

    const payload = {
      uid,
      mode,
      query: query || null,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      result: result || null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (sessionId) {
      await docRef.set(payload, { merge: true });
    } else {
      payload.createdAt = FieldValue.serverTimestamp();
      await docRef.set(payload);
    }
    return id;
  } catch (err) {
    logger.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "session_write_failed",
        error: err.message,
      })
    );
    return null;
  }
}

/**
 * Condense a prior session into a 2-3 sentence memory snippet used to
 * prime a follow-up diagnosis call. Pure string manipulation — no LLM call.
 *
 * Why: keeps cross-session memory cheap/fast/deterministic and survives
 * without Gemini being available.
 */
function summarizeSession(sessionDoc) {
  if (!sessionDoc || !sessionDoc.result) return "";
  const result = sessionDoc.result;
  const diagnosis =
    (result.cart && result.cart.diagnosis) || result.diagnosis || {};
  const objectives =
    (result.cart && result.cart.objectives) || result.objectives || {};

  const problemSummary =
    typeof diagnosis.problem_summary === "string" && diagnosis.problem_summary.trim()
      ? diagnosis.problem_summary.trim()
      : "";
  const firstRootCause =
    Array.isArray(diagnosis.root_causes) && diagnosis.root_causes.length > 0
      ? String(diagnosis.root_causes[0] || "").trim()
      : "";
  const firstFixSpecific =
    Array.isArray(objectives.fix_specific) && objectives.fix_specific.length > 0
      ? String(objectives.fix_specific[0] || "").trim()
      : "";

  if (!problemSummary && !firstRootCause && !firstFixSpecific) return "";

  const rawId = sessionDoc.id || sessionDoc.sessionId || "";
  const shortId = String(rawId).slice(0, 8);
  const header = shortId ? `Prior session (${shortId})` : "Prior session";

  const parts = [];
  if (problemSummary) {
    parts.push(`${header}: ${problemSummary.replace(/\.+$/, "")}.`);
  } else {
    parts.push(`${header}.`);
  }
  if (firstRootCause) {
    parts.push(`Root cause identified: ${firstRootCause.replace(/\.+$/, "")}.`);
  }
  if (firstFixSpecific) {
    parts.push(`${firstFixSpecific.replace(/\.+$/, "")}.`);
  }
  return parts.join(" ");
}

module.exports = { writeSession, summarizeSession };
