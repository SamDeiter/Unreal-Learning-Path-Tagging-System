/**
 * searchPipeline.js — Shared RAG search pipeline for both Problem-First and Explore-First hooks.
 *
 * Encapsulates: query embedding, query expansion, multi-source semantic search
 * (courses, transcript segments, docs), expansion search, rank + dedup, and
 * cross-encoder re-ranking.
 *
 * @module services/searchPipeline
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { findSimilarCourses } from "./semanticSearchService";
import { searchSegmentsHybrid } from "./segmentSearchService";
import { searchDocsSemantic, searchDocsVertexAI } from "./docsSearchService";
import { devLog, devWarn } from "../utils/logger";
import { deduplicateBy } from "../utils/collectionUtils";
import { retryWithBackoff } from "../utils/retryWithBackoff";

/**
 * Run the full RAG search pipeline: embed → expand → multi-source search → dedup → re-rank.
 *
 * @param {string} query - The user's natural-language query
 * @param {Object} [options]
 * @param {number} [options.maxPassages=10] - Max passages to return after dedup + re-rank
 * @param {number} [options.maxCourses=8]   - Max courses from semantic search
 * @param {number} [options.maxSegments=8]  - Max transcript segments
 * @param {number} [options.maxDocs=6]      - Max doc passages
 * @param {number} [options.minSimilarity=0.35] - Similarity threshold for courses/docs
 * @returns {Promise<{queryEmbedding: number[]|null, semanticResults: Array, retrievedPassages: Array, expandedQueries: string[], vertexAIDocs: Object|null}>}
 */
export async function runSearchPipeline(query, options = {}) {
  const {
    maxPassages = 10,
    maxCourses = 8,
    maxSegments = 8,
    maxDocs = 6,
    minSimilarity = 0.35,
  } = options;

  const app = getFirebaseApp();
  const functions = getFunctions(app, "us-central1");

  let queryEmbedding = null;
  let semanticResults = [];
  let retrievedPassages = [];
  let expandedQueries = [];
  let vertexAIDocs = null;

  try {
    const embedQueryFn = httpsCallable(functions, "embedQuery");
    const expandQueryFn = httpsCallable(functions, "expandQuery");

    const [embedResult, expandResult, vertexResult] = await Promise.allSettled([
      retryWithBackoff(() => embedQueryFn({ query }), { maxRetries: 2, label: "embedQuery" }),
      retryWithBackoff(() => expandQueryFn({ query }), { maxRetries: 2, label: "expandQuery" }),
      searchDocsVertexAI(query, maxDocs),
    ]);

    // Vertex AI docs (independent of embedding)
    if (vertexResult.status === "fulfilled" && vertexResult.value) {
      vertexAIDocs = vertexResult.value;
      devLog(`[VertexAI] ${vertexAIDocs.results?.length || 0} official doc results`);
    } else if (vertexResult.status === "rejected") {
      devWarn("⚠️ Vertex AI docs search failed:", vertexResult.reason?.message);
    }

    if (expandResult.status === "fulfilled" && expandResult.value.data?.expansions) {
      expandedQueries = expandResult.value.data.expansions;
      devLog(`[QueryExpansion] ${expandedQueries.length} variants: ${expandedQueries.join(" | ")}`);
    }

    if (
      embedResult.status === "fulfilled" &&
      embedResult.value.data?.success &&
      embedResult.value.data?.embedding
    ) {
      queryEmbedding = embedResult.value.data.embedding;

      const [courseResult, segResult, docResult] = await Promise.allSettled([
        findSimilarCourses(queryEmbedding, maxCourses, minSimilarity),
        searchSegmentsHybrid(query, queryEmbedding, [], maxSegments),
        searchDocsSemantic(queryEmbedding, maxDocs, minSimilarity),
      ]);

      if (courseResult.status === "fulfilled") {
        semanticResults = courseResult.value;
      } else {
        devWarn("⚠️ Course semantic search failed:", courseResult.reason?.message);
      }

      if (segResult.status === "fulfilled") {
        const segPassages = segResult.value.map((s) => ({
          text: s.previewText,
          courseCode: s.courseCode,
          videoTitle: s.videoTitle,
          timestamp: s.timestamp,
          similarity: s.similarity,
          source: "transcript",
        }));
        retrievedPassages.push(...segPassages);
        devLog(`[RAG] ${segPassages.length} transcript passages`);
      } else {
        devWarn("⚠️ Segment search failed:", segResult.reason?.message);
      }

      if (docResult.status === "fulfilled") {
        const docPassages = docResult.value.map((d) => ({
          text: d.previewText,
          url: d.url,
          title: d.title,
          section: d.section,
          similarity: d.similarity,
          source: "epic_docs",
        }));
        retrievedPassages.push(...docPassages);
        devLog(`[RAG] ${docPassages.length} doc passages`);
      } else {
        devWarn("⚠️ Docs search failed:", docResult.reason?.message);
      }

      // Query Expansion: search expanded variants
      if (expandedQueries.length > 0) {
        const expansionSearches = expandedQueries.map((eq) =>
          searchSegmentsHybrid(eq, null, [], 4).catch(() => [])
        );
        const expansionResults = await Promise.allSettled(expansionSearches);
        let expansionCount = 0;
        for (const er of expansionResults) {
          if (er.status === "fulfilled" && er.value.length > 0) {
            const expPassages = er.value.map((s) => ({
              text: s.previewText,
              courseCode: s.courseCode,
              videoTitle: s.videoTitle,
              timestamp: s.timestamp,
              similarity: (s.similarity || 0) * 0.9,
              source: "transcript",
            }));
            retrievedPassages.push(...expPassages);
            expansionCount += expPassages.length;
          }
        }
        if (expansionCount > 0) {
          devLog(`[QueryExpansion] +${expansionCount} passages from expanded queries`);
        }
      }

      // Rank + dedup
      retrievedPassages.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      retrievedPassages = deduplicateBy(retrievedPassages, (p) =>
        (p.text || "").trim().toLowerCase().slice(0, 120)
      );
      devLog(`[RAG] Total: ${retrievedPassages.length} passages after rank+dedup`);
    } else {
      devWarn("⚠️ Embedding failed — falling back to keyword-only search");
    }
  } catch (semanticErr) {
    devWarn("⚠️ Semantic search skipped:", semanticErr.message);
  }

  // Cross-encoder re-ranking
  if (retrievedPassages.length > 2) {
    try {
      const rerankFn = httpsCallable(functions, "rerankPassages");
      const rerankResult = await retryWithBackoff(
        () => rerankFn({ query, passages: retrievedPassages.slice(0, 20) }),
        { maxRetries: 1, label: "rerankPassages" }
      );
      if (rerankResult.data?.success && rerankResult.data?.reranked) {
        retrievedPassages = rerankResult.data.reranked;
        if (!rerankResult.data.fallback) {
          devLog(`[Rerank] Passages re-ranked by Gemini cross-encoder`);
        }
      }
    } catch (rerankErr) {
      devWarn("⚠️ Re-ranking skipped:", rerankErr.message);
    }
  }
  retrievedPassages = retrievedPassages.slice(0, maxPassages);

  return { queryEmbedding, semanticResults, retrievedPassages, expandedQueries, vertexAIDocs };
}
