const admin = require("firebase-admin");

// Load environment variables from .env file (for local development)
require("dotenv").config();

admin.initializeApp();

// ============================================================================
// AI Functions
// ============================================================================
Object.assign(exports, require("./ai/generateLearningPath"));
Object.assign(exports, require("./ai/generateCourseMetadata"));
