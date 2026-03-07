/**
 * cleanupCache — Scheduled Cloud Function to prune stale Firestore collections.
 *
 * Runs daily. Manages three collections:
 *   1. cached_diagnoses — 30-day TTL, 500-doc cap
 *   2. pathCache — 14-day TTL, 1000-doc cap
 *   3. errorLogs — 30-day TTL, 2000-doc cap
 *   4. performanceLogs — 7-day TTL, 5000-doc cap
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// Initialize admin if not already initialized
if (!admin.apps.length) admin.initializeApp();

/**
 * Generic collection pruner.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} collectionName
 * @param {string} timeField — field storing the timestamp (ISO string or Firestore Timestamp)
 * @param {number} maxAgeDays — delete docs older than this
 * @param {number} maxDocs — cap total documents
 */
async function pruneCollection(db, collectionName, timeField, maxAgeDays, maxDocs) {
  const collRef = db.collection(collectionName);

  // 1. Delete docs older than maxAgeDays
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const staleSnap = await collRef.where(timeField, "<", cutoff.toISOString()).limit(200).get();

  let deletedStale = 0;
  if (!staleSnap.empty) {
    const batch = db.batch();
    staleSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedStale = staleSnap.size;
  }

  // 2. Cap total docs (delete oldest if exceeded)
  const totalSnap = await collRef.orderBy(timeField, "asc").get();
  const excess = totalSnap.size - maxDocs;
  let deletedExcess = 0;

  if (excess > 0) {
    const batch = db.batch();
    totalSnap.docs.slice(0, excess).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedExcess = excess;
  }

  console.log(
    `[cleanupCache] ${collectionName}: deleted ${deletedStale} stale + ${deletedExcess} excess. ` +
      `Remaining: ~${Math.max(0, totalSnap.size - deletedStale - deletedExcess)}`
  );
}

exports.cleanupCache = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "America/New_York",
    region: "us-east1",
  },
  async () => {
    const db = admin.firestore();

    await pruneCollection(db, "cached_diagnoses", "createdAt", 30, 500);
    await pruneCollection(db, "pathCache", "cachedAt", 14, 1000);
    await pruneCollection(db, "errorLogs", "timestamp", 30, 2000);
    await pruneCollection(db, "performanceLogs", "timestamp", 7, 5000);

    console.log("[cleanupCache] All collections pruned.");
  }
);
