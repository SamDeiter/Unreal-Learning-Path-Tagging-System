/**
 * SpokeViewer — Displays an AI-generated mini-lesson ("spoke")
 *
 * Shows the synthesized content when a user clicks "Fill This Gap":
 *   - Lesson title + intro script
 *   - Markdown study notes
 *   - YouTube embed at the exact timestamp
 *   - Quick quiz questions
 */

import { useState } from "react";
import DOMPurify from "dompurify";
import "./SpokeViewer.css";

/**
 * Simple markdown-to-HTML converter (headings, bold, lists, code).
 * We use DOMPurify for safety.
 */
function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, "<br/><br/>");
  return DOMPurify.sanitize(html);
}

export default function SpokeViewer({ spoke, onClose, onAddToPath }) {
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  if (!spoke) return null;

  const {
    lesson_title,
    intro_script,
    markdown_notes,
    featured_video,
    quiz_questions = [],
    tts_audio_url,
    difficulty,
    source_chunks,
    cached,
  } = spoke;

  // Build YouTube embed URL with start time
  const youtubeEmbedUrl = featured_video?.video_id
    ? `https://www.youtube.com/embed/${featured_video.video_id}?start=${featured_video.start_seconds || 0}&end=${featured_video.end_seconds || 0}&autoplay=0&rel=0`
    : null;

  const handleAnswer = (qIdx, optIdx) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmitQuiz = () => {
    setSubmitted(true);
  };

  const quizScore = submitted
    ? quiz_questions.reduce(
        (score, q, i) => score + (answers[i] === q.correct_index ? 1 : 0),
        0
      )
    : 0;

  return (
    <div className="spoke-viewer-overlay" onClick={onClose}>
      <div className="spoke-viewer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="spoke-header">
          <div className="spoke-header-left">
            <span className="spoke-badge">✨ AI Mini-Lesson</span>
            {difficulty && (
              <span className={`spoke-difficulty spoke-diff-${difficulty}`}>
                {difficulty}
              </span>
            )}
            {cached && <span className="spoke-cached" title="Loaded from cache">⚡ Cached</span>}
          </div>
          <button className="spoke-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h2 className="spoke-title">{lesson_title}</h2>

        {/* Intro / TTS */}
        {intro_script && (
          <div className="spoke-intro">
            <p className="spoke-intro-text">🎙️ {intro_script}</p>
            {tts_audio_url && (
              <audio controls className="spoke-audio" src={tts_audio_url}>
                Your browser does not support audio.
              </audio>
            )}
          </div>
        )}

        {/* Featured Video */}
        {youtubeEmbedUrl && (
          <div className="spoke-video-section">
            <h3 className="spoke-section-title">📺 Watch This Clip</h3>
            {featured_video.video_title && (
              <p className="spoke-video-label">{featured_video.video_title}</p>
            )}
            <div className="spoke-video-container">
              <iframe
                src={youtubeEmbedUrl}
                title={featured_video.video_title || "Featured clip"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="spoke-video-iframe"
              />
            </div>
          </div>
        )}

        {/* Study Notes */}
        {markdown_notes && (
          <div className="spoke-notes-section">
            <h3 className="spoke-section-title">📝 Study Notes</h3>
            <div
              className="spoke-notes-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown_notes) }}
            />
          </div>
        )}

        {/* Quiz */}
        {quiz_questions.length > 0 && (
          <div className="spoke-quiz-section">
            <button
              className="spoke-quiz-toggle"
              onClick={() => setShowQuiz(!showQuiz)}
            >
              {showQuiz ? "▾" : "▸"} Quick Check ({quiz_questions.length}{" "}
              questions)
            </button>

            {showQuiz && (
              <div className="spoke-quiz-list">
                {quiz_questions.map((q, qIdx) => (
                  <div key={qIdx} className="spoke-quiz-item">
                    <p className="spoke-quiz-question">
                      {qIdx + 1}. {q.question}
                    </p>
                    <div className="spoke-quiz-options">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = answers[qIdx] === optIdx;
                        const isCorrect = submitted && optIdx === q.correct_index;
                        const isWrong = submitted && isSelected && optIdx !== q.correct_index;
                        return (
                          <button
                            key={optIdx}
                            className={`spoke-quiz-option ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                            onClick={() => handleAnswer(qIdx, optIdx)}
                            disabled={submitted}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {submitted && q.explanation && answers[qIdx] !== q.correct_index && (
                      <p className="spoke-quiz-explanation">💡 {q.explanation}</p>
                    )}
                  </div>
                ))}

                {!submitted && Object.keys(answers).length === quiz_questions.length && (
                  <button className="spoke-quiz-submit" onClick={handleSubmitQuiz}>
                    Check Answers
                  </button>
                )}

                {submitted && (
                  <div className="spoke-quiz-result">
                    <p>
                      Score: <strong>{quizScore}/{quiz_questions.length}</strong>
                      {quizScore === quiz_questions.length ? " 🎉 Perfect!" : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="spoke-footer">
          <span className="spoke-meta">
            Generated from {source_chunks} content sources
          </span>
          {onAddToPath && (
            <button className="spoke-add-btn" onClick={() => onAddToPath(spoke)}>
              ➕ Add to Path
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
