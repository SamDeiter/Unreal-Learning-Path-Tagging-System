import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize the API only if the key exists
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function generateCourseOutline(suggestion, painPoints = [], trendingQuestions = []) {
  if (!genAI) {
    throw new Error("VITE_GEMINI_API_KEY is not configured in .env");
  }

  // Use Gemini 2.5 Flash for fast, conversational generation
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are an expert Unreal Engine 5 curriculum designer and technical instructor.
Your goal is to generate a comprehensive, highly marketable 5-module course outline for the following topic:

Topic: "${suggestion.topic}"
Category: "${suggestion.category}"
Target Audience: Intermediate to Advanced UE5 Developers
Format: 5 distinct conceptual modules

Context from the community:
- Pain Points: ${painPoints.length > 0 ? painPoints.map(p => p.issue).join(" | ") : "None specifically identified."}
- Trending Questions: ${trendingQuestions.length > 0 ? trendingQuestions.map(q => q.question).join(" | ") : "None specifically identified."}

Structure the output in pure HTML format ONLY. Do NOT use any Markdown formatting (no **, *, or #).
Use <h3> for Module titles, <ul> and <li> for bullet points, and <strong> for emphasis. Do not wrap the response in markdown code blocks.
Each module should have:
- A clear, engaging title (e.g., "<h3>Module 1: The Foundation of [Topic]</h3>")
- 3-4 bullet points (<li>) describing the specific technical concepts that will be taught.
- A final bullet point explaining how it addresses the community's known pain points (e.g., "<li><strong>Addresses Pain Point:</strong> ...</li>").

Keep the output professional, technically accurate for Unreal Engine 5, and directly actionable for a course creator. Do not include any generic conversational filler. Just output the raw HTML.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating course outline:", error);
    throw new Error("Failed to generate course outline from Gemini API.");
  }
}
