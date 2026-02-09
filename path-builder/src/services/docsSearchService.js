/**
 * Docs Search Service - Search Epic UE5 documentation passages
 * Uses pre-computed embeddings from scrape_epic_docs.py (docs_embeddings.json)
 *
 * Follows the same lazy-loading + float16 decoding pattern as segmentSearchService.
 */

import { cosineSimilarity } from "./semanticSearchService";

// Lazy-loaded (4.8MB quantized)
let _docsEmbeddings = null;
let _decodedVectors = null;

/**
 * Decode a base64-encoded float16 vector to Float32Array.
 */
function decodeFloat16Vector(b64, dim = 768) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const result = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    const half = view.getUint16(i * 2, true);
    result[i] = float16ToFloat32(half);
  }
  return result;
}

function float16ToFloat32(half) {
  const sign = (half >> 15) & 0x1;
  const exponent = (half >> 10) & 0x1f;
  const mantissa = half & 0x3ff;

  if (exponent === 0) {
    return (sign ? -1 : 1) * Math.pow(2, -14) * (mantissa / 1024);
  } else if (exponent === 31) {
    return mantissa ? NaN : sign ? -Infinity : Infinity;
  }
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + mantissa / 1024);
}

/**
 * Lazily load and decode doc embeddings.
 */
async function getDocsEmbeddings() {
  if (_decodedVectors) return _decodedVectors;

  if (!_docsEmbeddings) {
    try {
      const mod = await import("../data/docs_embeddings.json");
      _docsEmbeddings = mod.default || mod;
    } catch (err) {
      console.warn("⚠️ docs_embeddings.json not available:", err.message);
      return null;
    }
  }

  const docs = _docsEmbeddings?.docs;
  if (!docs) return null;

  _decodedVectors = new Map();
  for (const [id, doc] of Object.entries(docs)) {
    _decodedVectors.set(id, {
      vector: decodeFloat16Vector(doc.embedding),
      slug: doc.slug,
      url: doc.url,
      title: doc.title,
      section: doc.section,
      text: doc.text,
      tokenEstimate: doc.token_estimate,
    });
  }

  console.log(`[DocsSearch] Decoded ${_decodedVectors.size} doc embeddings`);
  return _decodedVectors;
}

/**
 * Search Epic UE5 documentation by semantic similarity.
 *
 * @param {number[]|Float32Array} queryEmbedding - 768-dim query vector
 * @param {number} topK - Max results (default 5)
 * @param {number} threshold - Min similarity (default 0.35)
 * @returns {Promise<Array<{id, slug, url, title, section, text, similarity}>>}
 */
export async function searchDocsSemantic(queryEmbedding, topK = 5, threshold = 0.35) {
  if (!queryEmbedding) return [];

  const embeddings = await getDocsEmbeddings();
  if (!embeddings) {
    console.warn("[DocsSearch] Semantic search unavailable — no embeddings loaded");
    return [];
  }

  const results = [];
  for (const [id, doc] of embeddings) {
    const similarity = cosineSimilarity(queryEmbedding, doc.vector);
    if (similarity >= threshold) {
      results.push({
        id,
        slug: doc.slug,
        url: doc.url,
        title: doc.title,
        section: doc.section,
        previewText: doc.text,
        similarity,
        source: "epic_docs",
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

export default {
  searchDocsSemantic,
};
