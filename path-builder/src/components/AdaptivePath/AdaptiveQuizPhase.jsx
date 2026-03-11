/**
 * AdaptiveQuizPhase — Quiz rendering within the adaptive path
 */
import QuizEngine from "../BespokePath/QuizEngine";

export default function AdaptiveQuizPhase({
  quizzes,
  quizScores,
  showQuiz,
  quizLoading,
  handleTakeQuiz,
  handleQuizComplete,
}) {
  const quizIdx = 0;

  return (
    <div className="quiz-phase-container">
      <div className="step-article">
        <h1>Knowledge Check</h1>
        <p>Test your understanding of the concepts covered in this path.</p>

        {showQuiz === quizIdx && quizzes.has(quizIdx) ? (
          <QuizEngine
            questions={quizzes.get(quizIdx)}
            stepIndex={quizIdx}
            onComplete={handleQuizComplete}
          />
        ) : quizScores.has(quizIdx) ? (
          <div className="quiz-score-badge">
            ✅ Quiz: {quizScores.get(quizIdx).score}/
            {quizScores.get(quizIdx).total}
          </div>
        ) : (
          <button
            className="take-quiz-btn"
            onClick={() => handleTakeQuiz(quizIdx)}
            disabled={quizLoading === quizIdx}
          >
            {quizLoading === quizIdx ? "Generating quiz..." : "Take Quiz"}
          </button>
        )}
      </div>
    </div>
  );
}
