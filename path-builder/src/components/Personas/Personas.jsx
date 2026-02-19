import React, { useState, useMemo } from "react";
import {
  getPainPointMessaging,
  getPersonaById,
  personaScoringRules,
} from "../../services/PersonaService";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import { useTagData } from "../../context/TagDataContext";
import { buildLearningOutcome } from "../../utils/videoTopicExtractor";
import useOnboardingRAG from "../../hooks/useOnboardingRAG";
import { logOnboardingRAG } from "../../services/onboardingTelemetry";
import {
  Rocket,
  Clapperboard,
  Gamepad2,
  Wand2,
  Wrench,
  Map,
  Target,
  BookOpen,
  Clock,
  BarChart,
  Zap,
  Trophy,
  Play,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Loader,
  MessageSquare,
  Code2,
  Palette,
  Bone,
  Diamond,
} from "lucide-react";
import "./Personas.css";

// ─────────── 4-Step Question Flow ───────────
const QUESTIONS = [
  {
    id: "startPrompt",
    question: "What do you want to learn in UE5?",
    subtitle: "Describe in your own words (optional — helps personalize your path)",
    type: "freetext",
    placeholder: "e.g. I want to make a small RPG with inventory and combat...",
  },
  {
    id: "role",
    question: "Which best describes your role?",
    subtitle: "This determines your learning persona",
    type: "choice",
    options: [
      {
        value: "indie_isaac",
        label: "Indie Game Dev",
        description: "Solo/small-team — prototype fast, ship it",
        icon: Gamepad2,
      },
      {
        value: "logic_liam",
        label: "Games Programmer",
        description: "Architecture, systems, performance",
        icon: Code2,
      },
      {
        value: "animator_alex",
        label: "Animator / Film Artist",
        description: "Cinematics, sequencer, real-time previews",
        icon: Clapperboard,
      },
      {
        value: "rigger_regina",
        label: "Rigger / Character TD",
        description: "Control Rig, deformation, retargeting",
        icon: Bone,
      },
      {
        value: "designer_cpg",
        label: "Designer (Retail/CPG)",
        description: "Product viz, lighting, stunning visuals",
        icon: Diamond,
      },
    ],
  },
  {
    id: "experience",
    question: "How many years of 3D / game engine experience do you have?",
    type: "choice",
    options: [
      {
        value: "beginner",
        label: "0–1 years",
        description: "Brand new to 3D or engines",
        icon: Sparkles,
      },
      {
        value: "junior",
        label: "2–5 years",
        description: "Used Maya, Blender, or another engine",
        icon: Palette,
      },
      {
        value: "mid",
        label: "5–10 years",
        description: "Professional with shipped work",
        icon: Wand2,
      },
      { value: "senior", label: "10+ years", description: "Senior / lead level", icon: Wrench },
    ],
  },
  {
    id: "goal",
    question: "What do you want to achieve in your first 10 hours?",
    type: "choice",
    options: [
      { value: "explore", label: "Explore and understand UE5", icon: Map },
      { value: "project", label: "Start a specific project", icon: Target },
      { value: "skill", label: "Learn a specific skill", icon: BookOpen },
      { value: "portfolio", label: "Build a portfolio piece", icon: Trophy },
      { value: "transition", label: "Transition from another tool", icon: ArrowRight },
    ],
  },
];

/**
 * Onboarding Path Builder - Help new learners get over the 5-10hr hump
 */
export default function Personas() {
  const { courses } = useTagData();
  const [step, setStep] = useState(0); // Quiz step
  const [answers, setAnswers] = useState({
    startPrompt: "",
    role: null,
    experience: null,
    goal: null,
  });
  const [generatedPath, setGeneratedPath] = useState(null);

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
        // Reject if tagged for a different industry
        if (cIndustry !== "general" && cIndustry !== pIndustry) return false;
        // Reject if title contains industry-specific keywords for wrong persona
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

      if (industryFilteredCourses.length > 0) {
        // Add milestones + outcomes
        let totalMinutes = 0;
        const pathWithMilestones = industryFilteredCourses.slice(0, 8).map((course, idx) => {
          const duration = course.duration || 45;
          totalMinutes += duration;
          const learningOutcome = buildLearningOutcome(course.videos, course.ai_tags);
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
          };
        });

        setGeneratedPath({
          persona: detectedPersona,
          courses: pathWithMilestones,
          totalTime: totalMinutes,
          messaging: getPainPointMessaging(detectedPersona),
          source: "rag",
        });
        return;
      }
    }

    // RAG failed or no playable courses — fall back to local scoring
    generatePath();
  };

  // ─────────── Generate the 10-hour path (local fallback) ───────────
  const generatePath = () => {
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
      // Playability filter: must have at least one video with a drive_id
      .filter((c) => c.videos?.length > 0 && c.videos[0]?.drive_id);

    // For junior: cap intermediate at 30% of final results (applied post-sort)
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
        if (courseTitle.includes(kw)) score += 5;
        if (courseTags.some((tag) => tag.includes(kw))) score += 3;
      }

      // ── Penalty keywords (-10 per match) ──
      for (const keyword of rules.penaltyKeywords) {
        const kw = keyword.toLowerCase();
        if (combinedText.includes(kw)) score -= 10;
      }

      // ── Industry filter (kept from original) ──
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

      if (courseIndustry !== "general" && courseIndustry !== personaIndustry) {
        score -= 200;
      }
      if (courseIndustry === personaIndustry && courseIndustry !== "general") {
        score += 15;
      }

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
            "aeco",
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
        score -= 30;
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

      // STRONGLY boost foundation courses
      if (course.code?.startsWith("100")) score += 40;
      if (courseTitle.includes("introduction")) score += 50;
      if (courseTitle.includes("intro") && !courseTitle.includes("introduction")) score += 40;
      if (courseTitle.includes("quickstart") || courseTitle.includes("your first")) score += 35;
      if (courseTitle.includes("getting started")) score += 30;
      if (courseTitle.includes("fundamental") && score >= 0) score += 10;

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
      const maxIntermediate = 3; // 30% of 8
      dedupedCourses = dedupedCourses.filter((c) => {
        const level = (c.tags?.level || "").toLowerCase();
        if (level === "intermediate") {
          if (intermediateCount >= maxIntermediate) return false;
          intermediateCount++;
        }
        return true;
      });
    }

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
          // Find best course covering this topic from the full sorted list
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
            // Swap out the lowest-scoring course
            dedupedCourses[dedupedCourses.length - 1] = candidate;
          } else if (candidate) {
            dedupedCourses.push(candidate);
          }
        }
      }
      // Re-sort after swaps
      dedupedCourses.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    // Add milestones
    let totalMinutes = 0;
    const pathWithMilestones = dedupedCourses.map((course, idx) => {
      const duration = course.duration || 45;
      totalMinutes += duration;

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
      };
    });

    setGeneratedPath({
      persona: detectedPersona,
      courses: pathWithMilestones,
      totalTime: totalMinutes,
      messaging: getPainPointMessaging(detectedPersona),
      source: "local",
    });
  };

  // Track which course (if any) is being watched in GuidedPlayer
  const [watchingCourse, setWatchingCourse] = useState(null);

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Auto-advance for choice questions
    if (QUESTIONS[step].type === "choice" && step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePromptSubmit = () => {
    // Advance past free-text step
    if (step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
    }
  };

  const resetQuiz = () => {
    setStep(0);
    setAnswers({ startPrompt: "", role: null, experience: null, goal: null });
    setGeneratedPath(null);
    setWatchingCourse(null);
    resetRAG();
    localStorage.removeItem("detected_persona");
  };

  const switchPersona = () => {
    // Return to role selection (step 1), keep startPrompt
    setStep(1);
    setAnswers((prev) => ({ ...prev, role: null, experience: null, goal: null }));
    setGeneratedPath(null);
    setWatchingCourse(null);
    resetRAG();
    localStorage.removeItem("detected_persona");
  };

  // Check if all required questions answered
  const allAnswered = answers.role && answers.experience && answers.goal;

  // Current question
  const currentQ = QUESTIONS[step];

  return (
    <div className="personas-page">
      <header className="personas-header">
        <h1>
          <Rocket size={24} className="icon-inline" /> New to UE5? Let's Get You Started
        </h1>
        <p className="personas-subtitle">
          Answer a few quick questions and we'll create your personalized first 10-hour learning
          path
        </p>
      </header>

      {isRAGLoading ? (
        /* RAG Pipeline Loading State */
        <section className="quiz-section rag-loading">
          <div className="rag-loader">
            <Loader size={40} className="spin-icon" />
            <h2>
              {ragState === RAG_STATES.PLANNING && "Analyzing your profile..."}
              {ragState === RAG_STATES.SEARCHING && "Searching course library..."}
              {ragState === RAG_STATES.ASSEMBLING && "Building your curriculum..."}
            </h2>
            <p className="rag-loader-sub">
              {ragState === RAG_STATES.PLANNING && "Our AI is understanding your learning goals"}
              {ragState === RAG_STATES.SEARCHING && "Finding the most relevant video segments"}
              {ragState === RAG_STATES.ASSEMBLING && "Crafting a personalized learning path"}
            </p>
            <div className="rag-progress-bar">
              <div
                className="rag-progress-fill"
                style={{
                  width:
                    ragState === RAG_STATES.PLANNING
                      ? "33%"
                      : ragState === RAG_STATES.SEARCHING
                        ? "66%"
                        : "90%",
                }}
              />
            </div>
          </div>
        </section>
      ) : !generatedPath ? (
        <>
          {/* Progress indicator */}
          <div className="quiz-progress">
            {QUESTIONS.map((q, i) => (
              <div
                key={q.id}
                className={`progress-step ${i <= step ? "active" : ""} ${
                  q.type === "freetext"
                    ? answers[q.id]
                      ? "completed"
                      : i < step
                        ? "completed"
                        : ""
                    : answers[q.id]
                      ? "completed"
                      : ""
                }`}
              >
                {(q.type === "freetext" ? i < step : answers[q.id]) ? <Check size={16} /> : i + 1}
              </div>
            ))}
          </div>

          {/* RAG error banner */}
          {ragError && (
            <div className="rag-error-banner">
              ⚠️ AI personalization unavailable — using local recommendations instead.
            </div>
          )}

          {/* Current question */}
          <section className="quiz-section">
            <h2>{currentQ.question}</h2>
            {currentQ.subtitle && <p className="quiz-subtitle">{currentQ.subtitle}</p>}

            {currentQ.type === "freetext" ? (
              /* Free-text input */
              <div className="freetext-input">
                <div className="freetext-wrapper">
                  <MessageSquare size={18} className="freetext-icon" />
                  <textarea
                    value={answers.startPrompt}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, startPrompt: e.target.value }))
                    }
                    placeholder={currentQ.placeholder}
                    rows={3}
                    className="freetext-textarea"
                  />
                </div>
                <button className="freetext-next" onClick={handlePromptSubmit}>
                  {answers.startPrompt ? "Next" : "Skip"} <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              /* Choice options */
              <div className="quiz-options">
                {currentQ.options.map((option) => {
                  const Icon = option.icon || Sparkles;
                  return (
                    <button
                      key={option.value}
                      className={`quiz-option ${answers[currentQ.id] === option.value ? "selected" : ""}`}
                      onClick={() => handleAnswer(currentQ.id, option.value)}
                    >
                      <span className="option-icon-wrapper">
                        <Icon size={18} />
                      </span>
                      <span className="option-content">
                        <span className="option-label">{option.label}</span>
                        {option.description && (
                          <span className="option-description">{option.description}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Navigation */}
            <div className="quiz-nav">
              {step > 0 && (
                <button className="quiz-back" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {allAnswered && (
                <button
                  className="quiz-generate"
                  onClick={handleGeneratePath}
                  disabled={isRAGLoading}
                >
                  Generate My Path <ArrowRight size={16} />
                </button>
              )}
            </div>
          </section>

          {/* Persona preview */}
          {detectedPersona && (
            <div className="persona-preview">
              <span className="preview-icon">
                {detectedPersona.emoji ? (
                  <span style={{ fontSize: "32px" }}>{detectedPersona.emoji}</span>
                ) : (
                  <Sparkles size={32} />
                )}
              </span>
              <div className="preview-text">
                <strong>{detectedPersona.name}</strong>
                <p>{detectedPersona.description}</p>
              </div>
            </div>
          )}
        </>
      ) : watchingCourse ? (
        /* GuidedPlayer — break out of the 900px container */
        <div className="guided-player-breakout">
          <GuidedPlayer
            courses={[watchingCourse]}
            problemSummary={`New to UE5 — ${detectedPersona?.name || "General"}, ${QUESTIONS[2].options.find((o) => o.value === answers.experience)?.label || ""}, wants to ${QUESTIONS[3].options.find((o) => o.value === answers.goal)?.label || "explore"}`}
            pathSummary={{
              path_summary: `A personalized learning path for ${generatedPath.persona.name}. This path covers foundational UE5 skills tailored to your background, starting with the essentials and building toward hands-on projects.`,
              topics_covered: generatedPath.courses.map((c) => c.title || c.name),
            }}
            onComplete={() => setWatchingCourse(null)}
            onExit={() => setWatchingCourse(null)}
          />
        </div>
      ) : (
        <>
          {/* Generated Path Results */}
          <section className="generated-path">
            <div className="path-header">
              <span className="path-icon">
                <Rocket size={40} />
              </span>
              <div>
                <h2>Your Personalized 10-Hour Path</h2>
                <p>Optimized for {generatedPath.persona.name}</p>
              </div>
              <div className="path-actions">
                <button className="switch-persona-btn" onClick={switchPersona}>
                  <RefreshCw size={14} /> Switch Persona
                </button>
                <button className="reset-btn" onClick={resetQuiz}>
                  <RefreshCw size={16} /> Start Over
                </button>
              </div>
            </div>

            {/* Persona description + messaging */}
            {detectedPersona && (
              <div className="persona-result-card">
                <div className="persona-result-header">
                  {detectedPersona.emoji && (
                    <span className="persona-emoji">{detectedPersona.emoji}</span>
                  )}
                  <div>
                    <h3>{detectedPersona.name}</h3>
                    <p>{detectedPersona.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pain point messaging */}
            <div className="motivation-messages">
              {generatedPath.messaging.map((msg, i) => (
                <div key={i} className="motivation-card">
                  {msg}
                </div>
              ))}
            </div>

            {/* Course list with milestones */}
            <div className="path-courses">
              {generatedPath.courses.map((course, idx) => (
                <div
                  key={course.code || idx}
                  className={`path-course ${course.quickWin ? "quick-win" : ""}`}
                >
                  {course.milestone && (
                    <div className="milestone-marker">
                      <Trophy size={12} className="icon-inline-small" /> {course.milestone}{" "}
                      Milestone!
                    </div>
                  )}
                  <div className="course-order">{course.order}</div>
                  <div className="course-info">
                    <h3 title={(course.title || course.name || "").replace(/_/g, " ")}>
                      {(() => {
                        let t = (course.title || course.name || "").replace(/_/g, " ");
                        const words = t.split(/\s+/);
                        const firstWord = words[0];
                        const twoWord = words.length > 2 ? `${words[0]} ${words[1]}` : "";
                        if (twoWord && t.indexOf(twoWord, twoWord.length) > 0) {
                          t = t.substring(twoWord.length).trim();
                        } else if (
                          words.length > 2 &&
                          t.toLowerCase().indexOf(firstWord.toLowerCase(), firstWord.length) > 0
                        ) {
                          t = t.substring(firstWord.length).trim();
                        }
                        t = t.replace(/^(\w+)\s+\1\b/i, "$1");
                        return t.length > 45 ? `${t.substring(0, 45)}...` : t;
                      })()}
                    </h3>
                    <div className="course-meta">
                      <span>
                        <Clock size={12} /> {course.duration || 45} min
                      </span>
                      <span>
                        <BarChart size={12} /> {Math.round((course.cumulativeTime / 60) * 10) / 10}
                        hr total
                      </span>
                      {course.quickWin && (
                        <span className="quick-win-badge">
                          <Zap size={10} /> Quick Win
                        </span>
                      )}
                    </div>
                    {/* What you'll learn */}
                    {course.learningOutcome && (
                      <p className="course-why">{course.learningOutcome}</p>
                    )}
                    {/* Watch button */}
                    {course.videos?.length > 0 && course.videos[0]?.drive_id && (
                      <button
                        className="course-watch-btn"
                        onClick={() => setWatchingCourse(course)}
                      >
                        <Play size={14} /> Watch Course
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="path-summary">
              <p>
                Total time:{" "}
                <strong>{Math.round((generatedPath.totalTime / 60) * 10) / 10} hours</strong>
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
