const admin = require("firebase-admin");

// Load environment variables from .env file (for local development)
require("dotenv").config();

admin.initializeApp();

// ============================================================================
// AI Functions - Existing
// ============================================================================
Object.assign(exports, require("./ai/generateLearningPath"));
Object.assign(exports, require("./ai/generateCourseMetadata"));

// ============================================================================
// AI Functions - Problem-First Learning (Adaptive Cart)
// ============================================================================
Object.assign(exports, require("./ai/extractIntent"));
Object.assign(exports, require("./ai/generateDiagnosis"));
Object.assign(exports, require("./ai/decomposeLearningObjectives"));
Object.assign(exports, require("./ai/validateCurriculum"));

// ============================================================================
// Unified Query Endpoint
// ============================================================================
Object.assign(exports, require("./ai/queryLearningPath"));

// ============================================================================
// Semantic Search - Query Embedding only
// ----------------------------------------------------------------------------
// expandQuery and rerankPassages were removed in the 2026-04-22 slim-down.
// Reasons:
//   * expandQuery: paraphrases were being routed into keyword-only search
//     (null embedding), so they added an LLM round-trip for a keyword-search
//     benefit that modern embeddings don't need.
//   * rerankPassages: Gemini cross-encoder on 30 passages adds 1-2s and
//     ~9k tokens per query. With gemini-embedding-001, cosine ordering is
//     strong enough until eval data shows otherwise.
// Both files are kept on disk but unexported; restore the require() line
// above when eval data justifies them.
// ============================================================================
Object.assign(exports, require("./ai/embedQuery"));
Object.assign(exports, require("./ai/searchVertexAIDocs"));

// ============================================================================
// Vector Search - Firestore KNN (replaces client-side cosine similarity)
// ============================================================================
Object.assign(exports, require("./ai/vectorSearch"));
Object.assign(exports, require("./ai/classifySegments"));

// ============================================================================
// Spoke Generator — Gap-filling mini-lessons (RAG → Gemini → structured JSON)
// ============================================================================
Object.assign(exports, require("./ai/generateSpoke"));
Object.assign(exports, require("./ai/generateAudioBriefing"));
Object.assign(exports, require("./ai/generateLesson"));

// ============================================================================
// Telemetry
// ============================================================================
Object.assign(exports, require("./ai/logTelemetry"));

// ============================================================================
// Feedback Loop (skillState signals)
// ============================================================================
Object.assign(exports, require("./ai/submitFeedback"));

// ============================================================================
// Quiz Result Ingestion (PFA knowledge tracing — Phase 2A)
// ============================================================================
Object.assign(exports, require("./ai/ingestQuizResult"));

// ============================================================================
// Misconception Library (Phase 3 — synthesize named misconceptions from signals)
// ============================================================================
Object.assign(exports, require("./ai/mineMisconceptions"));

// ============================================================================
// Scheduled Tasks
// ============================================================================
Object.assign(exports, require("./scheduled/cleanupCache"));
Object.assign(exports, require("./scheduled/checkTokenExpiry"));

// ============================================================================
// Admin Management
// ============================================================================
Object.assign(exports, require("./ai/setAdminClaim"));

// ============================================================================
// Demand Intelligence — trigger GitHub Action scrape from dashboard
// ============================================================================
Object.assign(exports, require("./ai/triggerDemandScrape"));
