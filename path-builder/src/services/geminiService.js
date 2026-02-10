/**
 * Gemini AI Service for Course Generation (Secure Cloud Function Version)
 *
 * Uses Firebase Cloud Functions to proxy Gemini API calls.
 * API key stored securely in Firebase Secrets - never exposed to client.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { getFirebaseApp, firebaseConfig } from "./firebaseConfig";
import { devWarn } from "../utils/logger";

/** Safely extract tags as an array. c.tags may be an object {topic, level} not an array. */
function getTagsArray(item) {
  if (Array.isArray(item?.tags)) return item.tags;
  if (Array.isArray(item?.extracted_tags)) return item.extracted_tags;
  return [];
}

// Lazy initialization - only initialize when needed and API key is present
let app = null;
let auth = null;
let functions = null;

function initFirebase() {
  if (app) return true;

  // Check if API key is configured
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "undefined") {
    devWarn("Firebase API key not configured. Gemini AI features disabled.");
    return false;
  }

  try {
    app = getFirebaseApp();

    auth = getAuth(app);
    functions = getFunctions(app, "us-central1");
    return true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export function isUserAuthenticated() {
  if (!initFirebase()) return false;
  return !!auth?.currentUser;
}

/**
 * Generate course metadata from selected videos via Cloud Function
 * @param {Array} videos - Selected video objects with transcripts
 * @returns {Object} Generated course metadata
 */
export async function generateCourseMetadata(videos) {
  // Prepare video summaries for prompt
  const videoSummaries = videos
    .map((v, i) => {
      const transcript = v.transcript?.substring(0, 500) || "No transcript available";
      return `${i + 1}. "${v.title || v.name}" (${v.duration_formatted || "Unknown duration"})
   Tags: ${getTagsArray(v).join(", ") || "None"}
   Preview: ${transcript}...`;
    })
    .join("\n\n");

  const systemPrompt = `You are an instructional designer creating SCORM-compliant courses from UE5 training videos. 
Generate concise, professional course metadata in JSON format.`;

  const userPrompt = `Given these ${videos.length} videos:

${videoSummaries}

Generate a JSON response with:
1. "title": A compelling course title (max 60 chars)
2. "description": A 2-3 sentence course description for an LMS
3. "learningObjectives": Array of 3-5 specific, measurable learning objectives
4. "suggestedOrder": Array of video indices in optimal learning sequence (1-based)
5. "difficulty": "beginner" | "intermediate" | "advanced"
6. "estimatedHours": Total estimated learning time
7. "prerequisites": Array of prerequisite skills/knowledge

Respond with ONLY valid JSON, no markdown.`;

  // Check auth and call Cloud Function
  if (!isUserAuthenticated()) {
    devWarn("User not authenticated. Using fallback generation.");
    return generateFallbackMetadata(videos);
  }

  try {
    const generateCourse = httpsCallable(functions, "generateCourseMetadata");
    const result = await generateCourse({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      model: "gemini-1.5-flash",
    });

    if (!result.data.success) {
      throw new Error(result.data.error || "Cloud Function failed");
    }

    // Parse JSON from response
    const text = result.data.textResponse;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON found in response");
  } catch (error) {
    console.error("Gemini Cloud Function error:", error);
    return generateFallbackMetadata(videos);
  }
}

/**
 * Generate quiz questions from video transcript via Cloud Function
 * @param {Object} video - Video object with transcript
 * @returns {Array} Generated quiz questions
 */
export async function generateQuizQuestions(video, count = 3) {
  if (!video.transcript) {
    return generateFallbackQuiz(video, count);
  }

  const systemPrompt = `You are an instructional designer creating assessment questions for UE5 training videos.
Generate multiple choice quiz questions to test comprehension.`;

  const userPrompt = `Based on this UE5 training video transcript, generate ${count} multiple choice quiz questions.

Video: "${video.title || video.name}"
Transcript excerpt: ${video.transcript.substring(0, 2000)}

Generate a JSON array with questions, each having:
- "question": The question text
- "options": Array of 4 answer options
- "correctIndex": Index of correct answer (0-3)
- "explanation": Brief explanation of correct answer

Respond with ONLY valid JSON array, no markdown.`;

  if (!isUserAuthenticated()) {
    devWarn("User not authenticated. Using fallback quiz.");
    return generateFallbackQuiz(video, count);
  }

  try {
    const generateQuiz = httpsCallable(functions, "generateCourseMetadata");
    const result = await generateQuiz({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      model: "gemini-1.5-flash",
    });

    if (!result.data.success) {
      throw new Error(result.data.error || "Quiz generation failed");
    }

    const text = result.data.textResponse;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON array found");
  } catch (error) {
    console.error("Quiz generation error:", error);
    return generateFallbackQuiz(video, count);
  }
}

/**
 * Generate Learning Blueprint (outline, objectives, goals) via Gemini
 * @param {Object} intent - User's learning intent (goal, skill level, time budget)
 * @param {Array} courses - Selected courses with metadata and tags
 * @returns {Object} Generated blueprint with outline, objectives, goals
 */
export async function generateLearningBlueprint(intent, courses) {
  if (!courses || courses.length === 0) {
    return generateFallbackBlueprint(intent, courses);
  }

  // Prepare course summaries for prompt
  const courseSummaries = courses
    .map((c, i) => {
      const tags = getTagsArray(c).slice(0, 5).join(", ");
      const role = c.role || "Core";
      return `${i + 1}. "${c.title}" [${role}] - Tags: ${tags || "General UE5"}`;
    })
    .join("\n");

  const systemPrompt = `You are an expert instructional designer specializing in Unreal Engine 5 training.
Create specific, actionable learning blueprints that are relevant to the actual course content.
Avoid generic phrases like "Master concepts in X" - be specific about WHAT skills will be learned.`;

  const userPrompt = `Create a Learning Blueprint for this learning path:

**Learning Intent:**
- Primary Goal: ${intent.primaryGoal || "UE5 Development"}
- Skill Level: ${intent.skillLevel || "Intermediate"}
- Time Available: ${intent.timeBudget || "Flexible"}

**Selected Courses (${courses.length} total):**
${courseSummaries}

Generate a JSON response with:

1. "outline": Array of section objects, each with:
   - "title": Section title (e.g., "Foundational Prerequisites", "Core Curriculum: Niagara VFX")
   - "items": Array of specific learning activities (NOT just course titles!)
     Each item has: "text" (specific skill/activity), "courseIndex" (1-based)

2. "objectives": Array of 4-6 MEASURABLE learning objectives using Bloom's taxonomy verbs
   Each has: "text" (specific, measurable objective)

3. "goals": Array of 3 outcome goals with:
   - "text": Concrete achievement statement
   - "metric": How to measure completion

Be SPECIFIC to the actual tags and content. Reference real UE5 concepts like Niagara, Blueprints, Materials, etc.

Respond with ONLY valid JSON, no markdown.`;

  if (!isUserAuthenticated()) {
    devWarn("User not authenticated. Using fallback blueprint.");
    return generateFallbackBlueprint(intent, courses);
  }

  try {
    const generateBlueprint = httpsCallable(functions, "generateCourseMetadata");
    const result = await generateBlueprint({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      model: "gemini-1.5-flash",
    });

    if (!result.data.success) {
      throw new Error(result.data.error || "Blueprint generation failed");
    }

    const text = result.data.textResponse;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON found in response");
  } catch (error) {
    console.error("Learning Blueprint generation error:", error);
    return generateFallbackBlueprint(intent, courses);
  }
}

/**
 * Fallback blueprint generation without API
 */
function generateFallbackBlueprint(intent, courses) {
  const allTags = courses.flatMap((c) => getTagsArray(c));
  const topTags = [...new Set(allTags)].slice(0, 5);
  const primaryTag = topTags[0] || "UE5";

  return {
    outline: [
      {
        title: "Core Curriculum: " + (intent.primaryGoal || primaryTag),
        items: courses.slice(0, 5).map((c, i) => ({
          text: `Learn ${getTagsArray(c)[0] || "core"} techniques from ${c.title?.split(" ")[0] || "lesson"}`,
          courseIndex: i + 1,
        })),
      },
    ],
    objectives: [
      { text: `Apply ${primaryTag} techniques in project workflows` },
      { text: `Troubleshoot common ${primaryTag} issues independently` },
      { text: `Implement ${primaryTag} best practices in production` },
    ],
    goals: [
      {
        text: `Build proficiency in ${topTags.slice(0, 3).join(", ")}`,
        metric: `Complete ${courses.length} modules`,
      },
      { text: "Create a portfolio piece", metric: "Finished project using skills" },
      { text: "Apply skills in real work", metric: "Use in production project" },
    ],
  };
}

/**
 * Fallback metadata generation without API
 */
function generateFallbackMetadata(videos) {
  const allTags = videos.flatMap((v) => getTagsArray(v));
  const topTags = [...new Set(allTags)].slice(0, 5);

  const totalSeconds = videos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
  const hours = Math.ceil(totalSeconds / 3600);

  return {
    title: `UE5 ${topTags[0] || "Training"} Course`,
    description: `A comprehensive course covering ${topTags.slice(0, 3).join(", ")} in Unreal Engine 5. Includes ${videos.length} video lessons.`,
    learningObjectives: [
      `Understand core ${topTags[0] || "UE5"} concepts`,
      `Apply techniques in practical projects`,
      `Build efficient workflows`,
    ],
    suggestedOrder: videos.map((_, i) => i + 1),
    difficulty: videos.length > 10 ? "intermediate" : "beginner",
    estimatedHours: hours,
    prerequisites: ["Basic Unreal Engine 5 knowledge"],
  };
}

/**
 * Fallback quiz generation without API
 */
function generateFallbackQuiz(video, count) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    questions.push({
      question: `What is the main topic covered in "${video.title || video.name}"?`,
      options: ["Basic concepts", "Advanced techniques", "Best practices", "Workflow optimization"],
      correctIndex: 0,
      explanation: "Review the video for detailed information.",
    });
  }
  return questions;
}

/**
 * Check if Cloud Functions are configured
 */
export function isGeminiConfigured() {
  return !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
}

export default {
  generateCourseMetadata,
  generateQuizQuestions,
  generateLearningBlueprint,
  isGeminiConfigured,
  isUserAuthenticated,
};
