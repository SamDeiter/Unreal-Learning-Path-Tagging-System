import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { retryWithBackoff } from "../utils/retryWithBackoff";

/**
 * Generate a 5-module course outline for a given topic suggestion.
 * Uses Firebase Cloud Functions to proxy Gemini API calls securely.
 */
export async function generateCourseOutline(suggestion, painPoints = [], trendingQuestions = []) {
  const app = getFirebaseApp();
  if (!app) {
    throw new Error("Firebase not initialized. Cannot generate course outline.");
  }

  const functions = getFunctions(app, "us-central1");
  const generateMetadata = httpsCallable(functions, "generateCourseMetadata");

  const systemPrompt = `
You are an expert Unreal Engine 5 curriculum designer and technical instructor.
Your goal is to generate a comprehensive, highly marketable 5-module course outline for the following topic:

Topic: "${suggestion.topic}"
Category: "${suggestion.category}"
Target Audience: Intermediate to Advanced UE5 Developers
Format: 5 distinct conceptual modules
`;

  const userPrompt = `
Context from the community:
- Pain Points: ${painPoints.length > 0 ? painPoints.map((p) => p.issue || p.painPoint).join(" | ") : "None specifically identified."}
- Trending Questions: ${trendingQuestions.length > 0 ? trendingQuestions.map((q) => q.question).join(" | ") : "None specifically identified."}

Structure the output in pure HTML format ONLY. Do NOT use any Markdown formatting (no **, *, or #).
Use <h3> for Module titles, <ul> and <li> for bullet points, and <strong> for emphasis. Do not wrap the response in markdown code blocks.
Each module should have:
- A clear, engaging title (e.g., "<h3>Module 1: The Foundation of [Topic]</h3>")
- 3-4 bullet points (<li>) describing the specific technical concepts that will be taught.
- A final bullet point explaining how it addresses the community's known pain points (e.g., "<li><strong>Addresses Pain Point:</strong> ...</li>").

Keep the output professional, technically accurate for Unreal Engine 5, and directly actionable for a course creator. Do not include any generic conversational filler. Just output the raw HTML.
`;

  try {
    const result = await retryWithBackoff(
      () =>
        generateMetadata({
          systemPrompt,
          userPrompt,
          temperature: 0.7,
          model: "gemini-2.5-flash",
        }),
      { maxRetries: 2, label: "generateCourseOutline" }
    );

    if (!result.data.success) {
      throw new Error(result.data.error || "Failed to generate course outline");
    }

    return result.data.textResponse;
  } catch (error) {
    console.error("Error generating course outline:", error);
    throw new Error("Failed to generate course outline from AI service.");
  }
}
