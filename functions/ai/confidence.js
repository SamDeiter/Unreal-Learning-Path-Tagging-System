/**
 * confidence.js — Confidence scoring for problem-first diagnosis.
 *
 * Determines whether the system has enough context to answer directly,
 * or should ask a clarifying question first.
 *
 * Scoring is additive from several signals:
 *   - Systems identified, structured case report, RAG passage quality,
 *     multi-turn conversation depth, query length, and vagueness penalties.
 *
 * Extracted from queryLearningPath.js for testability.
 */

/**
 * Compute confidence score based on available context.
 * Determines whether to ask a clarifying question or proceed to full answer.
 *
 * @param {object} intent - Extracted intent
 * @param {object} caseReport - Optional structured case report
 * @param {Array} passages - Retrieved RAG passages
 * @param {Array} conversationHistory - Previous Q&A turns from multi-turn
 * @param {string} query - The raw user query (for vagueness detection)
 * @returns {{ score: number, reasons: string[] }}
 */
function computeConfidence(intent, caseReport, passages, conversationHistory, query) {
  let score = 0;
  const reasons = [];

  // Intent has multiple identified systems
  if (intent.systems && intent.systems.length >= 2) {
    score += 30;
    reasons.push("multiple_systems_identified");
  } else if (intent.systems && intent.systems.length === 1) {
    score += 15;
    reasons.push("single_system_identified");
  }

  // Structured case report provides context
  if (caseReport) {
    if (caseReport.engineVersion) {
      score += 15;
      reasons.push("engine_version_provided");
    }
    if (caseReport.errorStrings && caseReport.errorStrings.length > 0) {
      score += 25;
      reasons.push("error_strings_provided");
    }
    if (caseReport.platform) {
      score += 5;
      reasons.push("platform_provided");
    }
    if (caseReport.whatChangedRecently) {
      score += 10;
      reasons.push("change_context_provided");
    }
  }

  // High-quality RAG passages (capped at 25 to prevent RAG alone from skipping clarification)
  const goodPassages = (passages || []).filter((p) => (p.similarity || 0) > 0.4);
  if (goodPassages.length >= 2) {
    score += 25;
    reasons.push("strong_rag_matches");
  } else if (goodPassages.length === 1) {
    score += 15;
    reasons.push("partial_rag_match");
  }

  // Partial credit for decent passages (0.35–0.40 similarity)
  const decentPassages = (passages || []).filter(
    (p) => (p.similarity || 0) >= 0.35 && (p.similarity || 0) <= 0.4
  );
  if (decentPassages.length >= 2) {
    score += 10;
    reasons.push("decent_rag_matches");
  }

  // Multi-turn: each completed Q&A round adds confidence
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  const completedRounds = history.filter((t) => t.role === "user").length;
  if (completedRounds > 0) {
    score += Math.min(completedRounds * 15, 45); // 15 pts per round, max 45
    reasons.push(`multi_turn_rounds_${completedRounds}`);
  }

  // ── Vagueness penalties ──────────────────────────────────────────
  const queryLen = (query || "").length;
  if (queryLen < 30) {
    score -= 15;
    reasons.push("short_query_penalty");
  }
  if (!caseReport && (!intent.systems || intent.systems.length < 2)) {
    // No structured context AND not a multi-system query → likely vague
    const hasErrors = caseReport?.errorStrings?.length > 0;
    if (!hasErrors) {
      score -= 10;
      reasons.push("no_structured_context_penalty");
    }
  }

  return { score: Math.max(score, 0), reasons };
}

module.exports = { computeConfidence };
