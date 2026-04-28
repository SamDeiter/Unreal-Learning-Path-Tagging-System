/**
 * roadmapPlanner.js — LLM-powered roadmap planner for goal-first flows.
 *
 * Takes a broad learner goal (e.g., "I want to make a game in UE5")
 * and returns 4-6 structured milestones. Each milestone includes a
 * searchQuery that the frontend uses to call generateBespokePath().
 *
 * Architecture: "LLM plans the roadmap, RAG fills each node."
 */

const { logger } = require("firebase-functions");
const vertex = require("../utils/vertex");

// ── Milestone schema for validation ─────────────────────────────────

const REQUIRED_MILESTONE_FIELDS = [
  "phase",
  "title",
  "learnerGoal",
  "rationale",
  "searchQuery",
  "completionCheck",
  "difficulty",
];

/**
 * Validate a milestone object has all required fields.
 * @param {object} m - Milestone to validate
 * @returns {boolean}
 */
function isValidMilestone(m) {
  if (!m || typeof m !== "object") return false;
  return REQUIRED_MILESTONE_FIELDS.every(
    (field) => typeof m[field] === "string" && m[field].trim().length > 0
  );
}

// ── Prompt template ─────────────────────────────────────────────────

function buildRoadmapPrompt(goal, persona) {
  const personaContext = persona
    ? `\nThe learner's persona is "${persona}". Bias toward their workflow preferences.`
    : "";

  return `You are a senior Unreal Engine 5 curriculum designer.

A learner has expressed this goal:
"${goal}"
${personaContext}

Create a learning roadmap of 4 to 6 milestones that progressively build toward this goal.

RULES:
- Each milestone must be a focused, achievable mini-goal (not a giant topic dump)
- Order milestones from foundational to advanced
- Each milestone's searchQuery must be a specific UE5 search query suitable for finding tutorial content (10-20 words, mention UE5)
- difficulty must be one of: "beginner", "intermediate", "advanced"
- For complete beginners, always start with editor basics / project creation
- For game-making goals, use a Blueprint-first approach
- Keep scope realistic — each milestone should take 30-90 minutes

Return ONLY a JSON array of milestone objects. No markdown, no explanation.

Each milestone object must have exactly these fields:
{
  "phase": "short phase label like 'Start Here' or 'First Playable'",
  "title": "human-readable milestone title",
  "learnerGoal": "what the learner will be able to do after this milestone",
  "rationale": "why this milestone comes at this point in the sequence",
  "searchQuery": "specific UE5 search query for finding content (mention UE5 explicitly)",
  "completionCheck": "how the learner knows they completed this milestone",
  "difficulty": "beginner | intermediate | advanced"
}`;
}

// ── Main planner function ───────────────────────────────────────────

/**
 * Generate a learning roadmap from a broad learner goal.
 *
 * @param {string} goal - The learner's broad goal
 * @param {string} [_apiKey] - Ignored; ADC is used. Kept for call-site stability.
 * @param {object} [options]
 * @param {string} [options.persona] - Optional persona ID for bias
 * @returns {Promise<{milestones: object[], title: string, learnerLevel: string}>}
 */
async function generateRoadmap(goal, _apiKey, options = {}) {
  const { persona } = options;

  const prompt = buildRoadmapPrompt(goal, persona);

  logger.info(JSON.stringify({
    severity: "INFO",
    message: "roadmap_planner_start",
    goal,
    persona: persona || "none",
  }));

  const resp = await vertex.generateContent("gemini-2.5-flash", {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`roadmap_planner_vertex_${resp.status}: ${errBody.slice(0, 200)}`);
  }
  const body = await resp.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON — handle potential markdown fences
  let milestones;
  try {
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    milestones = JSON.parse(cleaned);
  } catch (parseErr) {
    logger.error(JSON.stringify({
      severity: "ERROR",
      message: "roadmap_planner_parse_error",
      error: parseErr.message,
      raw: text.substring(0, 500),
    }));
    throw new Error("Failed to parse roadmap planner output");
  }

  // Validate array
  if (!Array.isArray(milestones) || milestones.length < 2) {
    throw new Error(`Roadmap planner returned invalid data (got ${typeof milestones})`);
  }

  // Validate each milestone and filter invalid ones
  const valid = milestones.filter(isValidMilestone);
  if (valid.length < 2) {
    throw new Error(`Only ${valid.length} valid milestones out of ${milestones.length}`);
  }

  // Cap at 6
  const capped = valid.slice(0, 6);

  // Infer a title and level
  const title = inferRoadmapTitle(goal);
  const learnerLevel = inferLearnerLevel(capped);

  logger.info(JSON.stringify({
    severity: "INFO",
    message: "roadmap_planner_complete",
    milestoneCount: capped.length,
    title,
    learnerLevel,
  }));

  return { milestones: capped, title, learnerLevel };
}

// ── Helper functions ────────────────────────────────────────────────

function inferRoadmapTitle(goal) {
  const goalLower = goal.toLowerCase();
  if (goalLower.includes("game")) return "Your First Playable UE5 Game";
  if (goalLower.includes("animation") || goalLower.includes("animate")) return "UE5 Animation Fundamentals";
  if (goalLower.includes("material") || goalLower.includes("shader")) return "UE5 Materials & Shaders";
  if (goalLower.includes("landscape") || goalLower.includes("environment")) return "UE5 Environment & Landscape";
  if (goalLower.includes("multiplayer") || goalLower.includes("networking")) return "UE5 Multiplayer Basics";
  if (goalLower.includes("blueprint")) return "UE5 Blueprint Mastery";
  if (goalLower.includes("c++")) return "UE5 C++ Fundamentals";
  return `UE5 Learning Roadmap: ${goal.substring(0, 50)}`;
}

function inferLearnerLevel(milestones) {
  const difficulties = milestones.map((m) => m.difficulty);
  if (difficulties.every((d) => d === "beginner")) return "beginner";
  if (difficulties.some((d) => d === "advanced")) return "intermediate-advanced";
  return "beginner-intermediate";
}

module.exports = {
  generateRoadmap,
  isValidMilestone,
  buildRoadmapPrompt,
  REQUIRED_MILESTONE_FIELDS,
};
