/**
 * v3Adapter.js — V2 →V3 Learning Path Adapter
 *
 * Converts enriched V2 LearningPath objects into the V3 COURSE_LIBRARY
 * format consumed by the viewer-v3 prototype.
 *
 * Mapping:
 *   V2 section.phase + SECTION_LABELS → V3 chapter.title + description
 *   V2 section.purpose              → V3 chapter.description
 *   V2 step.whyThisMatters + whatToDo → V3 AI_TRANSITION step
 *   V2 step.video (if present)       → V3 CONTENT_VIDEO step
 *   V2 step.summary (if no video)    → V3 CONTENT_DOC step
 *   V2 quiz (from quizService)       → V3 QUIZ step per chapter
 *
 * Exports:
 *   - convertV2ToV3(v2Path) → single V3 course object
 *   - convertV2ToV3Package(v2Path) → full COURSE_LIBRARY[] array
 */

import { SECTION_LABELS } from "./LearningPathV2";

// ── Constants ──────────────────────────────────────────────

let _chapterCounter = 0;
let _stepCounter = 0;

function resetCounters() {
  _chapterCounter = 0;
  _stepCounter = 0;
}

function nextChapterId() {
  _chapterCounter++;
  return `ch-${_chapterCounter}`;
}

function nextStepId(chapterNum) {
  _stepCounter++;
  return `ch${chapterNum}-s${_stepCounter}`;
}

// ── Skill Level Mapping ────────────────────────────────────

function mapDifficulty(v2Difficulty) {
  const map = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };
  return map[(v2Difficulty || "").toLowerCase()] || "Intermediate";
}

// ── Estimated Hours ────────────────────────────────────────

function calcEstimatedHours(v2Path) {
  let totalMins = v2Path.estimatedMinutes || 0;
  if (!totalMins) {
    for (const section of v2Path.sections || []) {
      for (const step of section.steps || []) {
        totalMins += step.estimatedMinutes || 5;
      }
    }
  }
  const hours = totalMins / 60;
  if (hours < 1) return "Under 1 Hour";
  if (hours < 3) return `${Math.ceil(hours)}-${Math.ceil(hours) + 2} Hours`;
  return `${Math.floor(hours)}-${Math.ceil(hours * 1.5)} Hours`;
}

// ── Tags Extraction ────────────────────────────────────────

function extractTags(v2Path) {
  const tags = new Set();
  for (const section of v2Path.sections || []) {
    for (const step of section.steps || []) {
      // Pull from video tags
      if (step.video?.tags) {
        for (const t of step.video.tags) {
          if (typeof t === "string") tags.add(t);
        }
      }
      // Pull from step-level tags
      if (step.tags) {
        const tagList = Array.isArray(step.tags) ? step.tags : Object.values(step.tags);
        for (const t of tagList) {
          if (typeof t === "string") tags.add(t);
        }
      }
    }
  }
  return [...tags].slice(0, 6); // V3 shows max ~6 tags
}

// ── Step Converters ────────────────────────────────────────

/**
 * Convert a V2 step into a V3 AI_TRANSITION step.
 * Contains objectives and expected outcome.
 */
function toV3Transition(v2Step, chapterNum) {
  const objectives = [];

  // Build objectives from whatToDo, whyThisMatters, and title
  if (v2Step.whyThisMatters) {
    objectives.push(v2Step.whyThisMatters);
  }
  if (v2Step.whatToDo?.length) {
    for (const action of v2Step.whatToDo.slice(0, 3)) {
      objectives.push(action);
    }
  }
  if (objectives.length === 0) {
    objectives.push(`Understand ${v2Step.title || "this concept"}`);
  }

  return {
    id: nextStepId(chapterNum),
    type: "AI_TRANSITION",
    objectives,
    expectedOutcome: v2Step.takeaway || v2Step.howToVerify?.[0] ||
      `You'll understand ${v2Step.title || "this concept"} and be ready to apply it.`,
  };
}

/**
 * Convert a V2 step with video into a V3 CONTENT_VIDEO step.
 */
function toV3Video(v2Step, chapterNum) {
  // Build keyTakeaways from editorial fields
  const keyTakeaways = [];
  if (v2Step.whatToDo?.length) {
    keyTakeaways.push(...v2Step.whatToDo.slice(0, 4));
  }
  if (v2Step.howToVerify?.length) {
    keyTakeaways.push(...v2Step.howToVerify.slice(0, 2));
  }
  if (keyTakeaways.length === 0 && v2Step.takeaway) {
    keyTakeaways.push(v2Step.takeaway);
  }

  return {
    id: nextStepId(chapterNum),
    type: "CONTENT_VIDEO",
    title: v2Step.video?.title || v2Step.title || "Video",
    videoUrl: v2Step.video?.url || v2Step.video?.video_url || "",
    whyThisMatters: v2Step.whyThisMatters || "",
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : [v2Step.summary || "Watch and follow along"],
  };
}

/**
 * Convert a V2 step without video into a V3 CONTENT_DOC step.
 */
function toV3Doc(v2Step, chapterNum) {
  return {
    id: nextStepId(chapterNum),
    type: "CONTENT_DOC",
    title: v2Step.title || "Documentation",
    content: v2Step.summary || v2Step.whyThisMatters || "",
    whyThisMatters: v2Step.whyThisMatters || "",
    keyTakeaways: v2Step.whatToDo?.length ? v2Step.whatToDo : [v2Step.takeaway || ""],
    links: (v2Step.goDeeper || []).map((link) => ({
      label: link.label || "Learn more",
      url: link.url || "",
    })),
  };
}

/**
 * Generate a V3 QUIZ step from the V2 section.
 * Uses existing quizService data if available, or creates placeholder.
 */
function toV3Quiz(v2Section, chapterNum, quizData = null) {
  const questions = [];

  if (quizData?.questions?.length) {
    // Use pre-generated quiz data
    for (const q of quizData.questions) {
      questions.push({
        text: q.text || q.question || "",
        options: q.options || q.choices || [],
        correctIndex: q.correctIndex ?? q.correctAnswer ?? 0,
        explanation: q.explanation || q.feedback || "",
      });
    }
  } else {
    // Generate placeholder quiz from section steps
    for (const step of (v2Section.steps || []).slice(0, 3)) {
      if (step.title && step.whyThisMatters) {
        questions.push({
          text: `What is the primary purpose of ${step.title}?`,
          options: [
            step.whyThisMatters,
            "It is optional and not needed for most projects",
            "It only works in earlier versions of Unreal Engine",
            "It is a deprecated feature being replaced",
          ],
          correctIndex: 0,
          explanation: step.takeaway || step.whyThisMatters,
        });
      }
    }
  }

  // Only include quiz if we have questions
  if (questions.length === 0) return null;

  return {
    id: nextStepId(chapterNum),
    type: "QUIZ",
    questions,
  };
}
/**
 * Generate a V3 QUIZ step from V2 quiz data.
 */
function toV3QuizStep(v2Step, chapterNum) {
  const quiz = v2Step.quiz;
  if (!quiz || !quiz.questions || quiz.questions.length === 0) return null;

  return {
    id: nextStepId(chapterNum),
    type: "QUIZ",
    title: v2Step.title || "Lesson Quiz",
    questions: quiz.questions.map(q => ({
      text: q.text || q.question || "",
      options: q.options || q.choices || [],
      correctIndex: q.correctIndex ?? q.correctAnswer ?? 0,
      explanation: q.explanation || q.feedback || "",
    })),
  };
}

// ── Main Converter ─────────────────────────────────────────

/**
 * Convert a V2 LearningPath into a single V3 course object.
 *
 * @param {Object} v2Path — V2 LearningPath (from createV2Path)
 * @param {Object} [options]
 * @param {Object} [options.quizzes] — Map of sectionId → quiz data
 * @returns {Object} V3 course object (for COURSE_LIBRARY[])
 */
export function convertV2ToV3(v2Path, { quizzes = {} } = {}) {
  resetCounters();

  // Build course-level metadata
  const course = {
    id: `path-${slugify(v2Path.title || "untitled")}`,
    title: v2Path.title || v2Path.learnerGoal || "Untitled Course",
    metadata: {
      skillLevel: mapDifficulty(v2Path.difficulty),
      estimatedHours: calcEstimatedHours(v2Path),
      industryFocus: "Games",
      engineVersion: "5.5",
      tags: extractTags(v2Path),
      description: v2Path.learnerGoal || "",
    },
    chapters: [],
  };

  // Convert each V2 section → V3 chapter
  for (const section of v2Path.sections || []) {
    const chapterId = nextChapterId();
    const chapterNum = _chapterCounter;
    _stepCounter = 0; // Reset step counter per chapter

    const chapter = {
      id: chapterId,
      number: chapterNum,
      title: section.title || SECTION_LABELS[section.phase] || `Module ${chapterNum}`,
      description: section.purpose || section.description || "",
      steps: [],
    };

    for (const step of section.steps || []) {
      // 1. Always start with an AI_TRANSITION introducing the step
      // (Unless it's a quiz, which often serves as its own transition)
      if (step.lessonType !== "Quiz") {
        chapter.steps.push(toV3Transition(step, chapterNum));
      }

      // 2. Add content step based on lessonType
      if (step.lessonType === "Quiz") {
        const quizStep = toV3QuizStep(step, chapterNum);
        if (quizStep) chapter.steps.push(quizStep);
      } else if (step.video?.url || step.video?.video_url || step.lessonType === "Video") {
        chapter.steps.push(toV3Video(step, chapterNum));
      } else {
        chapter.steps.push(toV3Doc(step, chapterNum));
      }
    }

    // 3. Add section-level quiz if present in options (legacy support)
    const sectionQuiz = toV3Quiz(section, chapterNum, quizzes[section.id]);
    if (sectionQuiz) {
      chapter.steps.push(sectionQuiz);
    }

    course.chapters.push(chapter);
  }

  return course;
}

/**
 * Convert a V2 path into a full COURSE_LIBRARY array (single course).
 * Ready to be injected into the V3 viewer.
 */
export function convertV2ToV3Package(v2Path, options = {}) {
  const course = convertV2ToV3(v2Path, options);
  return [course];
}

// ── Utilities ──────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Generate a standalone data.js file string for the V3 viewer.
 * Can be written directly to public/viewer-v3/data.js
 */
export function renderV3DataFile(courseLibrary) {
  const json = JSON.stringify(courseLibrary, null, 2);
  return `// ============================================================
// Course Library — Generated by V3 Export Pipeline
// Generated: ${new Date().toISOString()}
// ============================================================

const COURSE_LIBRARY = ${json};
`;
}

export default {
  convertV2ToV3,
  convertV2ToV3Package,
  renderV3DataFile,
};
