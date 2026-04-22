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

module.exports = { writeSession };
