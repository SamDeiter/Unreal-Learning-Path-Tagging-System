/**
 * diagnosisCacheUtils.js — Diagnosis Caching for Similar Query Reuse
 *
 * Stores AI diagnosis results in Firestore so similar future queries
 * get instant answers without calling Gemini.
 *
 * Schema (cached_diagnoses collection):
 *   {
 *     uid: string,                     // owning user — required for per-user cache isolation
 *     embedding: FieldValue.vector(),  // 768-dim query embedding (Firestore Vector)
 *     query: string,                   // original query text
 *     result: object,                  // full diagnosis response payload
 *     hitCount: number,                // how many times this cache entry has been used
 *     createdAt: Timestamp,
 *     lastHitAt: Timestamp
 *   }
 *
 * Strategy: Uses Firestore findNearest() for native vector KNN search.
 * Falls back to linear scan if vector index is not provisioned.
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

const COLLECTION = "cached_diagnoses";
const DEFAULT_THRESHOLD = 0.92;
const MAX_CACHE_SCAN = 200; // Fallback linear scan limit

/**
 * Compute cosine similarity between two vectors.
 * Kept for fallback path and unit tests.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dot / magnitude;
}

/**
 * Find a cached diagnosis using Firestore native vector KNN (findNearest),
 * scoped to a single user's cache partition.
 *
 * `uid` is required. Without it we would serve one user's cached diagnosis
 * to another learner whose query happens to land within the cosine
 * threshold — silently violating the per-learner contract the UI promises.
 * Pass `uid` explicitly; callers that genuinely have no user (e.g. admin
 * tools) should not be using this cache at all.
 *
 * @param {string} uid - Owning user UID. Required.
 * @param {number[]} queryEmbedding - 768-dim embedding of the user's query
 * @param {number} threshold - Minimum cosine similarity to count as a hit (default 0.92)
 * @returns {Promise<{hit: boolean, result?: object, docId?: string, similarity?: number}>}
 */
async function findCachedDiagnosis(uid, queryEmbedding, threshold = DEFAULT_THRESHOLD) {
  if (!uid || typeof uid !== "string") {
    return { hit: false };
  }
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return { hit: false };
  }

  const db = admin.firestore();

  // --- Primary path: Firestore vector KNN with uid pre-filter ---
  try {
    const distanceThreshold = 1 - threshold;
    const snapshot = await db
      .collection(COLLECTION)
      .where("uid", "==", uid)
      .findNearest({
        vectorField: "embedding",
        queryVector: FieldValue.vector(queryEmbedding),
        limit: 1,
        distanceMeasure: "COSINE",
        distanceResultField: "vector_distance",
        distanceThreshold,
      })
      .get();

    if (snapshot.empty) {
      return { hit: false };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const rawDist = data.vector_distance;
    const similarity = rawDist !== null && rawDist !== undefined ? 1 - rawDist : 0;

    // Remove transient field before returning
    delete data.vector_distance;

    // Increment hit count (fire-and-forget)
    db.collection(COLLECTION)
      .doc(doc.id)
      .update({
        hitCount: admin.firestore.FieldValue.increment(1),
        lastHitAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {}); // Non-blocking

    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "diagnosis_cache_hit",
        method: "findNearest",
        similarity: similarity.toFixed(4),
        docId: doc.id,
      })
    );

    return { hit: true, result: data.result, docId: doc.id, similarity };
  } catch (knnErr) {
    // Vector index may not be provisioned — fall back to linear scan
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "diagnosis_cache_knn_fallback",
        error: knnErr.message,
      })
    );
  }

  // --- Fallback: linear scan (original behavior), uid-scoped ---
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where("uid", "==", uid)
      .orderBy("lastHitAt", "desc")
      .limit(MAX_CACHE_SCAN)
      .get();

    if (snapshot.empty) {
      return { hit: false };
    }

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.embedding || !Array.isArray(data.embedding)) continue;

      const similarity = cosineSimilarity(queryEmbedding, data.embedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { docId: doc.id, result: data.result, similarity };
      }
    }

    if (bestMatch && bestSimilarity >= threshold) {
      db.collection(COLLECTION)
        .doc(bestMatch.docId)
        .update({
          hitCount: admin.firestore.FieldValue.increment(1),
          lastHitAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "diagnosis_cache_hit",
          method: "linear_scan",
          similarity: bestSimilarity.toFixed(4),
          docId: bestMatch.docId,
        })
      );

      return {
        hit: true,
        result: bestMatch.result,
        docId: bestMatch.docId,
        similarity: bestSimilarity,
      };
    }

    return { hit: false, bestSimilarity };
  } catch (err) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "diagnosis_cache_lookup_error",
        error: err.message,
      })
    );
    return { hit: false };
  }
}

/**
 * Cache a new diagnosis result for future reuse, scoped to the owning user.
 *
 * `uid` is required: the lookup side filters by uid, so a write without it
 * would produce an entry that can never be found again.
 *
 * @param {string} uid - Owning user UID. Required.
 * @param {number[]} embedding - 768-dim query embedding
 * @param {string} query - Original query text
 * @param {object} result - Full diagnosis response payload to cache
 * @returns {Promise<string|null>} The document ID of the cached entry, or null on error
 */
async function cacheDiagnosis(uid, embedding, query, result) {
  if (!uid || typeof uid !== "string") return null;
  if (!embedding || !query || !result) return null;

  try {
    const db = admin.firestore();
    const docRef = await db.collection(COLLECTION).add({
      uid,
      embedding,
      query: String(query).slice(0, 500),
      result,
      hitCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastHitAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "diagnosis_cached",
        docId: docRef.id,
        queryLength: query.length,
      })
    );

    return docRef.id;
  } catch (err) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "diagnosis_cache_write_error",
        error: err.message,
      })
    );
    return null;
  }
}

module.exports = { cosineSimilarity, findCachedDiagnosis, cacheDiagnosis };
