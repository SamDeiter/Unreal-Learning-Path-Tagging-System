/**
 * studyGuideGenerator.js — AI Study Guide & Quiz Generator
 *
 * Generates structured study materials from course content:
 *   - Topic summaries organized by Bloom's Taxonomy level
 *   - Key concept flashcards
 *   - Practice quizzes with explanations
 *   - Learning objectives aligned to the path
 *
 * Uses Gemini API via Cloud Function proxy.
 */

import { classifySegment, getBloomBadge } from "./bloomClassifier";

// ── Constants ──────────────────────────────────────────────────────

const CLOUD_FUNCTION_BASE = "/api/study-guide";

// ── Study Guide Generation ─────────────────────────────────────────

/**
 * Generate a study guide from course content.
 *
 * @param {Array} courses — Courses in the learning path
 * @param {Object} [opts] — Options
 * @param {string} [opts.skillLevel="Intermediate"] — Target skill level
 * @param {string} [opts.topic] — Focus topic (optional)
 * @returns {Promise<StudyGuide>}
 */
export async function generateStudyGuide(courses, opts = {}) {
  const { skillLevel = "Intermediate", topic } = opts;

  // Build content summary for API
  const contentSummary = buildContentSummary(courses);

  const response = await fetch(`${CLOUD_FUNCTION_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courses: contentSummary,
      skillLevel,
      topic: topic || contentSummary.topics[0] || "General",
    }),
  });

  if (!response.ok) {
    throw new Error(`Study guide generation failed: ${await response.text()}`);
  }

  const guide = await response.json();
  return enrichGuideWithBloom(guide);
}

/**
 * Build a content summary for the API request.
 * Extracts titles, topics, summaries, and learning outcomes.
 *
 * @param {Array} courses — Course objects
 * @returns {{ courses: Array, topics: string[], totalDuration: number }}
 */
export function buildContentSummary(courses) {
  const topics = new Set();

  const courseSummaries = courses.map((c) => {
    const topic = c.tags?.topic || "General";
    topics.add(topic);

    return {
      code: c.code,
      title: c.title || "Untitled",
      topic,
      level: c.tags?.level || "Intermediate",
      summary: c.gemini_enriched?.one_sentence_summary || "",
      outcomes: c.gemini_enriched?.learning_outcomes || [],
      videoCount: c.videos?.length || 0,
    };
  });

  const totalDuration = courses.reduce((sum, c) => sum + (c.duration || 0), 0);

  return {
    courses: courseSummaries,
    topics: [...topics],
    totalDuration: Math.round(totalDuration * 10) / 10,
  };
}

/**
 * Enrich study guide sections with Bloom's Taxonomy badges.
 *
 * @param {Object} guide — Raw study guide from API
 * @returns {Object} — Enriched guide with bloom metadata
 */
export function enrichGuideWithBloom(guide) {
  if (!guide.sections) return guide;

  const enrichedSections = guide.sections.map((section) => {
    const bloom = classifySegment(section.heading || "", section.content || "");
    const badge = getBloomBadge(bloom.level);

    return {
      ...section,
      bloom: {
        level: bloom.level,
        confidence: bloom.confidence,
        ...badge,
      },
    };
  });

  return { ...guide, sections: enrichedSections };
}

// ── Flashcard Generation ───────────────────────────────────────────

/**
 * Generate flashcards from course learning outcomes.
 * Client-side generation (no API needed).
 *
 * @param {Array} courses — Courses with gemini_enriched data
 * @returns {Array<{ front: string, back: string, topic: string, difficulty: string }>}
 */
export function generateFlashcards(courses) {
  const cards = [];

  courses.forEach((course) => {
    const topic = course.tags?.topic || "General";
    const level = course.tags?.level || "Intermediate";

    // From learning outcomes
    const outcomes = course.gemini_enriched?.learning_outcomes || [];
    outcomes.forEach((outcome) => {
      cards.push({
        front: `What will you learn about: ${outcome}?`,
        back: `From "${course.title}": ${outcome}`,
        topic,
        difficulty: level,
      });
    });

    // From key concepts in summary
    const summary = course.gemini_enriched?.one_sentence_summary;
    if (summary) {
      cards.push({
        front: `Summarize: ${course.title}`,
        back: summary,
        topic,
        difficulty: level,
      });
    }
  });

  return cards;
}

// ── Quiz Generation ────────────────────────────────────────────────

/**
 * Generate quiz questions from course metadata.
 * For deeper questions, use the API endpoint.
 * This is the client-side version using available metadata.
 *
 * @param {Array} courses — Course objects
 * @param {Object} [opts] — Options
 * @param {number} [opts.questionsPerCourse=2] — Questions per course
 * @returns {Array<QuizQuestion>}
 */
export function generateQuickQuiz(courses, opts = {}) {
  const { questionsPerCourse = 2 } = opts;
  const questions = [];

  courses.forEach((course) => {
    const outcomes = course.gemini_enriched?.learning_outcomes || [];
    const tags = course.gemini_enriched?.system_tags || course.extracted_tags || [];

    // Question 1: Topic identification
    if (outcomes.length > 0) {
      questions.push({
        question: `Which learning outcome is covered in "${course.title}"?`,
        options: generateOptions(outcomes[0], outcomes.slice(1), tags),
        correctIndex: 0,
        explanation: `"${course.title}" covers: ${outcomes[0]}`,
        courseCode: course.code,
        bloomLevel: "remember",
      });
    }

    // Question 2: Concept application (if we have enough data)
    if (questionsPerCourse >= 2 && tags.length >= 3) {
      const topic = course.tags?.topic || tags[0];
      questions.push({
        question: `Which concept is most directly related to ${topic}?`,
        options: shuffleArray([tags[0], tags[1], tags[2], "Unrelated Concept"]),
        correctIndex: 0, // Will be wrong after shuffle — fixed below
        explanation: `${tags[0]} is a core concept in ${topic}`,
        courseCode: course.code,
        bloomLevel: "understand",
      });
      // Fix correct index after shuffle
      const lastQ = questions[questions.length - 1];
      lastQ.correctIndex = lastQ.options.indexOf(tags[0]);
    }
  });

  return questions;
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * @private — Generate 4 multiple-choice options with one correct answer.
 */
function generateOptions(correct, pool, fallbackPool) {
  const distractors = [...pool, ...fallbackPool].filter((item) => item !== correct).slice(0, 3);

  while (distractors.length < 3) {
    distractors.push(`Not covered in this course (${distractors.length + 1})`);
  }

  return shuffleArray([correct, ...distractors]);
}

/**
 * @private — Fisher-Yates shuffle.
 */
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
