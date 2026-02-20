/**
 * PersonaQuiz — 3-question onboarding quiz to detect user persona.
 *
 * Q1: Industry focus
 * Q2: Preferred depth
 * Q3: Workflow style
 *
 * Scores answers against all 9 personas and picks the best match.
 * Stores result in localStorage and feeds into PathContext.
 */
import { useState, useCallback } from "react";
import { getAllPersonas, getPersonaById } from "../../services/PersonaService";
import "./PersonaQuiz.css";

const STORAGE_KEY = "ue5_persona_id";

// ── Question definitions ─────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "industry",
    title: "What's your focus area?",
    subtitle: "Pick the industry closest to your work",
    options: [
      {
        id: "games",
        emoji: "🎮",
        label: "Game Development",
        personaWeights: { indie_isaac: 4, logic_liam: 4 },
      },
      {
        id: "film",
        emoji: "🎬",
        label: "Film / Animation",
        personaWeights: { animator_alex: 5, rigger_regina: 4 },
      },
      {
        id: "cpg",
        emoji: "💎",
        label: "Product Viz / Marketing",
        personaWeights: { designer_cpg: 5 },
      },
      { id: "archviz", emoji: "🏛️", label: "Architecture", personaWeights: { architect_amy: 5 } },
      {
        id: "industrial",
        emoji: "🔧",
        label: "Industrial / Defense",
        personaWeights: { simulation_sam: 5 },
      },
      { id: "vfx", emoji: "✨", label: "VFX / Effects", personaWeights: { vfx_victor: 5 } },
      {
        id: "automotive",
        emoji: "🚗",
        label: "Automotive",
        personaWeights: { automotive_andy: 5 },
      },
    ],
  },
  {
    id: "depth",
    title: "How deep do you want to go?",
    subtitle: "This shapes the technical level of your path",
    options: [
      {
        id: "low",
        emoji: "🚀",
        label: "Get results fast — skip theory",
        personaWeights: { designer_cpg: 3, architect_amy: 2, automotive_andy: 1 },
      },
      {
        id: "medium",
        emoji: "⚖️",
        label: "Balanced — understand + build",
        personaWeights: { indie_isaac: 3, animator_alex: 3, automotive_andy: 2, vfx_victor: 1 },
      },
      {
        id: "high",
        emoji: "🔬",
        label: "Deep — show me why it works",
        personaWeights: { logic_liam: 3, rigger_regina: 3, simulation_sam: 3, vfx_victor: 2 },
      },
    ],
  },
  {
    id: "workflow",
    title: "What describes your workflow?",
    subtitle: "This helps us tailor course recommendations",
    options: [
      {
        id: "visual",
        emoji: "🎨",
        label: "Visual-first — I think in images",
        personaWeights: {
          animator_alex: 3,
          designer_cpg: 3,
          architect_amy: 2,
          automotive_andy: 2,
          vfx_victor: 2,
        },
      },
      {
        id: "blueprint",
        emoji: "🧩",
        label: "Blueprint — visual logic, no code",
        personaWeights: { indie_isaac: 4, animator_alex: 1 },
      },
      {
        id: "engineering",
        emoji: "⚙️",
        label: "Systems — under-the-hood engineering",
        personaWeights: { logic_liam: 4, rigger_regina: 3, simulation_sam: 3 },
      },
    ],
  },
];

function PersonaQuiz({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const handleSelect = useCallback(
    (questionId, option) => {
      const updated = { ...answers, [questionId]: option };
      setAnswers(updated);

      if (step < QUESTIONS.length - 1) {
        // Move to next question
        setTimeout(() => setStep(step + 1), 300);
      } else {
        // Score and show result
        const scores = {};
        getAllPersonas().forEach((p) => {
          scores[p.id] = 0;
        });

        Object.values(updated).forEach((opt) => {
          Object.entries(opt.personaWeights || {}).forEach(([pid, w]) => {
            scores[pid] = (scores[pid] || 0) + w;
          });
        });

        const bestId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
        const persona = getPersonaById(bestId);
        setResult(persona);
      }
    },
    [answers, step]
  );

  const handleConfirm = useCallback(() => {
    if (!result) return;
    localStorage.setItem(STORAGE_KEY, result.id);
    onComplete(result.id);
  }, [result, onComplete]);

  const handleRetake = useCallback(() => {
    setStep(0);
    setAnswers({});
    setResult(null);
  }, []);

  // ── Result Screen ────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="quiz-overlay">
        <div className="quiz-modal quiz-result-modal">
          <div className="quiz-result-emoji">{result.emoji}</div>
          <h2 className="quiz-result-name">{result.name}</h2>
          <p className="quiz-result-industry">{result.industry}</p>
          <p className="quiz-result-desc">{result.description}</p>

          {result.onboardingMessaging?.length > 0 && (
            <ul className="quiz-result-messaging">
              {result.onboardingMessaging.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}

          <div className="quiz-result-actions">
            <button className="quiz-confirm-btn" onClick={handleConfirm}>
              Start My Path →
            </button>
            <button className="quiz-retake-btn" onClick={handleRetake}>
              Retake Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question Screen ──────────────────────────────────────────────────
  const question = QUESTIONS[step];
  const selectedId = answers[question.id]?.id;

  return (
    <div className="quiz-overlay">
      <div className="quiz-modal">
        <div className="quiz-progress">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`quiz-progress-dot ${i <= step ? "active" : ""} ${i < step ? "done" : ""}`}
            />
          ))}
        </div>

        <h2 className="quiz-title">{question.title}</h2>
        <p className="quiz-subtitle">{question.subtitle}</p>

        <div className="quiz-options">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              className={`quiz-option ${selectedId === opt.id ? "selected" : ""}`}
              onClick={() => handleSelect(question.id, opt)}
            >
              <span className="quiz-option-emoji">{opt.emoji}</span>
              <span className="quiz-option-label">{opt.label}</span>
            </button>
          ))}
        </div>

        {step > 0 && (
          <button className="quiz-back-btn" onClick={() => setStep(step - 1)}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

export default PersonaQuiz;
export { STORAGE_KEY };
