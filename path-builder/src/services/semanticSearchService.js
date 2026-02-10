/**
 * semanticSearchService.js — Client-side semantic search using pre-computed embeddings.
 *
 * Loads course_embeddings.json and provides cosine similarity search
 * against a query embedding from the embedQuery Cloud Function.
 */

// Lazy-loaded course embeddings (0.4MB)
let _courseEmbeddings = null;
async function getCourseEmbeddings() {
  if (!_courseEmbeddings) {
    const mod = await import("../data/course_embeddings.json");
    _courseEmbeddings = mod.default || mod;
  }
  return _courseEmbeddings;
}

/**
 * Compute cosine similarity between two vectors.
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
 * @param {number[]} queryEmbedding - 768-dim query vector from embedQuery Cloud Function
 * @param {number} topK - Number of results to return (default 5)
 * @param {number} threshold - Minimum similarity to include (default 0.3)
 * @returns {Array<{code: string, title: string, similarity: number}>}
 */
export async function findSimilarCourses(queryEmbedding, topK = 5, threshold = 0.3) {
  const courseEmbeddings = await getCourseEmbeddings();
  if (!queryEmbedding || !courseEmbeddings?.courses) return [];

  const results = [];

  for (const [code, data] of Object.entries(courseEmbeddings.courses)) {
    const similarity = cosineSimilarity(queryEmbedding, data.embedding);
    if (similarity >= threshold) {
      results.push({
        code,
        title: data.title,
        similarity,
      });
    }
  }

  // Sort by similarity descending, take top K
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

/**
 * Get the embedding dimension expected by this service.
 * @returns {number}
 */
export async function getEmbeddingDimension() {
  const courseEmbeddings = await getCourseEmbeddings();
  return courseEmbeddings?.dimension || 768;
}

/**
 * Get the total number of embedded courses.
 * @returns {number}
 */
export async function getEmbeddedCourseCount() {
  const courseEmbeddings = await getCourseEmbeddings();
  return courseEmbeddings?.total_courses || 0;
}
