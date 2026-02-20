/**
 * cleanupCache — Scheduled Cloud Function to prune stale cached diagnoses.
 *
 * Runs daily. Deletes documents older than 30 days and caps
 * the collection at 500 documents (removing oldest first).
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// Initialize admin if not already initialized
if (!admin.apps.length) admin.initializeApp();

const COLLECTION = "cached_diagnoses";
const MAX_AGE_DAYS = 30;
const MAX_DOCS = 500;

exports.cleanupCache = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "America/New_York",
    region: "us-east1",
  },
  async () => {
    const db = admin.firestore();
    const collRef = db.collection(COLLECTION);

    // 1. Delete docs older than MAX_AGE_DAYS
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

    const staleSnap = await collRef
      .where("createdAt", "<", cutoff.toISOString())
      .limit(200)
      .get();

    if (!staleSnap.empty) {
      const batch = db.batch();
      staleSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[cleanupCache] Deleted ${staleSnap.size} stale docs (> ${MAX_AGE_DAYS} days)`);
    }

    // 2. Cap total docs at MAX_DOCS (delete oldest if exceeded)
    const totalSnap = await collRef.orderBy("createdAt", "asc").get();
    const excess = totalSnap.size - MAX_DOCS;

    if (excess > 0) {
      const batch = db.batch();
      totalSnap.docs.slice(0, excess).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[cleanupCache] Pruned ${excess} excess docs (cap: ${MAX_DOCS})`);
    }

    console.log(`[cleanupCache] Done. Remaining docs: ${Math.max(0, totalSnap.size - (staleSnap?.size || 0) - Math.max(0, excess))}`);
  }
);
