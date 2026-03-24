/**
 * searchVertexAIDocs — Firebase Cloud Function proxy for Vertex AI Search.
 *
 * The @google-cloud/discoveryengine SDK is Node.js-only (server-side).
 * This function acts as an authenticated proxy so the React client can
 * query the UE5 docs data store via `httpsCallable`.
 *
 * Data store: ue5-docs-datastore (crawl of dev.epicgames.com UE5 documentation)
 * Project:    development-317819
 * Location:   global
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { SearchServiceClient } = require("@google-cloud/discoveryengine").v1beta;
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { requireAppCheck } = require("../utils/appCheckMiddleware");

// ── Configuration ──────────────────────────────────────────────────────────────
const PROJECT_ID = "development-317819";
const LOCATION = "global";
const DATA_STORE_ID = "ue5-docs-datastore_1771869696176";
const COLLECTION_ID = "default_collection";
const SERVING_CONFIG_ID = "default_config";

// Lazy-init client (cold start optimization)
let _client = null;
function getClient() {
  if (!_client) {
    const apiEndpoint =
      LOCATION === "global"
        ? "discoveryengine.googleapis.com"
        : `${LOCATION}-discoveryengine.googleapis.com`;
    _client = new SearchServiceClient({ apiEndpoint });
  }
  return _client;
}

// ── Cloud Function ─────────────────────────────────────────────────────────────
exports.searchVertexAIDocs = onCall(
  { region: "us-central1", timeoutSeconds: 30, memory: "512MiB", minInstances: 0 },
  async (request) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck(request, { allowInvalid: true });
    const userId = request.auth?.uid || "anonymous";
    const { query, pageSize = 5 } = request.data || {};

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new HttpsError("invalid-argument", "A non-empty query string is required.");
    }

    // Rate limit check
    const rateLimitCheck = await checkRateLimit(userId, "generation");
    if (!rateLimitCheck.allowed) {
      throw new HttpsError("resource-exhausted", `Rate limit exceeded. ${rateLimitCheck.message}`);
    }
    const globalCheck = await checkGlobalRateLimit(userId);
    if (!globalCheck.allowed) {
      throw new HttpsError("resource-exhausted", `${globalCheck.message}`);
    }

    const client = getClient();

    const servingConfig = client.projectLocationCollectionDataStoreServingConfigPath(
      PROJECT_ID,
      LOCATION,
      COLLECTION_ID,
      DATA_STORE_ID,
      SERVING_CONFIG_ID
    );

    const searchRequest = {
      pageSize: Math.min(pageSize, 10),
      query: query.trim(),
      servingConfig,
      // Enable AI summary of search results
      contentSearchSpec: {
        summarySpec: {
          summaryResultCount: 3,
          includeCitations: true,
          ignoreAdversarialQuery: true,
          ignoreNonSummarySeekingQuery: false,
        },
        extractiveContentSpec: {
          maxExtractiveAnswerCount: 1,
          maxExtractiveSegmentCount: 1,
        },
      },
    };

    try {
      const response = await client.search(searchRequest, {
        autoPaginate: false,
      });

      // response is [ISearchResponse, ISearchRequest, ISearchResponse]
      const searchResponse = response[2] || response[0];

      // Extract results
      const results = (searchResponse.results || []).map((r) => {
        const doc = r.document || {};
        const derivedData = doc.derivedStructData?.fields || {};

        return {
          title: derivedData.title?.stringValue || doc.name || "",
          url: derivedData.link?.stringValue || "",
          snippet:
            derivedData.snippets?.listValue?.values?.[0]?.structValue?.fields?.snippet
              ?.stringValue ||
            derivedData.extractive_segments?.listValue?.values?.[0]?.structValue?.fields?.content
              ?.stringValue ||
            "",
        };
      });

      // Extract AI summary
      const summary = searchResponse.summary || {};
      const summaryText = summary.summaryText || "";
      const citations = (summary.citations || []).map((c) => ({
        startIndex: c.startIndex,
        endIndex: c.endIndex,
        sources: (c.sources || []).map((s) => ({
          referenceIndex: s.referenceIndex,
          uri: s.uri || "",
        })),
      }));
      const references = (summary.references || []).map((ref) => ({
        title: ref.title || "",
        uri: ref.uri || "",
      }));

      return {
        success: true,
        results,
        summary: summaryText,
        citations,
        references,
        totalSize: searchResponse.totalSize || results.length,
      };
    } catch (err) {
      console.error("[searchVertexAIDocs] Error:", err.message);
      throw new HttpsError("internal", `Vertex AI Search failed: ${err.message}`);
    } finally {
      logApiUsage(userId, { type: "generation", function: "searchVertexAIDocs" , firestoreReads: 2, firestoreWrites: 1 });
    }
  }
);
