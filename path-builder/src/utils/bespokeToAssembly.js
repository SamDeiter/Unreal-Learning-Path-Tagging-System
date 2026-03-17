/**
 * bespokeToAssembly.js — Converts bespokePathService output to PathContext format
 *
 * Takes the result from generateBespokePath() (which includes v2Path with
 * sections/steps) and transforms it into the { courses, modules, learningIntent }
 * shape that PathContext.LOAD_PATH expects.
 *
 * Mapping:
 *   V2 Section (prerequisite/core/practice) → Module
 *   V2 Step → Course (with all teaching metadata preserved)
 */

import { sanitizeTitle } from "./titleSanitizer";
import { SECTION_LABELS, SECTION_PHASES } from "../schemas/LearningPathV2";

/**
 * Convert a bespokePathService result into PathContext-compatible format.
 *
 * @param {Object} bespokeResult - Output from generateBespokePath()
 * @returns {{ courses: Array, modules: Array, learningIntent: Object }}
 */
export function convertBespokeToAssembly(bespokeResult) {
  if (!bespokeResult || !bespokeResult.v2Path) {
    return { courses: [], modules: [], learningIntent: {} };
  }

  const v2Path = bespokeResult.v2Path;
  const sections = v2Path.sections || [];
  const courses = [];
  const modules = [];

  sections.forEach((section, sectionIdx) => {
    const moduleId = `mod-bespoke-${section.phase || sectionIdx}`;
    const courseIds = [];

    (section.steps || []).forEach((step, stepIdx) => {
      // Generate a stable code for each step
      const code = step.id || `bespoke-${section.phase}-${stepIdx}`;

      // Map V2 step → PathContext course
      const course = {
        code,
        title: step.title,
        cleanTitle: sanitizeTitle(step.title),
        originalTitle: step.title,
        // Teaching metadata
        summary: step.summary || "",
        outcome: step.whyThisMatters || step.summary || "",
        why: step.whyThisMatters || `Part of ${SECTION_LABELS[section.phase] || section.phase} section`,
        takeaway: step.takeaway || "",
        whatToDo: step.whatToDo || [],
        howToVerify: step.howToVerify || [],
        commonMistake: step.commonMistake || "",
        // Classification
        role: mapPhaseToRole(section.phase),
        category: step.category || section.phase || "core",
        weight: "Medium",
        completionType: step.completionType || "do",
        estimatedMinutes: step.estimatedMinutes || 3,
        // Source lineage
        source: step.source?.type || "ai_generated",
        sourceType: step.source?.type || "ai_generated",
        sourceUrl: step.source?.url || "",
        videoTitle: step.source?.videoTitle || "",
        // Video info
        video: step.video || null,
        goDeeper: step.goDeeper || [],
        // Pin/lock state
        isPinned: false,
        // Preserve original V2 step data for round-tripping
        _v2Step: step,
        _bridgeText: step._bridgeText || "",
      };

      courses.push(course);
      courseIds.push(code);
    });

    // Map V2 section → PathContext module
    modules.push({
      id: moduleId,
      title: section.title || SECTION_LABELS[section.phase] || `Module ${sectionIdx + 1}`,
      outcome: section.outcome || section.purpose || "",
      courseIds,
      kstEnabled: false,
      bktEnabled: false,
      verificationPrompt: section.verificationPrompt || "",
      exitCondition: section.exitCondition || "quiz",
    });
  });

  // Build learning intent from the path metadata
  const learningIntent = {
    goal: v2Path.learnerGoal || v2Path._originalQuery || "",
    title: v2Path.title || "",
    skillLevel: v2Path.difficulty || "intermediate",
    isAiGenerated: v2Path.isAiGenerated || false,
    generatedAt: v2Path.generatedAt || new Date().toISOString(),
  };

  return { courses, modules, learningIntent };
}

/**
 * Map V2 section phase to PathContext role.
 */
function mapPhaseToRole(phase) {
  switch (phase) {
    case "prerequisite": return "Prerequisite";
    case "practice":     return "Supplemental";
    case "core":
    default:             return "Core";
  }
}

/**
 * Get the ordered list of phases that should become modules.
 * Re-exported for wizard UI to display module labels.
 */
export { SECTION_PHASES, SECTION_LABELS };
