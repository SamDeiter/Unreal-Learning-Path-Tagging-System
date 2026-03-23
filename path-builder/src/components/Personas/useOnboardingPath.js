/**
 * useOnboardingPath — Custom hook encapsulating the onboarding path generation pipeline.
 * Handles both RAG (AI-powered) and local (rule-based) path generation,
 * including course enrichment, industry filtering, milestones, and blended path fetching.
 *
 * Extracted from Personas.jsx for maintainability.
 */
import { useState, useMemo } from "react";
import {
  getPainPointMessaging,
  getPersonaById,
  personaScoringRules,
} from "../../services/PersonaService";
import { useTagData } from "../../context/TagDataContext";
import { buildBlendedPath } from "../../services/coverageAnalyzer";
import { buildLearningOutcome } from "../../utils/videoTopicExtractor";
import useOnboardingRAG from "../../hooks/useOnboardingRAG";
import { logOnboardingRAG } from "../../services/onboardingTelemetry";
import { QUESTIONS } from "./onboardingQuestions";

export default function useOnboardingPath(answers) {
  const { courses } = useTagData();
  const [generatedPath, setGeneratedPath] = useState(null);
  const [blendedPath, setBlendedPath] = useState(null);

  // RAG pipeline hook
  const { generateRAGPath, resetRAG, ragState, ragError, RAG_STATES } = useOnboardingRAG();
  const isRAGLoading = [RAG_STATES.PLANNING, RAG_STATES.SEARCHING, RAG_STATES.ASSEMBLING].includes(
    ragState
  );

  // Detect persona from role answer (deterministic mapping)
  const detectedPersona = useMemo(() => {
    if (!answers.role) return null;
    return getPersonaById(answers.role);
  }, [answers.role]);

  // Build a persona string from the quiz answers for the RAG pipeline
  const buildPersonaString = () => {
    const roleOption = QUESTIONS[1].options.find((o) => o.value === answers.role);
    const expOption = QUESTIONS[2].options.find((o) => o.value === answers.experience);
    const goalOption = QUESTIONS[3].options.find((o) => o.value === answers.goal);
    const parts = [
      answers.startPrompt ? `Goal: ${answers.startPrompt}.` : "",
      `Role: ${roleOption?.label || answers.role}.`,
      `Experience: ${expOption?.label || answers.experience}.`,
      `Objective: ${goalOption?.label || answers.goal}.`,
    ];
    return parts.filter(Boolean).join(" ");
  };

  // ─── Shared: extract path topics + fetch blended docs/youtube ───
  const fetchBlendedPath = async () => {
    try {
      // Use persona keywords + user goal words (not generic course title words)
      const personaKeywords = (detectedPersona?.keywords || []).map((k) => k.toLowerCase());
      const goalWords = (answers?.startPrompt || "")
        .toLowerCase().split(/\s+/)
        .filter((w) => w.length > 3 && !["want", "need", "learn", "about", "with", "make", "using"].includes(w));

      const topics = [...personaKeywords, ...goalWords]
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 12);

      if (topics.length > 0) {
        const blended = await buildBlendedPath(topics, [], { maxDocs: 5, maxYoutube: 3 });
        setBlendedPath(blended);
      }
    } catch (e) {
      console.warn("[Personas] Blended path fetch failed:", e.message);
    }
  };

  // ─── Shared: add milestones to path courses ───
  const addMilestones = (pathCourses) => {
    let totalMinutes = 0;
    return pathCourses.map((course, idx) => {
      const duration = course.duration || 45;
      totalMinutes += duration;
      const learningOutcome =
        course.learningOutcome || buildLearningOutcome(course.videos, course.ai_tags);
      return {
        ...course,
        order: idx + 1,
        cumulativeTime: totalMinutes,
        milestone:
          totalMinutes >= 120 && totalMinutes < 180
            ? "2hr"
            : totalMinutes >= 300 && totalMinutes < 360
              ? "5hr"
              : totalMinutes >= 600
                ? "10hr"
                : null,
        quickWin: idx < 2,
        learningOutcome,
        _totalMinutes: totalMinutes,
      };
    });
  };

  // ─────────── Trigger the RAG pipeline, fall back to local scoring if it fails ───────────
  const handleGeneratePath = async () => {
    // Persist persona to localStorage for ProblemFirst tab
    if (detectedPersona) {
      localStorage.setItem("detected_persona", JSON.stringify(detectedPersona));
    }

    const personaString = buildPersonaString();
    // Build archetype for RAG
    const archetype = detectedPersona
      ? `${detectedPersona.name} — ${detectedPersona.industry}`
      : "General";

    // Try RAG pipeline first
    const ragResult = await generateRAGPath(personaString, archetype);

    if (ragResult?.curriculum?.modules?.length > 0) {
      // Build passage lookup: videoTitle → passage data (from search results)
      const passages = ragResult.passages || [];
      const passageLookup = {};
      passages.forEach((p) => {
        if (p.videoTitle) passageLookup[p.videoTitle.toLowerCase()] = p;
        if (p.videoId) passageLookup[p.videoId.toLowerCase()] = p;
      });

      // Helper: find a course by matching a videoTitle string
      const findCourseByVideoTitle = (videoTitle) => {
        if (!courses || !videoTitle) return null;
        const titleLower = videoTitle.toLowerCase();
        return courses.find((c) =>
          c.videos?.some((v) => {
            const vTitle = (v.title || v.name || "").toLowerCase();
            return (
              vTitle === titleLower || vTitle.includes(titleLower) || titleLower.includes(vTitle)
            );
          })
        );
      };

      // Helper: word-overlap scoring (for loose matches)
      const wordOverlapScore = (a, b) => {
        const stopWords = new Set([
          "the",
          "and",
          "for",
          "are",
          "with",
          "from",
          "this",
          "that",
          "your",
          "into",
          "how",
          "can",
          "will",
          "has",
          "was",
          "been",
          "have",
          "what",
          "when",
          "not",
          "unreal",
          "engine",
          "ue5",
          "learn",
          "using",
          "about",
          "getting",
          "started",
          "introduction",
          "overview",
          "course",
          "module",
          "lesson",
          "video",
        ]);
        const wordsA = (a || "")
          .toLowerCase()
          .split(/[\s\-_/()]+/)
          .filter((w) => w.length > 2 && !stopWords.has(w));
        const wordsB = (b || "")
          .toLowerCase()
          .split(/[\s\-_/()]+/)
          .filter((w) => w.length > 2 && !stopWords.has(w));
        if (wordsA.length === 0 || wordsB.length === 0) return 0;

        let matches = 0;
        for (const wa of wordsA) {
          for (const wb of wordsB) {
            if (wa === wb) {
              matches++;
              break;
            }
            if (wa.length > 4 && wb.length > 4) {
              if (wa.includes(wb) || wb.includes(wa)) {
                matches += 0.5;
                break;
              }
            }
          }
        }
        return matches / Math.max(wordsA.length, wordsB.length);
      };

      // RAG succeeded — enrich modules with real course data for playback
      const usedCourseIds = new Set();
      const enrichedModules = (ragResult.curriculum.modules || []).map((mod) => {
        let matched = null;

        // 1) Direct videoId match against course library
        if (mod.videoId && courses) {
          matched = courses.find(
            (c) =>
              !usedCourseIds.has(c.title) &&
              c.videos?.some(
                (v) =>
                  v.drive_id &&
                  (v.title === mod.videoId || v.name === mod.videoId || v.drive_id === mod.videoId)
              )
          );
        }

        // 2) Match via passage videoTitle → find course with that video title
        if (!matched) {
          const passageKey = (mod.videoId || "").toLowerCase();
          const passage = passageLookup[passageKey];
          if (passage?.videoTitle) {
            matched = findCourseByVideoTitle(passage.videoTitle);
            if (matched && usedCourseIds.has(matched.title)) matched = null;
          }
        }

        // 3) Word-overlap: score all passage videoTitles against module title
        if (!matched && courses) {
          let bestScore = 0;
          let bestCourse = null;
          for (const p of passages) {
            if (!p.videoTitle) continue;
            const course = findCourseByVideoTitle(p.videoTitle);
            if (!course || usedCourseIds.has(course.title)) continue;
            const score = wordOverlapScore(mod.title + " " + (mod.description || ""), p.videoTitle);
            if (score > bestScore && score >= 0.15) {
              bestScore = score;
              bestCourse = course;
            }
          }
          matched = bestCourse;
        }

        // 4) Last resort: word-overlap directly against course library
        if (!matched && courses) {
          let bestScore = 0;
          let bestCourse = null;
          for (const c of courses) {
            if (usedCourseIds.has(c.title)) continue;
            if (!c.videos?.length || !c.videos[0]?.drive_id) continue;
            const score = wordOverlapScore(
              mod.title + " " + (mod.description || ""),
              c.title || c.name || ""
            );
            if (score > bestScore && score >= 0.15) {
              bestScore = score;
              bestCourse = c;
            }
          }
          matched = bestCourse;
        }

        if (matched) usedCourseIds.add(matched.title);

        // Build enriched course object
        const enrichedCourse = matched
          ? {
              ...matched,
              ragTitle: mod.title,
              ragDescription: mod.description,
              enriched: true,
            }
          : {
              title: mod.title,
              name: mod.title,
              description: mod.description,
              code: `rag-${mod.title.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}`,
              videos: [],
              enriched: false,
            };

        return enrichedCourse;
      });

      // Filter to only playable enriched courses
      const playableCourses = enrichedModules.filter(
        (c) => c.enriched && c.videos?.length > 0 && c.videos[0]?.drive_id
      );

      // ── Industry filter for RAG courses (same logic as local scorer) ──
      const personaIndustryMapRAG = {
        indie_isaac: "games",
        logic_liam: "games",
        animator_alex: "animation",
        rigger_regina: "animation",
        designer_cpg: "visualization",
        architect_amy: "architecture",
        simulation_sam: "simulation",
        vfx_victor: "vfx",
        automotive_andy: "automotive",
      };
      const pIndustry = personaIndustryMapRAG[detectedPersona?.id] || "general";
      const industryFilteredCourses = playableCourses.filter((c) => {
        const cIndustry = (c.tags?.industry || "general").toLowerCase();
        const cTitle = (c.title || c.name || "").toLowerCase();
        if (cIndustry !== "general" && cIndustry !== pIndustry) return false;
        const titleFilters = [
          {
            match: ["automotive", "vehicle design", "configurator", "car paint", "vred"],
            allow: ["automotive"],
          },
          {
            match: ["archviz", "architectural", "twinmotion", "for architecture", "aeco"],
            allow: ["architecture", "visualization"],
          },
          {
            match: ["legacy production", "virtual production", "broadcast", "icvfx", "ndisplay"],
            allow: ["animation", "vfx", "film", "media"],
          },
        ];
        for (const f of titleFilters) {
          if (f.match.some((kw) => cTitle.includes(kw)) && !f.allow.includes(pIndustry))
            return false;
        }
        return true;
      });

      // Log enrichment telemetry
      logOnboardingRAG({
        outcome: "enrichment",
        totalModules: enrichedModules.length,
        enrichedCount: industryFilteredCourses.length,
        enrichmentRate:
          enrichedModules.length > 0
            ? Math.round((industryFilteredCourses.length / enrichedModules.length) * 100)
            : 0,
      });

      if (industryFilteredCourses.length >= 3) {
        const pathWithMilestones = addMilestones(industryFilteredCourses.slice(0, 8));
        const totalMinutes =
          pathWithMilestones.length > 0
            ? pathWithMilestones[pathWithMilestones.length - 1]._totalMinutes
            : 0;

        setGeneratedPath({
          persona: detectedPersona,
          courses: pathWithMilestones,
          totalTime: totalMinutes,
          messaging: getPainPointMessaging(detectedPersona),
          source: "rag",
        });

        await fetchBlendedPath();
        return;
      }
    }

    // RAG failed or no playable courses — fall back to local scoring
    await generatePathLocal();
  };

  // ─────────── Generate the 10-hour path (local fallback) ───────────
  const generatePathLocal = async () => {
    if (!detectedPersona || !courses) return;

    const rules = personaScoringRules[detectedPersona.id] || {
      boostKeywords: detectedPersona.keywords || [],
      penaltyKeywords: [],
      requiredTopics: [],
    };

    // ── Experience-aware difficulty filter ──
    const expLevel = answers.experience || "beginner";
    const allowedLevels = {
      beginner: ["beginner", "", "general"],
      junior: ["beginner", "", "general", "intermediate"],
      mid: ["beginner", "", "general", "intermediate"],
      senior: ["beginner", "", "general", "intermediate", "advanced"],
    };
    const allowed = allowedLevels[expLevel] || allowedLevels.beginner;

    const filteredCourses = courses
      .filter((c) => {
        const level = (c.tags?.level || "").toLowerCase();
        return allowed.includes(level);
      })
      .filter((c) => c.videos?.length > 0 && c.videos[0]?.drive_id);

    const capIntermediate = expLevel === "junior";

    // ── Score courses by persona relevance ──
    const scoredCourses = filteredCourses.map((course) => {
      let score = 0;
      const rawTags = [
        ...(Array.isArray(course.ai_tags) ? course.ai_tags : []),
        ...(Array.isArray(course.canonical_tags) ? course.canonical_tags : []),
      ];
      if (course.tags?.topic) rawTags.push(course.tags.topic);
      if (course.tags?.industry) rawTags.push(course.tags.industry);
      const courseTags = rawTags.map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
      const courseTitle = (course.title || course.name || "").toLowerCase();
      const combinedText = `${courseTitle} ${courseTags.join(" ")}`;

      // ── Boost keywords (+5 title, +3 tag) ──
      for (const keyword of rules.boostKeywords) {
        const kw = keyword.toLowerCase();
        if (courseTitle.includes(kw)) score += 10;
        if (courseTags.some((tag) => tag.includes(kw))) score += 6;
      }

      // ── Penalty keywords (-10 per match) ──
      for (const keyword of rules.penaltyKeywords) {
        const kw = keyword.toLowerCase();
        if (combinedText.includes(kw)) score -= 10;
      }

      // ── Industry filter ──
      const courseIndustry = (course.tags?.industry || "general").toLowerCase();
      const personaIndustryMap = {
        indie_isaac: "games",
        logic_liam: "games",
        animator_alex: "animation",
        rigger_regina: "animation",
        designer_cpg: "visualization",
        architect_amy: "architecture",
        simulation_sam: "simulation",
        vfx_victor: "vfx",
        automotive_andy: "automotive",
      };
      const personaIndustry = personaIndustryMap[detectedPersona.id] || "general";

      if (courseIndustry !== "general" && courseIndustry !== personaIndustry) score -= 200;
      if (courseIndustry === personaIndustry && courseIndustry !== "general") score += 15;

      // ── Industry-specific course-title penalties ──
      const industryFilters = [
        {
          match: [
            "legacy production",
            "virtual production",
            "broadcast",
            "live action",
            "compositing",
            "stage operator",
            "icvfx",
            "ndisplay",
            "cinematography",
            "film production",
            "in-camera",
            "on-set",
          ],
          allowPersonas: ["animation", "vfx", "film", "media"],
        },
        {
          match: [
            "for automotive",
            "automotive",
            "vehicle design",
            "configurator",
            "car paint",
            "vred",
          ],
          allowPersonas: ["automotive"],
        },
        {
          match: [
            "archviz",
            "architectural",
            "twinmotion",
            "for architecture",
            "for design",
            "for aec",
            "aeco",
            " aec",
          ],
          allowPersonas: ["architecture", "design"],
        },
        {
          match: ["digital twin", "crowd simulation"],
          allowPersonas: ["simulation", "enterprise"],
        },
        {
          match: ["manufacturing", "factory", "assembly line"],
          allowPersonas: ["manufacturing", "enterprise"],
        },
      ];
      for (const filter of industryFilters) {
        const titleHit = filter.match.some((kw) => courseTitle.includes(kw));
        if (titleHit && !filter.allowPersonas.includes(personaIndustry)) {
          score -= 200;
          break;
        }
      }

      // Penalize executive/management content
      if (
        courseTitle.includes("executive") ||
        courseTitle.includes("leadership") ||
        courseTitle.includes("management overview")
      ) {
        score -= 200;   // same severity as industry mismatch
      }

      // Penalize advanced topics for beginners
      if (expLevel === "beginner") {
        const advancedTopics = [
          "multiplayer",
          "networking",
          "dedicated server",
          "optimization",
          "profiling",
          "c++ programming",
          "source control",
          "packaging",
          "deployment",
        ];
        for (const topic of advancedTopics) {
          if (combinedText.includes(topic)) score -= 15;
        }
      }

      // ── Experience-gated foundation boosts (KST: bypass intros for experienced) ──
      const introBoostScale = {
        beginner: { code100: 15, intro: 20, quickstart: 15, gettingStarted: 10 },
        junior:   { code100: 10, intro: 10, quickstart: 5,  gettingStarted: 5  },
        mid:      { code100: 5,  intro: 5,  quickstart: 0,  gettingStarted: 0  },
        senior:   { code100: 5,  intro: 5,  quickstart: 0,  gettingStarted: 0  },
      };
      const iBoost = introBoostScale[expLevel] || introBoostScale.beginner;
      if (course.code?.startsWith("100")) score += iBoost.code100;
      if (courseTitle.includes("introduction")) score += iBoost.intro;
      if (courseTitle.includes("intro") && !courseTitle.includes("introduction")) score += iBoost.intro;
      if (courseTitle.includes("quickstart") || courseTitle.includes("your first")) score += iBoost.quickstart;
      if (courseTitle.includes("getting started")) score += iBoost.gettingStarted;
      if (courseTitle.includes("fundamental") && score >= 0) score += 10;

      // ── Activate persona preferences (PBR + "Why" research) ──
      const prefs = detectedPersona.preferences || {};

      // Depth preference: penalize level mismatches
      const courseLevel = (course.tags?.level || "").toLowerCase();
      if (prefs.depth === "high" && courseLevel === "beginner") score -= 8;
      if (prefs.depth === "low" && courseLevel === "advanced") score -= 15;

      // prefersUnderTheHood: boost architecture/systems courses
      if (prefs.prefersUnderTheHood) {
        if (/architect|system|api|engine|internal|pipeline|framework|c\+\+|code|programming/.test(combinedText)) score += 8;
      }

      // prefersVisual: boost art/visual/creative courses
      if (prefs.prefersVisual) {
        if (/lighting|material|camera|visual|render|sequencer|animation|niagara|particle|texture/.test(combinedText)) score += 8;
      }

      // avoidMarketing: penalize marketing/overview courses
      if (prefs.avoidMarketing) {
        if (/marketing|overview|showcase|spotlight|enterprise|business/.test(combinedText)) score -= 12;
      }

      // ── Goal-text matching (TTF: startPrompt influences results) ──
      if (answers.startPrompt) {
        const goalWords = answers.startPrompt
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3 && !["want", "need", "like", "make", "learn", "with", "that", "this", "from", "have", "will", "been", "they", "were"].includes(w));
        for (const word of goalWords) {
          if (combinedText.includes(word)) score += 8;
        }
      }

      const learningOutcome = buildLearningOutcome(course.videos, course.ai_tags);

      return { ...course, relevanceScore: score, learningOutcome };
    });

    // Sort by relevance
    const sortedCourses = scoredCourses.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Deduplicate by normalized title
    const seenTitles = new Set();
    let dedupedCourses = sortedCourses.filter((course) => {
      const normalizedTitle = (course.title || course.name || "")
        .toLowerCase()
        .replace(/\s+for\s+(games|automotive|aec|architecture|simulation|film).*$/i, "")
        .replace(/[^a-z0-9]/g, "")
        .replace(/\d+$/g, "");
      if (seenTitles.has(normalizedTitle)) return false;
      seenTitles.add(normalizedTitle);
      return true;
    });

    // Junior cap: limit intermediate courses to 30% of final set
    if (capIntermediate) {
      let intermediateCount = 0;
      const maxIntermediate = 3;
      dedupedCourses = dedupedCourses.filter((c) => {
        const level = (c.tags?.level || "").toLowerCase();
        if (level === "intermediate") {
          if (intermediateCount >= maxIntermediate) return false;
          intermediateCount++;
        }
        return true;
      });
    }

    // Only keep playable courses
    dedupedCourses = dedupedCourses.filter(
      (c) => c.videos?.length > 0 && c.videos.some((v) => v.drive_id)
    );

    // ── Topic diversity guard (CLT: prevent "Tutorial Hell" intro flooding) ──
    const introPattern = /^(introduction|quickstart|getting started|your first|intro to)/i;
    let introCount = 0;
    dedupedCourses = dedupedCourses.filter((c) => {
      const title = (c.title || c.name || "");
      if (introPattern.test(title)) {
        introCount++;
        if (introCount > 2) return false;
      }
      return true;
    });

    // Take top 8
    dedupedCourses = dedupedCourses.slice(0, 8);

    // ── Required topics coverage: swap in missing topics ──
    if (rules.requiredTopics && rules.requiredTopics.length > 0) {
      for (const topic of rules.requiredTopics) {
        const topicLower = topic.toLowerCase();
        const hasTopic = dedupedCourses.some((c) => {
          const title = (c.title || c.name || "").toLowerCase();
          const tags = [
            ...(Array.isArray(c.ai_tags) ? c.ai_tags : []),
            ...(Array.isArray(c.canonical_tags) ? c.canonical_tags : []),
          ]
            .map((t) => (typeof t === "string" ? t.toLowerCase() : ""))
            .join(" ");
          return title.includes(topicLower) || tags.includes(topicLower);
        });

        if (!hasTopic) {
          const candidate = sortedCourses.find((c) => {
            if (dedupedCourses.some((d) => d.code === c.code)) return false;
            const title = (c.title || c.name || "").toLowerCase();
            const tags = [
              ...(Array.isArray(c.ai_tags) ? c.ai_tags : []),
              ...(Array.isArray(c.canonical_tags) ? c.canonical_tags : []),
            ]
              .map((t) => (typeof t === "string" ? t.toLowerCase() : ""))
              .join(" ");
            return title.includes(topicLower) || tags.includes(topicLower);
          });
          if (candidate && dedupedCourses.length >= 8) {
            dedupedCourses[dedupedCourses.length - 1] = candidate;
          } else if (candidate) {
            dedupedCourses.push(candidate);
          }
        }
      }
      dedupedCourses.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    // Add milestones
    const pathWithMilestones = addMilestones(dedupedCourses);
    const totalMinutes =
      pathWithMilestones.length > 0
        ? pathWithMilestones[pathWithMilestones.length - 1]._totalMinutes
        : 0;

    setGeneratedPath({
      persona: detectedPersona,
      courses: pathWithMilestones,
      totalTime: totalMinutes,
      messaging: getPainPointMessaging(detectedPersona),
      source: "local",
    });

    await fetchBlendedPath();
  };

  const reset = () => {
    setGeneratedPath(null);
    setBlendedPath(null);
    resetRAG();
  };

  return {
    courses,
    detectedPersona,
    generatedPath,
    blendedPath,
    isRAGLoading,
    ragState,
    ragError,
    RAG_STATES,
    handleGeneratePath,
    reset,
  };
}
