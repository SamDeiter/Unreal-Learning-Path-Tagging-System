/**
 * semanticSearchService.js — Semantic search via Firestore vector KNN.
 *
 * Previously loaded course_embeddings.json locally and computed cosine
 * similarity client-side. Now delegates to vectorSearchCourses Cloud Function
 * which uses Firestore findNearest() for server-side KNN.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";

/**
 * Compute cosine similarity between two vectors.
 * Still used for local re-ranking and hybrid search merging.
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score between -1 and 1
 */
export function cosineSimilarity(a, b) {
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
 * Find courses most similar to a query embedding.
 * Delegates to vectorSearchCourses Cloud Function (Firestore KNN).
 *
 * @param {number[]} queryEmbedding - 768-dim query vector from embedQuery Cloud Function
 * @param {number} topK - Number of results to return (default 5)
 * @param {number} threshold - Minimum similarity to include (default 0.3) — unused, server handles ranking
 * @returns {Array<{code: string, title: string, similarity: number}>}
 */
export async function findSimilarCourses(queryEmbedding, topK = 5, _threshold = 0.3) {
  if (!queryEmbedding) return [];

  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const searchFn = httpsCallable(functions, "vectorSearchCourses");

    const result = await searchFn({ queryVector: queryEmbedding, topK });

    if (result.data?.results) {
      return result.data.results.map((r) => ({
        code: r.course_code || r.id,
        title: r.title || "",
        similarity: r.similarity || 0,
      }));
    }
    return [];
  } catch (err) {
    console.warn("[SemanticSearch] vectorSearchCourses failed:", err.message);
    return [];
  }
}

/**
 * Get the embedding dimension expected by this service.
 * @returns {number}
 */
export async function getEmbeddingDimension() {
  return 768;
}

/**
 * Get the total number of embedded courses.
 * Dynamically derived from the search index course_words keys.
 * @returns {Promise<number>}
 */
let _embeddedCourseCount = null;
export async function getEmbeddedCourseCount() {
  if (_embeddedCourseCount !== null) return _embeddedCourseCount;
  try {
    const { fetchJSON } = await import("./dataLoader");
    const searchIndex = await fetchJSON("search_index");
    _embeddedCourseCount = Object.keys(searchIndex?.course_words || {}).length || 61;
  } catch {
    _embeddedCourseCount = 61; // fallback
  }
  return _embeddedCourseCount;
}
