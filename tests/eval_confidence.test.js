/**
 * eval_confidence.test.js — Golden scenarios for confidence-based routing.
 *
 * Validates that vague queries trigger clarification (score < 50)
 * and specific queries skip to direct answers (score >= 50).
 *
 * Usage:
 *   npx jest tests/eval_confidence.test.js --verbose
 */

// ── Exact copy of computeConfidence from queryLearningPath.js ──────────
function computeConfidence(intent, caseReport, passages, conversationHistory, query) {
  let score = 0;
  const reasons = [];

  if (intent.systems && intent.systems.length >= 2) {
    score += 30;
    reasons.push("multiple_systems_identified");
  } else if (intent.systems && intent.systems.length === 1) {
    score += 15;
    reasons.push("single_system_identified");
  }

  if (caseReport) {
    if (caseReport.engineVersion) { score += 15; reasons.push("engine_version_provided"); }
    if (caseReport.errorStrings && caseReport.errorStrings.length > 0) { score += 25; reasons.push("error_strings_provided"); }
    if (caseReport.platform) { score += 5; reasons.push("platform_provided"); }
    if (caseReport.whatChangedRecently) { score += 10; reasons.push("change_context_provided"); }
  }

  const goodPassages = (passages || []).filter((p) => (p.similarity || 0) > 0.4);
  if (goodPassages.length >= 2) { score += 25; reasons.push("strong_rag_matches"); }
  else if (goodPassages.length === 1) { score += 15; reasons.push("partial_rag_match"); }

  const decentPassages = (passages || []).filter(
    (p) => (p.similarity || 0) >= 0.35 && (p.similarity || 0) <= 0.4
  );
  if (decentPassages.length >= 2) { score += 10; reasons.push("decent_rag_matches"); }

  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  const completedRounds = history.filter((t) => t.role === "user").length;
  if (completedRounds > 0) {
    score += Math.min(completedRounds * 15, 45);
    reasons.push(`multi_turn_rounds_${completedRounds}`);
  }

  const queryLen = (query || "").length;
  if (queryLen < 30) { score -= 15; reasons.push("short_query_penalty"); }
  if (!caseReport && (!intent.systems || intent.systems.length < 2)) {
    const hasErrors = caseReport?.errorStrings?.length > 0;
    if (!hasErrors) { score -= 10; reasons.push("no_structured_context_penalty"); }
  }

  return { score: Math.max(score, 0), reasons };
}
// ── End copy ───────────────────────────────────────────────────────────

const THRESHOLD = 50;

const makePassages = (count, sim = 0.5) =>
  Array.from({ length: count }, () => ({ text: "stub", similarity: sim }));

// ═══════════════════════════════════════════════════════════════════════
//  GOLDEN SCENARIOS
// ═══════════════════════════════════════════════════════════════════════

const SHOULD_CLARIFY = [
  {
    name: "Ultra-short vague: 'help'",
    query: "help",
    intent: { systems: [] },
    caseReport: null,
    passages: makePassages(2, 0.5),
  },
  {
    name: "Vague lighting complaint",
    query: "my lighting looks wrong",
    intent: { systems: ["Lighting"] },
    caseReport: null,
    passages: makePassages(3, 0.55),
  },
  {
    name: "Generic 'not working'",
    query: "it's not working",
    intent: { systems: [] },
    caseReport: null,
    passages: makePassages(1, 0.42),
  },
  {
    name: "One-word mesh issue",
    query: "mesh broken",
    intent: { systems: ["StaticMesh"] },
    caseReport: null,
    passages: makePassages(2, 0.48),
  },
  {
    name: "Vague animation problem",
    query: "animation glitch",
    intent: { systems: ["Animation"] },
    caseReport: null,
    passages: makePassages(4, 0.6),
  },
  {
    name: "Short blueprint complaint",
    query: "blueprint error",
    intent: { systems: ["Blueprint"] },
    caseReport: null,
    passages: makePassages(2, 0.5),
  },
  {
    name: "Vague texture issue",
    query: "textures look bad",
    intent: { systems: ["Material"] },
    caseReport: null,
    passages: makePassages(3, 0.45),
  },
  {
    name: "Vague crash report (no error strings)",
    query: "game keeps crashing",
    intent: { systems: ["Crash"] },
    caseReport: null,
    passages: makePassages(2, 0.5),
  },
  {
    name: "Single system + weak passages",
    query: "niagara particles bad",
    intent: { systems: ["Niagara"] },
    caseReport: null,
    passages: makePassages(1, 0.38),
  },
  {
    name: "Short multi-word but still vague",
    query: "my character is stuck",
    intent: { systems: ["Character"] },
    caseReport: null,
    passages: makePassages(2, 0.52),
  },
];

const SHOULD_ANSWER = [
  {
    name: "Detailed Lumen issue + error log + engine version",
    query: "Lumen GI flickering after enabling Nanite on all static meshes in my indoor scene with UE 5.3",
    intent: { systems: ["Lighting", "Nanite"] },
    caseReport: {
      engineVersion: "5.3",
      errorStrings: ["LogRenderer: Warning: Lumen scene lighting capacity exceeded"],
      platform: "Windows",
    },
    passages: makePassages(4, 0.65),
  },
  {
    name: "Specific blueprint error with error string",
    query: "Blueprint compile error: Accessed None trying to read property from PlayerCharacter in BP_GameMode",
    intent: { systems: ["Blueprint", "GameMode"] },
    caseReport: {
      engineVersion: "5.4",
      errorStrings: ["Accessed None trying to read property CallFunc_GetPlayerCharacter"],
    },
    passages: makePassages(3, 0.58),
  },
  {
    name: "Multi-system detailed query, no case report",
    query: "post-process bloom is washing out my Lumen reflections in an indoor scene with emissive materials",
    intent: { systems: ["PostProcess", "Lighting"] },
    caseReport: null,
    passages: makePassages(3, 0.55),
  },
  {
    name: "Full case report with platform + change context",
    query: "Nanite overdraw causing GPU timeout on large open world with thousands of foliage instances",
    intent: { systems: ["Nanite", "Foliage"] },
    caseReport: {
      engineVersion: "5.3",
      errorStrings: ["D3D Device Lost"],
      platform: "Windows",
      whatChangedRecently: "Converted all foliage to Nanite",
    },
    passages: makePassages(3, 0.6),
  },
  {
    name: "Specific crash with callstack",
    query: "Access violation crash in USkeletalMeshComponent::RefreshBoneTransforms when playing montage on dedicated server",
    intent: { systems: ["Animation", "Multiplayer"] },
    caseReport: {
      engineVersion: "5.2",
      errorStrings: ["Access violation - code c0000005", "USkeletalMeshComponent::RefreshBoneTransforms"],
      platform: "Linux",
    },
    passages: makePassages(2, 0.48),
  },
  {
    name: "Detailed packaging issue",
    query: "Packaging fails with missing shader permutation for mobile preview rendering on Android Vulkan target",
    intent: { systems: ["Packaging", "Rendering"] },
    caseReport: {
      engineVersion: "5.4",
      errorStrings: ["Missing shader permutation for /Engine/Private/BasePassVertexShader"],
      platform: "Android",
    },
    passages: makePassages(2, 0.45),
  },
  {
    name: "Multi-turn round 2 with enriched intent (should clear by now)",
    query: "my lighting looks wrong",
    intent: { systems: ["Lighting", "Lumen"] },
    caseReport: null,
    passages: makePassages(2, 0.5),
    conversationHistory: [
      { role: "assistant", content: "What type of lighting?" },
      { role: "user", content: "Dynamic lighting with Lumen" },
      { role: "assistant", content: "Indoor or outdoor?" },
      { role: "user", content: "Indoor, small room" },
    ],
  },
  {
    name: "Replication detailed description",
    query: "Replicated variable not updating on client in a dedicated server setup using DOREPLIFETIME with COND_OwnerOnly",
    intent: { systems: ["Multiplayer", "Replication"] },
    caseReport: null,
    passages: makePassages(3, 0.52),
  },
  {
    name: "Detailed VR setup question",
    query: "OpenXR hand tracking IK not working correctly on Quest 3 after migrating from OculusVR plugin to OpenXR",
    intent: { systems: ["XR", "Animation"] },
    caseReport: {
      engineVersion: "5.3",
      platform: "Quest",
      whatChangedRecently: "Migrated from OculusVR to OpenXR plugin",
    },
    passages: makePassages(2, 0.44),
  },
  {
    name: "Specific material/shader issue with engine version",
    query: "Custom material expression node causing shader compilation timeout on complex landscape material with 8 layers",
    intent: { systems: ["Material", "Landscape"] },
    caseReport: {
      engineVersion: "5.4",
      errorStrings: ["ShaderCompileWorker timeout after 120s"],
    },
    passages: makePassages(3, 0.5),
  },
];

// ═══════════════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Confidence Routing Eval — Should CLARIFY (score < 50)", () => {
  for (const scenario of SHOULD_CLARIFY) {
    test(scenario.name, () => {
      const result = computeConfidence(
        scenario.intent,
        scenario.caseReport,
        scenario.passages,
        scenario.conversationHistory || [],
        scenario.query
      );
      expect(result.score).toBeLessThan(THRESHOLD);
    });
  }
});

describe("Confidence Routing Eval — Should ANSWER DIRECTLY (score >= 50)", () => {
  for (const scenario of SHOULD_ANSWER) {
    test(scenario.name, () => {
      const result = computeConfidence(
        scenario.intent,
        scenario.caseReport,
        scenario.passages,
        scenario.conversationHistory || [],
        scenario.query
      );
      expect(result.score).toBeGreaterThanOrEqual(THRESHOLD);
    });
  }
});

describe("Confidence Routing Eval — Summary", () => {
  test("report overall routing accuracy", () => {
    let clarifyCorrect = 0;
    let answerCorrect = 0;

    for (const s of SHOULD_CLARIFY) {
      const r = computeConfidence(s.intent, s.caseReport, s.passages, s.conversationHistory || [], s.query);
      if (r.score < THRESHOLD) clarifyCorrect++;
    }
    for (const s of SHOULD_ANSWER) {
      const r = computeConfidence(s.intent, s.caseReport, s.passages, s.conversationHistory || [], s.query);
      if (r.score >= THRESHOLD) answerCorrect++;
    }

    const total = SHOULD_CLARIFY.length + SHOULD_ANSWER.length;
    const correct = clarifyCorrect + answerCorrect;
    const accuracy = (correct / total * 100).toFixed(1);

    console.log("\n╔════════════════════════════════════════════╗");
    console.log("║    Confidence Routing Eval Summary         ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log(`║  Clarify correct:   ${clarifyCorrect}/${SHOULD_CLARIFY.length}                      ║`);
    console.log(`║  Answer correct:    ${answerCorrect}/${SHOULD_ANSWER.length}                     ║`);
    console.log(`║  Overall accuracy:  ${accuracy}%                   ║`);
    console.log("╚════════════════════════════════════════════╝\n");

    expect(correct / total).toBeGreaterThanOrEqual(0.9);
  });
});
