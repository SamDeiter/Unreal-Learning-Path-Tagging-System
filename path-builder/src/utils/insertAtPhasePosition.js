/**
 * insertAtPhasePosition.js — Smart step insertion
 *
 * Instead of always appending gap-fill steps to the end,
 * insert them at the correct position based on phase order:
 *   prerequisite/foundation → core/fix → practice/transfer
 *
 * Phase priority order (lower = earlier):
 *   prerequisite: 0, foundation: 0, diagnosis: 1,
 *   core: 2, fix: 2, practice: 3, transfer: 3
 */

const PHASE_ORDER = {
  prerequisite: 0,
  foundation: 0,
  diagnosis: 1,
  core: 2,
  fix: 2,
  practice: 3,
  transfer: 3,
};

/**
 * Insert a new step at the correct phase position in the path.
 *
 * @param {Array} path - Current ordered path steps
 * @param {Object} newStep - The step to insert (must have a `category`)
 * @returns {Array} New path array with the step inserted
 */
export function insertAtPhasePosition(path, newStep) {
  const category = newStep.category || "fix";
  const targetOrder = PHASE_ORDER[category] ?? 2; // default to core

  // Find the last index of a step whose phase is <= our target phase
  let insertIdx = path.length; // default: append
  for (let i = path.length - 1; i >= 0; i--) {
    const stepOrder = PHASE_ORDER[path[i].category] ?? 2;
    if (stepOrder <= targetOrder) {
      insertIdx = i + 1;
      break;
    }
  }

  const updated = [...path];
  updated.splice(insertIdx, 0, newStep);
  return updated;
}
