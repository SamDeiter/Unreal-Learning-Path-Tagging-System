/**
 * Gemini AI Service for Course Generation (Secure Cloud Function Version)
 *
 * Uses Firebase Cloud Functions to proxy Gemini API calls.
 * API key stored securely in Firebase Secrets - never exposed to client.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase config - uses same project as main app
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase (or get existing app)
import { getApps } from "firebase/app";

let app;
const existingApps = getApps();
const pathBuilderApp = existingApps.find((a) => a.name === "path-builder");

if (pathBuilderApp) {
  app = pathBuilderApp;
} else {
  app = initializeApp(firebaseConfig, "path-builder");
}

const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");

/**
 * Check if user is authenticated
 */
export function isUserAuthenticated() {
  return !!auth.currentUser;
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
   Tags: ${(v.tags || v.extracted_tags || []).join(", ") || "None"}
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
    console.warn("User not authenticated. Using fallback generation.");
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
    console.warn("User not authenticated. Using fallback quiz.");
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
 * Fallback metadata generation without API
 */
function generateFallbackMetadata(videos) {
  const allTags = videos.flatMap((v) => v.tags || v.extracted_tags || []);
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
  isGeminiConfigured,
  isUserAuthenticated,
};
