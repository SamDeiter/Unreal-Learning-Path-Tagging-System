/**
 * Constants used across Contexts and Components
 * Separated to avoid "fast-refresh/only-export-components" lint errors
 */

export const TAG_Types = {
  TOPIC: "topic",
  LEVEL: "level",
  CONCEPT: "concept",
  PLATFORM: "platform",
  ENGINE_VERSION: "engine_version",
};

export const INITIAL_PATH_STATE = {
  currentStage: "onboarding", // onboarding, library, builder, player
  learningIntent: null, // { primaryGoal, skillLevel, timeBudget }
  selectedCourses: [], // Array of course objects
  pathNodes: [], // Array of { id, type, content, status }
  activeNodeId: null,
};
