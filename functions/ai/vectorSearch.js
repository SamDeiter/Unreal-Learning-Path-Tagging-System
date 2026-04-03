/**
 * vectorSearch.js — Firestore Vector KNN Search Cloud Function
 *
 * Provides vector similarity search against Firestore collections
 * that contain pre-computed embeddings with native Vector fields.
 *
 * Endpoints:
 *   vectorSearchEpic     — Search epic_embeddings (3,831 RAG chunks)
 *   vectorSearchCourses  — Search course_embeddings (~190 courses)
 *   vectorSearchSegments — Search segment_embeddings
 *   vectorSearchDocs     — Search docs_embeddings
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { checkRateLimits } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { requireAppCheck } = require("../utils/appCheckMiddleware");

const db = admin.firestore();

/**
 * Shared rate limit enforcement for vector search endpoints.
 */
async function enforceRateLimit(request) {
  const userId = request.auth?.uid || "anonymous";
  const rateLimitCheck = await checkRateLimits(userId, "generation");
  if (!rateLimitCheck.allowed) {
    throw new HttpsError("resource-exhausted", rateLimitCheck.message);
  }
  return userId;
}

/**
 * Validate a query vector before sending to Firestore.
 * Checks dimension, type, and for NaN/Infinity values.
 */
function validateVector(queryVector) {
  if (!queryVector || !Array.isArray(queryVector)) {
    throw new HttpsError("invalid-argument", "queryVector is required and must be an array");
  }
  if (queryVector.length !== 768) {
    throw new HttpsError("invalid-argument", `Expected 768-dim vector, got ${queryVector.length}`);
  }
  if (queryVector.some(v => !Number.isFinite(v))) {
    throw new HttpsError("invalid-argument", "Vector contains NaN or Infinity values");
  }
}

/**
 * Generic vector search against a Firestore collection.
 * Uses findNearest() for native KNN search.
 */
async function searchCollection(collectionName, queryVector, topK) {
  const collRef = db.collection(collectionName);

  const snapshot = await collRef
    .findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryVector),
      limit: topK,
      distanceMeasure: "COSINE",
      distanceResultField: "vector_distance",
    })
    .get();

  const results = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Remove the embedding vector from results (too large to send back)
    // eslint-disable-next-line no-unused-vars
    const { embedding: _embedding, vector_distance: rawDist, ...metadata } = data;
    // Cosine distance ranges [0, 2]: 0 = identical, 1 = orthogonal, 2 = opposite.
    // Convert to similarity [1, 0]: 1 = identical, 0 = opposite.
    const similarity = rawDist !== null && rawDist !== undefined ? 1 - rawDist / 2 : 0;
    results.push({
      id: doc.id,
      similarity,
      ...metadata,
    });
  });

  return results;
}

/**
 * Search epic_embeddings — main RAG search across all content
 */
exports.vectorSearchEpic = onCall({ region: "us-central1", maxInstances: 10, memory: "512MiB", minInstances: 0 }, async (request) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck(request, { allowInvalid: true });
  const userId = await enforceRateLimit(request);
  const { queryVector, topK = 10 } = request.data;
  validateVector(queryVector);

  const results = await searchCollection("epic_embeddings", queryVector, Math.min(topK, 20));
  logApiUsage(userId, { type: "generation", function: "vectorSearchEpic" , firestoreReads: 12, firestoreWrites: 1 });

  return { results, count: results.length };
});

/**
 * Search course_embeddings — course-level similarity
 */
exports.vectorSearchCourses = onCall(
  { region: "us-central1", maxInstances: 10, memory: "512MiB", minInstances: 0 },
  async (request) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck(request, { allowInvalid: true });
    const userId = await enforceRateLimit(request);
    const { queryVector, topK = 5 } = request.data;
    validateVector(queryVector);

    const results = await searchCollection("course_embeddings", queryVector, Math.min(topK, 20));
    logApiUsage(userId, { type: "generation", function: "vectorSearchCourses" , firestoreReads: 7, firestoreWrites: 1 });

    return { results, count: results.length };
  }
);

/**
 * Search segment_embeddings — video segment similarity
 */
exports.vectorSearchSegments = onCall(
  { region: "us-central1", maxInstances: 10, memory: "512MiB", minInstances: 0 },
  async (request) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck(request, { allowInvalid: true });
    const userId = await enforceRateLimit(request);
    const { queryVector, topK = 10 } = request.data;
    validateVector(queryVector);

    const results = await searchCollection("segment_embeddings", queryVector, Math.min(topK, 20));
    logApiUsage(userId, { type: "generation", function: "vectorSearchSegments" , firestoreReads: 12, firestoreWrites: 1 });

    return { results, count: results.length };
  }
);

/**
 * Search docs_embeddings — documentation similarity
 */
exports.vectorSearchDocs = onCall({ region: "us-central1", maxInstances: 10, memory: "512MiB", minInstances: 0 }, async (request) => {
  // App Check enforcement (permissive during rollout)
  requireAppCheck(request, { allowInvalid: true });
  const userId = await enforceRateLimit(request);
  const { queryVector, topK = 10 } = request.data;
  validateVector(queryVector);

  const results = await searchCollection("docs_embeddings", queryVector, Math.min(topK, 20));
  logApiUsage(userId, { type: "generation", function: "vectorSearchDocs" , firestoreReads: 12, firestoreWrites: 1 });

  return { results, count: results.length };
});
