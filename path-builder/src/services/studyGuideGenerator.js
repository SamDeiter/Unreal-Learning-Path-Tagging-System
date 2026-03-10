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

    // Build a useful summary from whatever data is available
    const summary =
      c.gemini_enriched?.one_sentence_summary ||
      c.description ||
      `${c.tags?.level || "Intermediate"} course on ${topic} using ${c.tags?.product || "Unreal Engine"}`;

    // Build outcomes from gemini data, ai_tags, or canonical_tags
    let outcomes = c.gemini_enriched?.learning_outcomes || [];
    if (outcomes.length === 0) {
      const tags = c.ai_tags || c.canonical_tags || [];
      outcomes = tags.slice(0, 3).map((t) => {
        const label = typeof t === "string" ? t.replace(/[._]/g, " ") : String(t);
        return `Understand ${label} concepts in ${topic}`;
      });
    }

    return {
      code: c.code,
      title: c.title || "Untitled",
      topic,
      level: c.tags?.level || "Intermediate",
      summary,
      outcomes,
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
    const product = course.tags?.product || "Unreal Engine";

    // From learning outcomes (gemini or generated from tags)
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

    // Fallback: generate cards from ai_tags or canonical_tags
    if (outcomes.length === 0 && !summary) {
      const allTags = [
        ...(course.ai_tags || []),
        ...(course.canonical_tags || []).map((t) => t.split(".").pop()),
      ];
      const uniqueTags = [...new Set(allTags)].filter((t) => t && t.length > 2 && t !== "level");

      // Card: what topic does this course cover?
      cards.push({
        front: `What is the main topic of "${course.title}"?`,
        back: `${topic} — a ${level} course on ${product}`,
        topic,
        difficulty: level,
      });

      // Cards from tag keywords
      uniqueTags.slice(0, 3).forEach((tag) => {
        const label = tag.replace(/[._-]/g, " ");
        cards.push({
          front: `In the context of ${topic}, what is ${label}?`,
          back: `${label} is a key concept covered in "${course.title}" (${level})`,
          topic,
          difficulty: level,
        });
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
    // Fall back to ai_tags / canonical_tags when system_tags are missing
    let tags = course.gemini_enriched?.system_tags || course.extracted_tags || [];
    if (tags.length === 0) {
      tags = [
        ...(course.ai_tags || []),
        ...(course.canonical_tags || []).map((t) => t.split(".").pop()),
      ].filter((t) => t && t.length > 2 && t !== "level");
      tags = [...new Set(tags)];
    }

    const topic = course.tags?.topic || "General";
    const level = course.tags?.level || "Intermediate";

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
    } else if (tags.length >= 2) {
      // Fallback Q1: identify the course topic
      const correct = topic;
      const distractors = ["Animation", "Networking", "Audio Design", "AI Navigation", "Physics"]
        .filter((d) => d !== correct)
        .slice(0, 3);
      const opts = shuffleArray([correct, ...distractors]);
      questions.push({
        question: `What is the primary topic of "${course.title}"?`,
        options: opts,
        correctIndex: opts.indexOf(correct),
        explanation: `"${course.title}" is a ${level} course covering ${topic}`,
        courseCode: course.code,
        bloomLevel: "remember",
      });
    }

    // Question 2: Concept application
    if (questionsPerCourse >= 2 && tags.length >= 3) {
      const correctTag = tags[0].replace(/[._-]/g, " ");
      const distractorTags = tags.slice(1, 3).map((t) => t.replace(/[._-]/g, " "));
      const options = shuffleArray([correctTag, ...distractorTags, "Unrelated Concept"]);
      questions.push({
        question: `Which concept is most directly related to ${topic}?`,
        options,
        correctIndex: options.indexOf(correctTag),
        explanation: `${correctTag} is a core concept in ${topic}`,
        courseCode: course.code,
        bloomLevel: "understand",
      });
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
