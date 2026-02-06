import React, { useState, useMemo } from "react";
import { getAllPersonas, getPainPointMessaging } from "../../services/PersonaService";
import { useTagData } from "../../context/TagDataContext";
import "./Personas.css";

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

  // Quiz questions
  const questions = [
    {
      id: "industry",
      question: "What industry are you coming from?",
      options: [
        { value: "animation", label: "🎭 Animation / Film", persona: "animator_alex" },
        { value: "architecture", label: "🏛️ Architecture / ArchViz", persona: "architect_amy" },
        { value: "games", label: "🎮 Game Development", persona: "gamedev_gary" },
        { value: "vfx", label: "✨ VFX / Compositing", persona: "vfx_victor" },
        { value: "automotive", label: "🚗 Automotive / Product Viz", persona: "automotive_andy" },
        { value: "other", label: "🔧 Industrial / Simulation / Other", persona: "simulation_sam" },
      ],
    },
    {
      id: "experience",
      question: "What's your experience with 3D software?",
      options: [
        { value: "none", label: "Brand new to 3D" },
        { value: "some", label: "Used Maya, Blender, or similar" },
        { value: "experienced", label: "Professional 3D artist/developer" },
      ],
    },
    {
      id: "goal",
      question: "What do you want to achieve in your first 10 hours?",
      options: [
        { value: "explore", label: "🗺️ Just explore and understand UE5" },
        { value: "project", label: "🎯 Start a specific project" },
        { value: "skill", label: "📚 Learn a specific skill (lighting, animation, etc.)" },
      ],
    },
  ];

  // Get detected persona based on answers
  const detectedPersona = useMemo(() => {
    if (!answers.industry) return null;
    const industryOption = questions[0].options.find((o) => o.value === answers.industry);
    if (!industryOption) return null;
    return allPersonas.find((p) => p.id === industryOption.persona);
  }, [answers.industry, allPersonas]);

  // Generate the 10-hour path
  const generatePath = () => {
    if (!detectedPersona || !courses) return;

    // Filter beginner-friendly courses
    const beginnerCourses = courses.filter(
      (c) => c.level === "Beginner" || c.level === "beginner" || !c.level
    );

    // Score courses by persona relevance
    const scoredCourses = beginnerCourses.map((course) => {
      let score = 0;
      // Handle tags that might be array, object, or undefined
      const rawTags = Array.isArray(course.tags) ? course.tags : [];
      const courseTags = rawTags.map((t) =>
        typeof t === "string" ? t.toLowerCase() : (t?.name || t?.displayName || "").toLowerCase()
      );
      const courseTitle = (course.title || course.name || "").toLowerCase();
      const combinedText = `${courseTitle} ${courseTags.join(" ")}`;

      // Check persona keywords - POSITIVE score
      for (const keyword of detectedPersona.keywords) {
        if (courseTitle.includes(keyword.toLowerCase())) score += 5;
        if (courseTags.some((tag) => tag.includes(keyword.toLowerCase()))) score += 3;
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

      // Exclude Film/TV/Virtual Production content for game dev personas
      if (detectedPersona.id === "game_dev_gary") {
        if (
          combinedText.includes("virtual production") ||
          combinedText.includes("film") ||
          combinedText.includes("cinematics") ||
          combinedText.includes("movie")
        ) {
          score -= 15;
        }
      }

      // Exclude game-specific content for film/animation personas
      if (detectedPersona.id === "animator_alex" || detectedPersona.id === "vfx_victor") {
        if (
          combinedText.includes("gameplay") ||
          combinedText.includes("multiplayer") ||
          combinedText.includes("game mode")
        ) {
          score -= 10;
        }
      }

      // Penalize advanced topics for beginners
      const advancedTopics = [
        "mobile app",
        "deployment",
        "packaging",
        "multiplayer",
        "networking",
        "dedicated server",
        "optimization",
        "profiling",
        "c++ programming",
        "source control",
        "version control",
        "testing", // testing comes after fundamentals
      ];
      for (const topic of advancedTopics) {
        if (combinedText.includes(topic)) {
          score -= 15;
        }
      }

      // STRONGLY boost foundation courses - intro should be FIRST
      // Tiered approach: intro > quickstart/first project > getting started > fundamental
      if (courseTitle.includes("introduction")) score += 50; // Intro courses at very top
      if (courseTitle.includes("quickstart") || courseTitle.includes("your first")) score += 35;
      if (courseTitle.includes("getting started")) score += 30;
      if (courseTitle.includes("fundamental") && score >= 0) score += 10;

      return { ...course, relevanceScore: score };
    });

    // Sort by relevance and pick top courses
    const sortedCourses = scoredCourses
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);

    // Add milestones
    let totalMinutes = 0;
    const pathWithMilestones = sortedCourses.map((course, idx) => {
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

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (step < questions.length - 1) {
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
        <h1>🚀 New to UE5? Let's Get You Started</h1>
        <p className="personas-subtitle">
          Answer 3 quick questions and we'll create your personalized first 10-hour learning path
        </p>
      </header>

      {!generatedPath ? (
        <>
          {/* Progress indicator */}
          <div className="quiz-progress">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className={`progress-step ${i <= step ? "active" : ""} ${answers[q.id] ? "completed" : ""}`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Current question */}
          <section className="quiz-section">
            <h2>{questions[step].question}</h2>
            <div className="quiz-options">
              {questions[step].options.map((option) => (
                <button
                  key={option.value}
                  className={`quiz-option ${answers[questions[step].id] === option.value ? "selected" : ""}`}
                  onClick={() => handleAnswer(questions[step].id, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="quiz-nav">
              {step > 0 && (
                <button className="quiz-back" onClick={() => setStep((s) => s - 1)}>
                  ← Back
                </button>
              )}
              {allAnswered && (
                <button className="quiz-generate" onClick={generatePath}>
                  Generate My Path →
                </button>
              )}
            </div>
          </section>

          {/* Persona preview */}
          {detectedPersona && (
            <div className="persona-preview">
              <span className="preview-emoji">{detectedPersona.emoji}</span>
              <div className="preview-text">
                <strong>{detectedPersona.name}</strong>
                <p>{detectedPersona.description}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Generated Path Results */}
          <section className="generated-path">
            <div className="path-header">
              <span className="path-emoji">{generatedPath.persona.emoji}</span>
              <div>
                <h2>Your Personalized 10-Hour Path</h2>
                <p>Optimized for {generatedPath.persona.name}</p>
              </div>
              <button className="reset-btn" onClick={resetQuiz}>
                Start Over
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
                    <div className="milestone-marker">🏆 {course.milestone} Milestone!</div>
                  )}
                  <div className="course-order">{course.order}</div>
                  <div className="course-info">
                    <h3 title={(course.title || course.name || "").replace(/_/g, " ")}>
                      {(() => {
                        let cleanTitle = (course.title || course.name || "").replace(/_/g, " ");
                        // Remove redundant prefixes like "Blueprint Blueprint" or "Animation Animation"
                        cleanTitle = cleanTitle.replace(
                          /^(Blueprint|Animation|Lighting|Materials?|Landscape)\s+\1\s*/i,
                          "$1 "
                        );
                        // Also remove category prefix if followed by same word
                        cleanTitle = cleanTitle.replace(/^(\w+)\s+\1\s+/i, "$1 ");
                        return cleanTitle.length > 40
                          ? `${cleanTitle.substring(0, 40)}...`
                          : cleanTitle;
                      })()}
                    </h3>
                    <div className="course-meta">
                      <span>⏱️ {course.duration || 45} min</span>
                      <span>📊 {Math.round((course.cumulativeTime / 60) * 10) / 10}hr total</span>
                      {course.quickWin && <span className="quick-win-badge">⚡ Quick Win</span>}
                    </div>
                    {/* Skills/tags learned */}
                    {Array.isArray(course.tags) && course.tags.length > 0 && (
                      <div className="course-skills">
                        {course.tags.slice(0, 3).map((tag, tagIdx) => (
                          <span key={tagIdx} className="skill-tag">
                            {typeof tag === "string" ? tag : tag?.name || tag?.displayName || ""}
                          </span>
                        ))}
                        {course.tags.length > 3 && (
                          <span className="skill-more">+{course.tags.length - 3} more</span>
                        )}
                      </div>
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
