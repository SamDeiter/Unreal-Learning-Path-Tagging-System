/**
 * blendedPathBuilder.js — Shared blended-path logic for both hooks.
 *
 * Takes diagnosis data, extracts doc topics from tags + query, calls
 * buildBlendedPath(), and merges non-video items (docs, YouTube).
 *
 * @module services/blendedPathBuilder
 */
import { buildBlendedPath } from "./coverageAnalyzer";
import { devLog, devWarn } from "../utils/logger";

/**
 * Build a blended learning path (docs + YouTube gap-fillers) from diagnosis data.
 *
 * @param {Object} inputData - The original user input (must have .query, .detectedTagIds)
 * @param {Object} cartData  - The diagnosis cart (must have .diagnosis.matched_tag_ids)
 * @param {Array}  driveVideos   - Drive video results to pass through
 * @param {Array}  nonVideoItems - Non-video items (docs/youtube) to merge in
 * @param {Set}    stopWords     - Stop words set to filter query terms
 * @returns {Promise<Object|null>} Blended path object or null if no topics found
 */
export async function buildBlendedPathFromDiagnosis(
  inputData, cartData, driveVideos, nonVideoItems, stopWords
) {
  try {
    const rawTags = [
      ...(cartData.diagnosis?.matched_tag_ids || []),
      ...(inputData.detectedTagIds || []),
    ];
    const tagSegments = rawTags.flatMap((t) =>
      t.split(/[._]/).filter((s) => s.length > 2 && s !== "unreal" && s !== "engine")
    );

    const queryWords = (inputData.query || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
    const docTopics = [...new Set(queryWords)];

    // Topic augmentation
    const hasWord = (w) => docTopics.some((t) => t.includes(w));
    if (hasWord("mesh") && !hasWord("skeletal")) {
      docTopics.push("static mesh", "static meshes", "import", "importing");
    }
    if (hasWord("size") || hasWord("scale")) {
      docTopics.push("scale", "transform");
    }

    const uniqueTopics = [...new Set([...tagSegments, ...docTopics])].slice(0, 15);
    devLog(`[DocTopics] ${docTopics.join(", ")}`);
    devLog(`[AllTopics] ${uniqueTopics.join(", ")}`);

    if (uniqueTopics.length === 0) return null;

    const blended = await buildBlendedPath(uniqueTopics, driveVideos, {
      maxDocs: 5,
      maxYoutube: 3,
    });

    // Merge non-video items
    for (const nv of nonVideoItems) {
      if (nv.type === "doc" && !blended.docs.some((d) => d.url === nv._externalUrl)) {
        blended.docs.push({
          label: nv.title,
          url: nv._externalUrl || nv.url,
          description: nv.description || "",
          readTimeMinutes: nv.readTimeMinutes || 10,
          tier: "intermediate",
        });
      }
      if (nv.type === "youtube" && !blended.youtube.some((y) => y.url === nv._externalUrl)) {
        blended.youtube.push({
          title: nv.title,
          url: nv._externalUrl || nv.url,
          channelName: nv.channel || "YouTube",
          channelTrust: nv.channelTrust || null,
          durationMinutes: nv.durationMinutes || 10,
          tier: "intermediate",
        });
      }
    }
    blended.docs.sort(
      (a, b) => (b._rawScore ?? b.matchScore ?? 0) - (a._rawScore ?? a.matchScore ?? 0)
    );

    devLog(
      `[Blended] ${blended.docs.length} docs, ${blended.youtube.length} YT, coverage: ${(blended.coverageScore * 100).toFixed(0)}%`
    );

    return blended;
  } catch (blendedErr) {
    devWarn("⚠️ Blended path skipped:", blendedErr.message);
    return null;
  }
}
