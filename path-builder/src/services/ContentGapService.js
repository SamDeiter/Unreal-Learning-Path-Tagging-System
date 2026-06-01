import { personaScoringRules, getPersonaById } from "./PersonaService";

// Cache for normalized course metadata to avoid redundant string processing
const courseMetadataCache = new WeakMap();

// Cache for normalized persona rules
const personaRulesCache = new Map();

/**
 * Get or create normalized course metadata
 */
function getNormalizedCourseMetadata(course) {
  let metadata = courseMetadataCache.get(course);
  if (!metadata) {
    const title = (course.title || "").toLowerCase();
    const allTags = [
      ...(course.canonical_tags || []),
      ...(course.ai_tags || []),
      ...(course.gemini_system_tags || []),
      ...(course.transcript_tags || []),
      ...(course.extracted_tags || []),
    ].map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
    metadata = { title, allTags };
    courseMetadataCache.set(course, metadata);
  }
  return metadata;
}

/**
 * Get or create normalized persona rules
 */
function getNormalizedPersonaRules(personaId) {
  let normalized = personaRulesCache.get(personaId);
  if (!normalized) {
    const rules = personaScoringRules[personaId];
    if (!rules) return null;

    normalized = {
      boostKeywords: (rules.boostKeywords || []).map((k) => k.toLowerCase()),
      penaltyKeywords: (rules.penaltyKeywords || []).map((k) => k.toLowerCase()),
      requiredTopics: (rules.requiredTopics || []).map((t) => t.toLowerCase()),
    };
    personaRulesCache.set(personaId, normalized);
  }
  return normalized;
}

/**
 * Analyze content gaps for a specific persona.
 *
 * @param {string} personaId - The persona ID (e.g., "animator_alex")
 * @param {Array} courses - Full course list from video_library_enriched.json
 * @param {Array} tags - Tag data from tags.json
 * @returns {{ coveredTopics: string[], missingTopics: string[], tooTechnical: object[], artistFriendly: object[], relevanceScores: object[], topGaps: string[] }}
 */
export function analyzeGaps(personaId, courses = [], _tags = []) {
  const rules = getNormalizedPersonaRules(personaId);
  const persona = getPersonaById(personaId);

  if (!rules || !persona) {
    return {
      coveredTopics: [],
      missingTopics: [],
      tooTechnical: [],
      artistFriendly: [],
      relevanceScores: [],
      topGaps: [],
    };
  }

  const { boostKeywords, penaltyKeywords, requiredTopics } = rules;

  // Score each course for this persona
  const scored = courses.map((course) => {
    const { title, allTags } = getNormalizedCourseMetadata(course);

    let score = 0;
    const matchedBoosts = [];
    const matchedPenalties = [];

    // Boost scoring
    for (let i = 0; i < boostKeywords.length; i++) {
      const keyword = boostKeywords[i];
      if (title.includes(keyword)) {
        score += 5;
        matchedBoosts.push(keyword);
      } else if (allTags.some((t) => t.includes(keyword))) {
        score += 3;
        matchedBoosts.push(keyword);
      }
    }

    // Penalty scoring
    for (let i = 0; i < penaltyKeywords.length; i++) {
      const keyword = penaltyKeywords[i];
      if (title.includes(keyword) || allTags.some((t) => t.includes(keyword))) {
        score -= 10;
        matchedPenalties.push(keyword);
      }
    }

    // Check which required topics are covered
    const coveredRequired = [];
    for (let i = 0; i < requiredTopics.length; i++) {
      const topic = requiredTopics[i];
      if (title.includes(topic) || allTags.some((t) => t.includes(topic))) {
        coveredRequired.push(topic);
      }
    }

    return {
      code: course.code,
      title: course.title,
      score,
      matchedBoosts,
      matchedPenalties,
      coveredRequired,
      isTechnical: matchedPenalties.length > 0 && matchedBoosts.length === 0,
      isRelevant: score > 0,
    };
  });

  // Determine topic coverage
  const coveredTopicSet = new Set();
  scored.forEach((c) => {
    c.coveredRequired.forEach((t) => coveredTopicSet.add(t));
  });

  const coveredTopics = [...coveredTopicSet];
  const missingTopics = requiredTopics.filter((t) => !coveredTopicSet.has(t));

  // Filter results
  const tooTechnical = scored
    .filter((c) => c.isTechnical)
    .sort((a, b) => a.score - b.score)
    .slice(0, 20);

  const artistFriendly = scored
    .filter((c) => c.isRelevant && !c.isTechnical)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const relevanceScores = scored
    .filter((c) => c.score !== 0)
    .sort((a, b) => b.score - a.score);

  // Top gaps: the boost keywords NOT found in any course
  const coveredBoosts = new Set(scored.flatMap((c) => c.matchedBoosts));
  const topGaps = boostKeywords.filter((k) => !coveredBoosts.has(k));

  return {
    coveredTopics,
    missingTopics,
    tooTechnical,
    artistFriendly,
    relevanceScores,
    topGaps,
    persona: persona,
    totalCourses: courses.length,
    relevantCount: artistFriendly.length,
    technicalCount: tooTechnical.length,
  };
}

/**
 * Get a persona relevance badge for a course.
 *
 * @param {object} course - Course object
 * @param {string} personaId - Active persona ID
 * @returns {{ label: string, type: "relevant"|"technical"|"neutral", score: number }}
 */
export function getRelevanceBadge(course, personaId) {
  const rules = getNormalizedPersonaRules(personaId);
  if (!rules) return { label: "", type: "neutral", score: 0 };

  const { title, allTags } = getNormalizedCourseMetadata(course);
  const { boostKeywords, penaltyKeywords } = rules;

  let score = 0;
  let hasPenalty = false;

  for (let i = 0; i < boostKeywords.length; i++) {
    const kw = boostKeywords[i];
    if (title.includes(kw)) {
      score += 5;
    } else {
      for (let j = 0; j < allTags.length; j++) {
        if (allTags[j].includes(kw)) {
          score += 3;
          break;
        }
      }
    }
  }

  for (let i = 0; i < penaltyKeywords.length; i++) {
    const kw = penaltyKeywords[i];
    if (title.includes(kw)) {
      score -= 10;
      hasPenalty = true;
    } else {
      for (let j = 0; j < allTags.length; j++) {
        if (allTags[j].includes(kw)) {
          score -= 10;
          hasPenalty = true;
          break;
        }
      }
    }
  }

  if (score >= 10) return { label: "🎨 Persona Match", type: "relevant", score };
  if (score >= 5) return { label: "✅ Relevant", type: "relevant", score };
  if (hasPenalty && score < 0) return { label: "⚙️ Technical", type: "technical", score };
  return { label: "", type: "neutral", score };
}

export default { analyzeGaps, getRelevanceBadge };
