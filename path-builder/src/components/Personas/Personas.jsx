import React, { useState, useMemo } from "react";
import { getAllPersonas, getPainPointMessaging } from "../../services/PersonaService";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import { useTagData } from "../../context/TagDataContext";
import {
  Rocket,
  Clapperboard,
  Home,
  Gamepad2,
  Wand2,
  Car,
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
} from "lucide-react";
import "./Personas.css";

const QUESTIONS = [
  {
    id: "industry",
    question: "What industry are you coming from?",
    options: [
      {
        value: "animation",
        label: "Animation / Film",
        icon: Clapperboard,
        persona: "animator_alex",
      },
      {
        value: "architecture",
        label: "Architecture / ArchViz",
        icon: Home,
        persona: "architect_amy",
      },
      {
        value: "games",
        label: "Game Development",
        icon: Gamepad2,
        persona: "gamedev_gary",
      },
      {
        value: "vfx",
        label: "VFX / Compositing",
        icon: Wand2,
        persona: "vfx_victor",
      },
      {
        value: "automotive",
        label: "Automotive / Product Viz",
        icon: Car,
        persona: "automotive_andy",
      },
      {
        value: "other",
        label: "Industrial / Simulation / Other",
        icon: Wrench,
        persona: "simulation_sam",
      },
    ],
  },
  {
    id: "experience",
    question: "What's your experience with 3D software?",
    options: [
      { value: "none", label: "Brand new to 3D", icon: Sparkles },
      {
        value: "some",
        label: "Used Maya, Blender, or similar",
        icon: () => <div className="icon-placeholder">●</div>,
      },
      {
        value: "experienced",
        label: "Professional 3D artist/developer",
        icon: () => <div className="icon-placeholder">●●</div>,
      },
    ],
  },
  {
    id: "goal",
    question: "What do you want to achieve in your first 10 hours?",
    options: [
      { value: "explore", label: "Just explore and understand UE5", icon: Map },
      { value: "project", label: "Start a specific project", icon: Target },
      {
        value: "skill",
        label: "Learn a specific skill (lighting, animation, etc.)",
        icon: BookOpen,
      },
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
    industry: null,
    experience: null,
    goal: null,
  });
  const [generatedPath, setGeneratedPath] = useState(null);

  const allPersonas = useMemo(() => getAllPersonas(), []);

  // Get detected persona based on answers
  const detectedPersona = useMemo(() => {
    const industryPart = answers.industry;
    if (!industryPart) return null;

    // We assume questions[0] is always "Industry"
    const industryOption = QUESTIONS[0].options.find((o) => o.value === industryPart);

    if (!industryOption) return null;
    return allPersonas.find((p) => p.id === industryOption.persona);
  }, [answers.industry, allPersonas]);

  // Generate the 10-hour path
  const generatePath = () => {
    if (!detectedPersona || !courses) return;

    // Filter beginner-friendly courses (level lives inside tags object)
    const beginnerCourses = courses
      .filter((c) => {
        const level = (c.tags?.level || "").toLowerCase();
        return level === "beginner" || level === "" || level === "general";
      })
      // Playability filter: must have at least one video with a drive_id
      .filter((c) => c.videos?.length > 0 && c.videos[0]?.drive_id);

    // Score courses by persona relevance
    const scoredCourses = beginnerCourses.map((course) => {
      let score = 0;
      // Use ai_tags + canonical_tags (actual arrays) instead of tags object
      const rawTags = [
        ...(Array.isArray(course.ai_tags) ? course.ai_tags : []),
        ...(Array.isArray(course.canonical_tags) ? course.canonical_tags : []),
      ];
      // Also include metadata fields from tags object
      if (course.tags?.topic) rawTags.push(course.tags.topic);
      if (course.tags?.industry) rawTags.push(course.tags.industry);
      const courseTags = rawTags.map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
      const courseTitle = (course.title || course.name || "").toLowerCase();
      const combinedText = `${courseTitle} ${courseTags.join(" ")}`;

      // Check persona keywords - POSITIVE score
      for (const keyword of detectedPersona.keywords) {
        if (courseTitle.includes(keyword.toLowerCase())) {
          score += 5;
        }
        if (courseTags.some((tag) => tag.includes(keyword.toLowerCase()))) {
          score += 3;
        }
      }

      // Check OTHER personas - NEGATIVE score for conflicting content
      const otherPersonas = allPersonas.filter((p) => p.id !== detectedPersona.id);
      for (const otherPersona of otherPersonas) {
        for (const keyword of otherPersona.keywords) {
          // Strong penalty if title contains another persona's keywords
          if (courseTitle.includes(keyword.toLowerCase())) {
            // Skip common words that appear in multiple personas
            if (
              !["animation", "character", "lighting", "material", "blueprint"].includes(
                keyword.toLowerCase()
              )
            ) {
              score -= 8;
            }
          }
        }
      }

      // Exclude automotive/HMI content for non-automotive personas
      if (detectedPersona.id !== "automotive_andy") {
        if (
          combinedText.includes("hmi") ||
          combinedText.includes("automotive") ||
          combinedText.includes("vehicle") ||
          combinedText.includes("car configurator")
        ) {
          score -= 15;
        }
      }

      // Exclude archviz content for non-architect personas
      if (detectedPersona.id !== "architect_amy") {
        if (combinedText.includes("archviz") || combinedText.includes("architectural")) {
          score -= 15;
        }
      }

      // === Industry-Aware Filtering ===
      // Courses tagged for a specific non-matching industry get heavy penalty
      const courseIndustry = (course.tags?.industry || "general").toLowerCase();
      const personaIndustryMap = {
        game_dev_gary: "games",
        animator_alex: "general", // animators use general content
        vfx_victor: "general",
        archviz_ava: "architecture",
        auto_adam: "automotive",
        sim_sam: "simulation",
      };
      const personaIndustry = personaIndustryMap[detectedPersona.id] || "general";

      if (courseIndustry !== "general" && courseIndustry !== personaIndustry) {
        // Non-matching industry-specific content: hard penalty
        score -= 50;
      }
      // Bonus for matching industry
      if (courseIndustry === personaIndustry && courseIndustry !== "general") {
        score += 15;
      }

      // Penalize executive/management content for hands-on learner personas
      if (
        courseTitle.includes("executive") ||
        courseTitle.includes("leadership") ||
        courseTitle.includes("management overview")
      ) {
        score -= 30;
      }

      // Penalize film/broadcast production courses for non-film personas
      const isFilmPersona = personaIndustry === "animation" || personaIndustry === "film";
      if (
        !isFilmPersona &&
        (courseTitle.includes("legacy production") ||
          courseTitle.includes("virtual production") ||
          courseTitle.includes("broadcast") ||
          courseTitle.includes("live action") ||
          courseTitle.includes("compositing") ||
          courseTitle.includes("stage operator"))
      ) {
        score -= 60;
      }

      // Penalize advanced topics for beginners
      const advancedTopics = [
        "multiplayer",
        "networking",
        "dedicated server",
        "optimization",
        "profiling",
        "c++ programming",
        "source control",
        "version control",
        "packaging",
        "deployment",
      ];
      for (const topic of advancedTopics) {
        if (combinedText.includes(topic)) score -= 15;
      }

      // STRONGLY boost foundation courses - intro should be FIRST
      // Boost 100.xx series courses (foundation/intro series)
      if (course.code?.startsWith("100")) score += 40;
      // Tiered approach: intro > quickstart/first project > getting started > fundamental
      if (courseTitle.includes("introduction")) score += 50; // Intro courses at very top
      if (courseTitle.includes("intro") && !courseTitle.includes("introduction")) score += 40;
      if (courseTitle.includes("quickstart") || courseTitle.includes("your first")) score += 35;
      if (courseTitle.includes("getting started")) score += 30;
      if (courseTitle.includes("fundamental") && score >= 0) score += 10;

      // Extract learning outcomes from video filenames
      // Video names like "100.01_04_ProjectStructure_55.mp4" → "Project Structure"
      const SKIP_TOPICS = new Set([
        "intro",
        "introduction",
        "outro",
        "summary",
        "review",
        "overview",
        "welcome",
      ]);
      const learningTopics = (course.videos || [])
        .map((v) => {
          const name = (v.name || "").replace(/\.[^.]+$/, ""); // strip extension
          // Extract the descriptive part (e.g., "ProjectBrowser" from "100.01_09_ProjectBrowser_55")
          const parts = name
            .split("_")
            .filter((p) => p.length > 3 && !/^[\d.]+$/.test(p) && !/^\d{1,3}$/.test(p));
          // The descriptive part is usually the longest non-numeric segment
          const topic = parts.reduce((best, p) => (p.length > best.length ? p : best), "");
          // Convert camelCase/PascalCase to spaced words
          return topic
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
        })
        .filter((t) => t.length > 3 && !SKIP_TOPICS.has(t.toLowerCase()))
        // Deduplicate
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .slice(0, 5);

      const learningOutcome =
        learningTopics.length > 0
          ? `You'll learn: ${learningTopics.join(", ")}`
          : (course.ai_tags || []).slice(0, 4).join(", ");

      return { ...course, relevanceScore: score, learningOutcome };
    });

    // Sort by relevance and deduplicate (multiple industry versions of same course exist)
    const sortedCourses = scoredCourses.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Deduplicate by normalized title (strip industry suffix + punctuation)
    const seenTitles = new Set();
    const dedupedCourses = sortedCourses
      .filter((course) => {
        const normalizedTitle = (course.title || course.name || "")
          .toLowerCase()
          .replace(/\s+for\s+(games|automotive|aec|architecture|simulation|film).*$/i, "") // strip "for [Industry]" suffix
          .replace(/[^a-z0-9]/g, "") // strip punctuation/spaces
          .replace(/\d+$/g, ""); // strip trailing version numbers
        if (seenTitles.has(normalizedTitle)) return false;
        seenTitles.add(normalizedTitle);
        return true;
      })
      .slice(0, 8);

    // Add milestones
    let totalMinutes = 0;
    const pathWithMilestones = dedupedCourses.map((course, idx) => {
      const duration = course.duration || 45; // default 45 min
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
        quickWin: idx < 2, // First 2 courses are "quick wins"
      };
    });

    setGeneratedPath({
      persona: detectedPersona,
      courses: pathWithMilestones,
      totalTime: totalMinutes,
      messaging: getPainPointMessaging(detectedPersona),
    });
  };

  // Track which course (if any) is being watched in GuidedPlayer
  const [watchingCourse, setWatchingCourse] = useState(null);

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
    }
  };

  const resetQuiz = () => {
    setStep(0);
    setAnswers({ industry: null, experience: null, goal: null });
    setGeneratedPath(null);
  };

  // Check if all questions answered
  const allAnswered = answers.industry && answers.experience && answers.goal;

  return (
    <div className="personas-page">
      <header className="personas-header">
        <h1>
          <Rocket size={24} className="icon-inline" /> New to UE5? Let's Get You Started
        </h1>
        <p className="personas-subtitle">
          Answer 3 quick questions and we'll create your personalized first 10-hour learning path
        </p>
      </header>

      {!generatedPath ? (
        <>
          {/* Progress indicator */}
          <div className="quiz-progress">
            {QUESTIONS.map((q, i) => (
              <div
                key={q.id}
                className={`progress-step ${i <= step ? "active" : ""} ${answers[q.id] ? "completed" : ""}`}
              >
                {answers[q.id] ? <Check size={16} /> : i + 1}
              </div>
            ))}
          </div>

          {/* Current question */}
          <section className="quiz-section">
            <h2>{QUESTIONS[step].question}</h2>
            <div className="quiz-options">
              {QUESTIONS[step].options.map((option) => {
                const Icon = option.icon || Sparkles;
                return (
                  <button
                    key={option.value}
                    className={`quiz-option ${answers[QUESTIONS[step].id] === option.value ? "selected" : ""}`}
                    onClick={() => handleAnswer(QUESTIONS[step].id, option.value)}
                  >
                    <span className="option-icon-wrapper">
                      <Icon size={18} />
                    </span>
                    <span className="option-label">{option.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="quiz-nav">
              {step > 0 && (
                <button className="quiz-back" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {allAnswered && (
                <button className="quiz-generate" onClick={generatePath}>
                  Generate My Path <ArrowRight size={16} />
                </button>
              )}
            </div>
          </section>

          {/* Persona preview */}
          {detectedPersona && (
            <div className="persona-preview">
              <span className="preview-icon">
                <Sparkles size={32} />
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
              <button className="reset-btn" onClick={resetQuiz}>
                <RefreshCw size={16} /> Start Over
              </button>
            </div>

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
                        // Strip leading category if it reappears later:
                        // "Control Rig Introduction to Control Rig" → "Introduction to Control Rig"
                        // "Landscape Quickstart Landscape" → "Landscape Quickstart"
                        const words = t.split(/\s+/);
                        const firstWord = words[0];
                        // Check if 1-2 leading words form a category that appears again later
                        const twoWord = words.length > 2 ? `${words[0]} ${words[1]}` : "";
                        if (twoWord && t.indexOf(twoWord, twoWord.length) > 0) {
                          t = t.substring(twoWord.length).trim();
                        } else if (
                          words.length > 2 &&
                          t.toLowerCase().indexOf(firstWord.toLowerCase(), firstWord.length) > 0
                        ) {
                          t = t.substring(firstWord.length).trim();
                        }
                        // Also collapse "Blueprint Blueprint" → "Blueprint"
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
