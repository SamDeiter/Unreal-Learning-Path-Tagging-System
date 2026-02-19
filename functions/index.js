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
// Semantic Search - Query Embedding + Expansion + Re-ranking
// ============================================================================
Object.assign(exports, require("./ai/embedQuery"));
Object.assign(exports, require("./ai/expandQuery"));
Object.assign(exports, require("./ai/rerankPassages"));

// ============================================================================
// Telemetry
// ============================================================================
Object.assign(exports, require("./ai/logTelemetry"));
