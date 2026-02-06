/**
 * Domain Types for Unified Learning Intelligence Platform
 * Strict JSON schemas for Intent, Diagnosis, and Learning Objectives
 */

/**
 * Generate a UUID (browser-compatible)
 * @returns {string}
 */
function generateUUID() {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Intent Object - Captures user's problem description
 * @param {string} userRole - The user's role/persona
 * @param {string} goal - What they're trying to achieve
 * @param {string} problemDescription - Plain-English problem description
 * @param {string[]} systems - UE5 systems involved
 * @param {string[]} constraints - Any constraints (time, platform, etc.)
 * @returns {Object} Intent object
 */
export function createIntent(userRole, goal, problemDescription, systems = [], constraints = []) {
  return {
    intent_id: `intent_${generateUUID()}`,
    user_role: userRole || "unknown",
    goal: goal || "",
    problem_description: problemDescription || "",
    systems: Array.isArray(systems) ? systems : [],
    constraints: Array.isArray(constraints) ? constraints : [],
    created_at: new Date().toISOString(),
  };
}

/**
 * Validate an Intent object
 * @param {Object} intent
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateIntent(intent) {
  const errors = [];

  if (!intent.intent_id || !intent.intent_id.startsWith("intent_")) {
    errors.push('intent_id must start with "intent_"');
  }
  if (!intent.problem_description || intent.problem_description.trim().length < 10) {
    errors.push("problem_description must be at least 10 characters");
  }
  if (!Array.isArray(intent.systems)) {
    errors.push("systems must be an array");
  }
  if (!Array.isArray(intent.constraints)) {
    errors.push("constraints must be an array");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Diagnosis Object - Root cause analysis
 * @param {string} problemSummary - One-sentence summary
 * @param {string[]} rootCauses - Why this problem occurs
 * @param {string[]} signalsToWatchFor - Indicators of this problem
 * @param {string[]} variablesThatMatter - What to focus on
 * @param {string[]} variablesThatDoNot - What to ignore
 * @param {string[]} generalizationScope - Where else this applies
 * @returns {Object} Diagnosis object
 */
export function createDiagnosis(
  problemSummary,
  rootCauses = [],
  signalsToWatchFor = [],
  variablesThatMatter = [],
  variablesThatDoNot = [],
  generalizationScope = []
) {
  return {
    diagnosis_id: `diag_${generateUUID()}`,
    problem_summary: problemSummary || "",
    root_causes: Array.isArray(rootCauses) ? rootCauses : [],
    signals_to_watch_for: Array.isArray(signalsToWatchFor) ? signalsToWatchFor : [],
    variables_that_matter: Array.isArray(variablesThatMatter) ? variablesThatMatter : [],
    variables_that_do_not: Array.isArray(variablesThatDoNot) ? variablesThatDoNot : [],
    generalization_scope: Array.isArray(generalizationScope) ? generalizationScope : [],
    created_at: new Date().toISOString(),
  };
}

/**
 * Validate a Diagnosis object
 * @param {Object} diagnosis
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateDiagnosis(diagnosis) {
  const errors = [];

  if (!diagnosis.diagnosis_id || !diagnosis.diagnosis_id.startsWith("diag_")) {
    errors.push('diagnosis_id must start with "diag_"');
  }
  if (!diagnosis.problem_summary || diagnosis.problem_summary.trim().length < 10) {
    errors.push("problem_summary must be at least 10 characters");
  }
  if (!Array.isArray(diagnosis.root_causes) || diagnosis.root_causes.length === 0) {
    errors.push("root_causes must be a non-empty array");
  }
  if (!Array.isArray(diagnosis.signals_to_watch_for)) {
    errors.push("signals_to_watch_for must be an array");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Learning Objectives - Fix-specific and Transferable
 * @param {string[]} fixSpecific - Objectives that solve the immediate problem
 * @param {string[]} transferable - Objectives that teach reusable skills
 * @returns {Object} Learning Objectives object
 */
export function createLearningObjectives(fixSpecific = [], transferable = []) {
  return {
    fix_specific: Array.isArray(fixSpecific) ? fixSpecific : [],
    transferable: Array.isArray(transferable) ? transferable : [],
    created_at: new Date().toISOString(),
  };
}

/**
 * Validate Learning Objectives (ANTI-TUTORIAL-HELL requirement)
 * At least ONE transferable objective is REQUIRED
 * @param {Object} objectives
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateLearningObjectives(objectives) {
  const errors = [];

  if (!Array.isArray(objectives.fix_specific)) {
    errors.push("fix_specific must be an array");
  }
  if (!Array.isArray(objectives.transferable)) {
    errors.push("transferable must be an array");
  }
  // CRITICAL: Anti-tutorial-hell requirement
  if (!objectives.transferable || objectives.transferable.length === 0) {
    errors.push("ANTI-TUTORIAL-HELL: At least ONE transferable objective is REQUIRED");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Adaptive Learning Cart - Combined diagnosis and objectives
 * @param {Object} intent - The user's intent
 * @param {Object} diagnosis - The diagnosis
 * @param {Object} objectives - Learning objectives
 * @param {Object[]} recommendedCourses - Courses to fix + learn
 * @returns {Object} Adaptive Learning Cart
 */
export function createAdaptiveLearningCart(intent, diagnosis, objectives, recommendedCourses = []) {
  return {
    cart_id: `cart_${generateUUID()}`,
    intent,
    diagnosis,
    objectives,
    recommended_courses: recommendedCourses,
    created_at: new Date().toISOString(),
  };
}

export default {
  createIntent,
  validateIntent,
  createDiagnosis,
  validateDiagnosis,
  createLearningObjectives,
  validateLearningObjectives,
  createAdaptiveLearningCart,
};
