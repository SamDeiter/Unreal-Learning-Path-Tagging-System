/**
 * videoBriefService.js — Video Brief Generator
 *
 * Given a V2 learning path, generates structured recording briefs
 * that tell instructors exactly what to demonstrate, say, and cover.
 *
 * Pipeline:
 *   V2 Path → Per-step brief generation → Batch export as Markdown
 *
 * Plugs into:
 *   - editorialPass.js (whyThisMatters, whatToDo, etc.)
 *   - gapDetection.js (identifies missing content)
 *   - coverageAnalyzer.js (existing video coverage)
 *   - demandIntelligenceService (demand signals for prioritization)
 *
 * Exports:
 *   - generateVideoBrief(step, context) — single step → brief
 *   - generateCourseBriefPackage(v2Path) — full path → downloadable markdown
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { recordTokenUsage } from "./tokenTracker";
import { devLog, devWarn } from "../utils/logger";
import { parseGeminiJSON } from "./gapDetection";

// ── Configuration ──────────────────────────────────────────

const BATCH_SIZE = 3;  // Steps per AI call to avoid timeouts
const BRIEF_CACHE = new Map();

// ── Skill Level Inference ──────────────────────────────────

function inferSkillLevel(step) {
  const title = (step.title || "").toLowerCase();
  const summary = (step.summary || "").toLowerCase();
  const combined = `${title} ${summary}`;

  if (combined.includes("advanced") || combined.includes("optimization") ||
      combined.includes("subsystem") || combined.includes("c++")) {
    return "Advanced";
  }
  if (combined.includes("beginner") || combined.includes("introduction") ||
      combined.includes("getting started") || combined.includes("basics")) {
    return "Beginner";
  }
  return "Intermediate";
}

// ── Target Length Estimation ────────────────────────────────

function estimateTargetLength(step) {
  const hasVideo = !!step.video;
  const howMany = (step.whatToDo || []).length;
  const complexity = inferSkillLevel(step);

  if (hasVideo && step.video?.durationSeconds) {
    const mins = Math.ceil(step.video.durationSeconds / 60);
    return `${mins}-${mins + 3} minutes (based on existing video)`;
  }

  // Estimate based on action count and complexity
  const base = complexity === "Advanced" ? 10 : complexity === "Beginner" ? 5 : 7;
  const perAction = 2;
  const est = base + howMany * perAction;
  return `${est}-${est + 4} minutes`;
}

// ── Single Step Brief Generation ───────────────────────────

/**
 * Generate a structured recording brief for a single V2 step.
 *
 * @param {Object} step — V2 path step (with editorial enrichment)
 * @param {Object} context — Course-level context
 * @param {string} context.pathTitle — Overall learning path title
 * @param {string} context.learnerGoal — What the learner wants to achieve
 * @param {number} context.stepIndex — Position in the path
 * @param {number} context.totalSteps — Total steps in the path
 * @param {string} context.chapterTitle — Chapter this step belongs to
 * @returns {Promise<Object>} Structured video brief
 */
export async function generateVideoBrief(step, context = {}) {
  const cacheKey = `${step.title || ""}_${context.stepIndex || 0}`;
  if (BRIEF_CACHE.has(cacheKey)) return BRIEF_CACHE.get(cacheKey);

  const skillLevel = inferSkillLevel(step);
  const targetLength = estimateTargetLength(step);

  // Build base brief from existing step data (no AI needed)
  const baseBrief = {
    chapterTitle: context.chapterTitle || step.title || "Untitled",
    stepTitle: step.title || "Untitled Step",
    targetLength,
    skillLevel,
    position: `Step ${(context.stepIndex || 0) + 1} of ${context.totalSteps || "?"}`,
    pathTitle: context.pathTitle || "",
    learnerGoal: context.learnerGoal || "",

    // From editorial enrichment
    whyThisMatters: step.whyThisMatters || "",
    whatToDo: step.whatToDo || [],
    commonMistake: step.commonMistake || "",
    takeaway: step.takeaway || "",

    // Existing resources
    existingResources: [],
    requiredDemonstrations: [],
    talkingPoints: [],
    requiredTerminology: [],
    editorSetup: [],
    scriptNotes: "",
  };

  // Add existing video as resource
  if (step.video) {
    baseBrief.existingResources.push({
      type: "video",
      title: step.video.title || step.title,
      url: step.video.url || "",
      duration: step.video.durationSeconds
        ? `${Math.ceil(step.video.durationSeconds / 60)}min`
        : "unknown",
      relevance: 1.0,
    });
  }

  // Add goDeeper links as resources
  if (step.goDeeper?.length) {
    for (const link of step.goDeeper) {
      baseBrief.existingResources.push({
        type: link.type || "docs",
        title: link.label || "",
        url: link.url || "",
        relevance: 0.7,
      });
    }
  }

  // ── AI Enrichment: generate demonstrations, talking points, terminology ──

  try {
    const prompt = buildBriefPrompt(step, context, skillLevel);

    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const classifyFn = httpsCallable(functions, "classifySegments");

    const result = await retryWithBackoff(
      () => classifyFn({ prompt }),
      { maxRetries: 1, baseDelayMs: 2000, label: "videoBrief" }
    );

    const responseText = result.data?.text || "";
    recordTokenUsage(
      "videoBrief",
      Math.ceil(prompt.length / 4),
      Math.ceil(responseText.length / 4)
    );

    const parsed = parseGeminiJSON(responseText);
    if (parsed) {
      baseBrief.requiredDemonstrations = parsed.requiredDemonstrations || baseBrief.requiredDemonstrations;
      baseBrief.talkingPoints = parsed.talkingPoints || baseBrief.talkingPoints;
      baseBrief.requiredTerminology = parsed.requiredTerminology || baseBrief.requiredTerminology;
      baseBrief.editorSetup = parsed.editorSetup || baseBrief.editorSetup;
      baseBrief.scriptNotes = parsed.scriptNotes || baseBrief.scriptNotes;
    }
  } catch (err) {
    devWarn("[VideoBrief] AI enrichment failed, using base data:", err.message);
    // Falls back to base brief from editorial pass data
    baseBrief.requiredDemonstrations = inferDemonstrations(step);
    baseBrief.talkingPoints = inferTalkingPoints(step);
    baseBrief.requiredTerminology = inferTerminology(step);
  }

  BRIEF_CACHE.set(cacheKey, baseBrief);
  return baseBrief;
}

// ── AI Prompt Builder ──────────────────────────────────────

function buildBriefPrompt(step, context, skillLevel) {
  const stepSummary = (step.summary || step._bridgeText || "").slice(0, 500);
  const actions = (step.whatToDo || []).join("\n  - ");

  return `You are an Unreal Engine 5 video tutorial producer. Generate a RECORDING BRIEF for an instructor.

CONTEXT:
- Course: "${context.pathTitle || "UE5 Tutorial"}"
- Chapter: "${context.chapterTitle || step.title}"
- Learner Goal: "${context.learnerGoal || "Learn UE5"}"
- Skill Level: ${skillLevel}
- Position: Step ${(context.stepIndex || 0) + 1} of ${context.totalSteps || "?"}

STEP CONTENT:
- Title: "${step.title || ""}"
- Summary: "${stepSummary}"
- Why It Matters: "${step.whyThisMatters || ""}"
- Actions:
  - ${actions || "Not specified"}
- Common Mistake: "${step.commonMistake || ""}"

Generate a JSON object with these RECORDING INSTRUCTIONS:

{
  "requiredDemonstrations": [
    "Specific on-screen actions the instructor MUST show (e.g., 'Open Place Actors panel → drag NavMesh Bounds Volume into viewport')"
  ],
  "talkingPoints": [
    "Key teaching points to verbalize while demonstrating (e.g., 'Explain WHY NavMesh needs to cover the entire playable area')"
  ],
  "requiredTerminology": [
    "UE5 terms the instructor must define or use correctly (e.g., 'NavMesh Bounds Volume')"
  ],
  "editorSetup": [
    "Editor state needed before recording starts (e.g., 'Have a level with at least one AI character placed')"
  ],
  "scriptNotes": "Brief callout for the instructor — pacing tip, common confusion point to address, etc."
}

RULES:
- requiredDemonstrations: 3-6 specific, actionable on-screen steps
- talkingPoints: 2-4 teaching moments (WHY, not just WHAT)
- requiredTerminology: 2-5 UE5-specific terms
- editorSetup: 1-3 items the editor needs before pressing Record
- scriptNotes: 1-2 sentences max
- Be specific to UE5.4/5.5 — use actual menu paths and panel names
- Return valid JSON only, no markdown fences`;
}

// ── Deterministic Fallbacks ────────────────────────────────

function inferDemonstrations(step) {
  const demos = [];
  if (step.whatToDo?.length) {
    for (const action of step.whatToDo.slice(0, 5)) {
      demos.push(`Demonstrate: ${action}`);
    }
  }
  if (step.video?.url) {
    demos.push("Show the referenced video segment as context");
  }
  return demos.length > 0 ? demos : [`Walk through the key concepts of "${step.title || "this topic"}"`];
}

function inferTalkingPoints(step) {
  const points = [];
  if (step.whyThisMatters) points.push(`Explain: ${step.whyThisMatters}`);
  if (step.commonMistake) points.push(`Warn about: ${step.commonMistake}`);
  if (step.takeaway) points.push(`Summarize: ${step.takeaway}`);
  return points.length > 0 ? points : [`Explain why "${step.title}" matters in a real project`];
}

function inferTerminology(step) {
  const terms = [];
  const tags = [...(step.video?.tags || []), ...(step.tags || [])];
  // Use tags as terminology indicators
  for (const tag of tags.slice(0, 5)) {
    if (typeof tag === "string" && tag.length > 2) terms.push(tag);
  }
  return terms;
}

// ── Batch Brief Package ────────────────────────────────────

/**
 * Generate a complete brief package for an entire V2 learning path.
 * Returns a downloadable Markdown document.
 *
 * @param {Object} v2Path — V2 LearningPath object
 * @param {Object} [options]
 * @param {Function} [options.onProgress] — (completed, total) callback
 * @returns {Promise<{ markdown: string, briefs: Array, metadata: Object }>}
 */
export async function generateCourseBriefPackage(v2Path, { onProgress } = {}) {
  if (!v2Path?.sections?.length) {
    throw new Error("Invalid V2 path: no sections found");
  }

  devLog(`[VideoBrief] Generating brief package for "${v2Path.title}"`);
  const startTime = Date.now();
  const allBriefs = [];

  // Flatten all steps across sections
  const allSteps = [];
  for (const section of v2Path.sections) {
    for (const step of section.steps || []) {
      allSteps.push({
        step,
        sectionTitle: section.title || section.phase || "Chapter",
      });
    }
  }

  const totalSteps = allSteps.length;

  // Process in batches
  for (let i = 0; i < allSteps.length; i += BATCH_SIZE) {
    const batch = allSteps.slice(i, i + BATCH_SIZE);
    const batchBriefs = await Promise.allSettled(
      batch.map(({ step, sectionTitle }, batchIdx) =>
        generateVideoBrief(step, {
          pathTitle: v2Path.title || "UE5 Learning Path",
          learnerGoal: v2Path.query || "",
          stepIndex: i + batchIdx,
          totalSteps,
          chapterTitle: sectionTitle,
        })
      )
    );

    for (const result of batchBriefs) {
      if (result.status === "fulfilled") {
        allBriefs.push(result.value);
      } else {
        devWarn("[VideoBrief] Step brief failed:", result.reason?.message);
        allBriefs.push(null);
      }
    }

    onProgress?.(Math.min(i + BATCH_SIZE, totalSteps), totalSteps);

    // Brief pause between batches
    if (i + BATCH_SIZE < allSteps.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // ── Generate Markdown ────────────────────────────────────

  const metadata = {
    title: v2Path.title || "Course Brief Package",
    generatedAt: new Date().toISOString(),
    totalSteps: allSteps.length,
    briefsGenerated: allBriefs.filter(Boolean).length,
    generationTimeMs: Date.now() - startTime,
  };

  const markdown = renderBriefMarkdown(v2Path, allBriefs, metadata);

  devLog(
    `[VideoBrief] Package complete: ${metadata.briefsGenerated}/${totalSteps} briefs (${metadata.generationTimeMs}ms)`
  );

  return { markdown, briefs: allBriefs, metadata };
}

// ── Markdown Renderer ──────────────────────────────────────

function renderBriefMarkdown(v2Path, briefs, metadata) {
  const lines = [];

  lines.push(`# 🎬 Recording Brief: ${metadata.title}`);
  lines.push("");
  lines.push(`> Generated: ${new Date(metadata.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
  lines.push(`> Steps: ${metadata.totalSteps} · Briefs generated: ${metadata.briefsGenerated}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  let briefIdx = 0;
  for (const section of v2Path.sections || []) {
    const sectionTitle = section.title || section.phase || "Chapter";
    lines.push(`## 📂 ${sectionTitle}`);
    if (section.purpose) {
      lines.push(`> ${section.purpose}`);
    }
    lines.push("");

    for (const step of section.steps || []) {
      const brief = briefs[briefIdx];
      briefIdx++;

      if (!brief) {
        lines.push(`### ❌ ${step.title || "Untitled"} — Brief generation failed`);
        lines.push("");
        continue;
      }

      lines.push(`### 🎥 ${brief.stepTitle}`);
      lines.push("");
      lines.push(`| Field | Value |`);
      lines.push(`|---|---|`);
      lines.push(`| **Target Length** | ${brief.targetLength} |`);
      lines.push(`| **Skill Level** | ${brief.skillLevel} |`);
      lines.push(`| **Position** | ${brief.position} |`);
      lines.push("");

      if (brief.whyThisMatters) {
        lines.push(`**💡 Why This Matters:** ${brief.whyThisMatters}`);
        lines.push("");
      }

      if (brief.editorSetup?.length) {
        lines.push("**🖥️ Editor Setup (before recording):**");
        for (const setup of brief.editorSetup) {
          lines.push(`- [ ] ${setup}`);
        }
        lines.push("");
      }

      if (brief.requiredDemonstrations?.length) {
        lines.push("**📹 Required Demonstrations:**");
        for (let i = 0; i < brief.requiredDemonstrations.length; i++) {
          lines.push(`${i + 1}. ${brief.requiredDemonstrations[i]}`);
        }
        lines.push("");
      }

      if (brief.talkingPoints?.length) {
        lines.push("**🗣️ Talking Points:**");
        for (const point of brief.talkingPoints) {
          lines.push(`- ${point}`);
        }
        lines.push("");
      }

      if (brief.requiredTerminology?.length) {
        lines.push(`**📖 Required Terminology:** ${brief.requiredTerminology.join(", ")}`);
        lines.push("");
      }

      if (brief.commonMistake) {
        lines.push(`**⚠️ Common Mistake to Address:** ${brief.commonMistake}`);
        lines.push("");
      }

      if (brief.scriptNotes) {
        lines.push(`**📝 Script Notes:** ${brief.scriptNotes}`);
        lines.push("");
      }

      if (brief.existingResources?.length) {
        lines.push("**📚 Existing Resources:**");
        for (const res of brief.existingResources) {
          const link = res.url ? `[${res.title}](${res.url})` : res.title;
          lines.push(`- ${res.type === "video" ? "🎬" : "📄"} ${link} ${res.duration ? `(${res.duration})` : ""}`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }
  }

  lines.push("## 📊 Package Summary");
  lines.push("");
  lines.push(`- **Total steps:** ${metadata.totalSteps}`);
  lines.push(`- **Briefs generated:** ${metadata.briefsGenerated}`);
  lines.push(`- **Generation time:** ${(metadata.generationTimeMs / 1000).toFixed(1)}s`);
  lines.push(`- **Generated at:** ${metadata.generatedAt}`);

  return lines.join("\n");
}

// ── Cache Management ───────────────────────────────────────

export function clearBriefCache() {
  BRIEF_CACHE.clear();
  devLog("[VideoBrief] Cache cleared");
}

/**
 * Download markdown as a file in the browser.
 */
export function downloadBriefAsMarkdown(markdown, filename = "recording_brief.md") {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  generateVideoBrief,
  generateCourseBriefPackage,
  clearBriefCache,
  downloadBriefAsMarkdown,
};
