// ============================================================
// UE5 Learner Viewer — Application Logic
// Navigation state machine + screen renderers
// ============================================================

// ── State ────────────────────────────────────────────────
const state = {
  screen: 'PATH_OVERVIEW', // PATH_OVERVIEW | CHAPTER_STEP | CHAPTER_COMPLETE | PATH_COMPLETE
  chapterIndex: 0,
  stepIndex: 0,
  completedSteps: {},      // "ch-1:ch1-s1" → true
  completedChapters: {},   // "ch-1" → true
  quizState: null          // { answers: [], submitted: false, selectedIndex: null, currentQuestion: 0 }
};

function getChapter() { return PATH_DATA.chapters[state.chapterIndex]; }
function getStep() { return getChapter().steps[state.stepIndex]; }
function stepKey(ch, st) { return ch.id + ':' + st.id; }
function isStepDone(ch, st) { return !!state.completedSteps[stepKey(ch, st)]; }
function markStepDone() {
  const ch = getChapter(), st = getStep();
  state.completedSteps[stepKey(ch, st)] = true;
}
function isChapterDone(ch) { return !!state.completedChapters[ch.id]; }
function markChapterDone() { state.completedChapters[getChapter().id] = true; }

// ── Root Render ──────────────────────────────────────────
function render() {
  const container = document.getElementById('app');
  switch (state.screen) {
    case 'PATH_OVERVIEW':   container.innerHTML = renderPathOverview(); break;
    case 'CHAPTER_STEP':    container.innerHTML = renderChapterStep(); break;
    case 'CHAPTER_COMPLETE': container.innerHTML = renderChapterComplete(); break;
    case 'PATH_COMPLETE':   container.innerHTML = renderPathComplete(); break;
  }
  bindEvents();
  window.scrollTo(0, 0);
}

// ── Navigation ───────────────────────────────────────────
function startPath() {
  state.screen = 'CHAPTER_STEP';
  state.chapterIndex = 0;
  state.stepIndex = 0;
  state.quizState = null;
  render();
}

function nextStep() {
  markStepDone();
  const ch = getChapter();
  if (state.stepIndex < ch.steps.length - 1) {
    state.stepIndex++;
    state.quizState = null;
    render();
  } else {
    // Chapter finished
    markChapterDone();
    if (state.chapterIndex < PATH_DATA.chapters.length - 1) {
      state.screen = 'CHAPTER_COMPLETE';
      render();
    } else {
      state.screen = 'PATH_COMPLETE';
      render();
    }
  }
}

function prevStep() {
  if (state.stepIndex > 0) {
    state.stepIndex--;
    state.quizState = null;
    render();
  } else if (state.chapterIndex > 0) {
    state.chapterIndex--;
    const prevCh = getChapter();
    state.stepIndex = prevCh.steps.length - 1;
    state.quizState = null;
    render();
  } else {
    // First step of first chapter — go back to overview
    goToOverview();
  }
}

function skipStep() {
  nextStep();
}

function nextChapter() {
  state.chapterIndex++;
  state.stepIndex = 0;
  state.screen = 'CHAPTER_STEP';
  state.quizState = null;
  render();
}

function goToOverview() {
  state.screen = 'PATH_OVERVIEW';
  render();
}

// ── Progress Bar Renderer ────────────────────────────────
function renderProgressBar() {
  const ch = getChapter();
  const total = ch.steps.length;
  let html = '<div class="progress-bar">';

  for (let i = 0; i < total; i++) {
    const step = ch.steps[i];
    const done = isStepDone(ch, step) || i < state.stepIndex;
    const active = i === state.stepIndex;
    const cls = active ? 'active' : (done ? 'completed' : 'future');
    const numContent = done && !active ? '&#10003;' : (i + 1);

    html += '<div class="progress-step-wrapper">' +
      '<div class="progress-step ' + cls + '">' +
        '<span class="step-num">' + numContent + '</span>' +
        '<span class="step-label">' + shortStepLabel(step) + '</span>' +
      '</div>' +
    '</div>';

    // Add connector between steps (not after last)
    if (i < total - 1) {
      const connDone = i < state.stepIndex;
      html += '<div class="progress-connector' + (connDone ? ' done' : '') + '"></div>';
    }
  }

  html += '</div>';
  return html;
}

function shortStepLabel(step) {
  switch (step.type) {
    case 'AI_TRANSITION': return 'Intro';
    case 'CONTENT_VIDEO': return 'Video';
    case 'CONTENT_DOC': return 'Docs';
    case 'CONTENT_RAG': return 'Study';
    case 'QUIZ': return 'Quiz';
    default: return '';
  }
}

// ── Screen 1: Path Overview ──────────────────────────────
function renderPathOverview() {
  const d = PATH_DATA;
  let chapters = '';
  d.chapters.forEach(function(ch) {
    const done = isChapterDone(ch);
    let dots = '';
    ch.steps.forEach(function(st) {
      const stepDone = isStepDone(ch, st);
      dots += '<div class="step-dot ' + (stepDone ? 'complete' : '') + '"></div>';
    });

    chapters += '<div class="chapter-card" data-chapter="' + ch.number + '">' +
      '<div><div class="chapter-number-label">Chapter</div><div class="chapter-number">' + ch.number + '</div></div>' +
      '<div class="chapter-info"><h3>' + ch.title + '</h3><p>' + ch.description + '</p></div>' +
      '<div class="chapter-dots">' + dots + '</div>' +
      '</div>';
  });

  return ue5Window(
    '<div class="path-title">Learning Path: ' + d.title + '</div>' +
    '<div class="metadata-pills">' +
      '<span class="meta-pill">' + d.metadata.skillLevel + '</span>' +
      '<span class="meta-pill">' + d.metadata.estimatedHours + '</span>' +
      '<span class="meta-pill">' + d.metadata.industryFocus + '</span>' +
    '</div>' +
    '<div class="chapter-list">' + chapters + '</div>' +
    '<div class="btn-center"><button class="btn btn-primary btn-large" id="btn-start">Start Path</button></div>'
  );
}

// ── Screen 2: AI Transition ──────────────────────────────
function renderAITransition(step) {
  let objectives = '';
  step.objectives.forEach(function(obj) {
    objectives += '<li>' + obj + '</li>';
  });

  return renderProgressBar() +
    '<div class="chapter-title">Chapter ' + getChapter().number + ': ' + getChapter().title + '</div>' +
    '<div class="transition-card">' +
      '<div class="transition-icon"><img src="https://cdn2.unrealengine.com/ue-logo-stacked-unreal-engine-w-677x545-fac11de0943f.png" alt="UE5" style="width:80px;height:auto;filter:brightness(1.5);"></div>' +
      '<div class="transition-title">What You\'ll Learn</div>' +
      '<ul class="transition-objectives">' + objectives + '</ul>' +
      '<div class="expected-outcome">' +
        '<h4>Expected Outcome</h4>' +
        '<p>' + step.expectedOutcome + '</p>' +
      '</div>' +
    '</div>' +
    renderNavBar(false);
}

// ── Screen 3: Video Step ─────────────────────────────────
function renderVideoStep(step) {
  let takeaways = '';
  step.keyTakeaways.forEach(function(t) {
    takeaways += '<li>' + t + '</li>';
  });

  return renderProgressBar() +
    '<div class="chapter-title">Chapter ' + getChapter().number + ': ' + getChapter().title + '</div>' +
    '<div class="two-col two-col-stretch">' +
      '<div class="col-main">' +
        '<div class="video-container">' +
          '<iframe src="' + step.videoUrl + '?rel=0&modestbranding=1" allowfullscreen></iframe>' +
        '</div>' +
      '</div>' +
      '<div class="col-side">' +
        '<div class="side-panel side-panel-stretch">' +
          '<h3>Key Takeaways</h3>' +
          '<ul>' + takeaways + '</ul>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="why-section">' +
      '<h3>Video Overview</h3>' +
      '<p>' + step.whyThisMatters + '</p>' +
    '</div>' +
    renderNavBar(true);
}

// ── Screen 4: Doc Step ───────────────────────────────────
function renderDocStep(step) {
  let notes = '';
  step.aiNotes.forEach(function(n) {
    notes += '<li>' + n + '</li>';
  });

  const paragraphs = step.content.split('\n\n').map(function(p) { return '<p>' + p + '</p>'; }).join('');

  return renderProgressBar() +
    '<div class="two-col">' +
      '<div class="col-main">' +
        '<div class="chapter-title">Chapter ' + getChapter().number + ': ' + getChapter().title + '</div>' +
        '<div class="doc-content">' +
          '<h3 style="color:#fff;margin-bottom:12px">' + step.title + '</h3>' +
          paragraphs +
          '<div class="relevant-snippet"><strong>Relevant Snippet</strong>' + step.relevantSnippet + '</div>' +
          '<div class="code-block">' + escapeHtml(step.codeBlock) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="col-side">' +
        '<div class="side-panel ai-notes">' +
          '<h3>AI Notes</h3>' +
          '<ul>' + notes + '</ul>' +
        '</div>' +
      '</div>' +
    '</div>' +
    renderNavBar(true);
}

// ── Screen 5: RAG Step ───────────────────────────────────
function renderRAGStep(step) {
  let concepts = '';
  step.keyConcepts.forEach(function(c) {
    concepts += '<li>' + c + '</li>';
  });

  return '<div class="simple-progress"><div class="simple-progress-fill" style="width:' + ((state.stepIndex + 1) / getChapter().steps.length * 100) + '%"></div></div>' +
    '<div class="chapter-title text-center">Chapter ' + getChapter().number + ': ' + getChapter().title + '</div>' +
    '<div class="rag-header"><span class="icon"><img src="https://cdn2.unrealengine.com/ue-logo-stacked-unreal-engine-w-677x545-fac11de0943f.png" alt="UE5" style="width:24px;height:auto;filter:brightness(1.5);"></span><h2>AI-Generated Study Material</h2></div>' +
    '<div class="card"><h3 class="card-title" style="margin-bottom:12px">Key Concepts</h3><ul style="padding-left:20px;color:#ccc;font-size:14px;line-height:1.7">' + concepts + '</ul></div>' +
    '<div class="warning-card"><h3>⚠ Common Mistakes</h3><p>' + step.commonMistakes + '</p></div>' +
    '<div class="exercise-card"><h3>Try It Yourself</h3><p>' + step.tryItYourself + '</p></div>' +
    renderNavBar(true);
}

// ── Screen 6–8: Quiz ─────────────────────────────────────
function renderQuiz(step) {
  if (!state.quizState) {
    state.quizState = { answers: [], submitted: false, selectedIndex: null, currentQuestion: 0, attempt: 1 };
  }

  const qs = state.quizState;

  // All questions answered — show results
  if (qs.currentQuestion >= step.questions.length) {
    return renderQuizResults(step);
  }

  const q = step.questions[qs.currentQuestion];
  const correctSoFar = qs.answers.filter(function(a) { return a.correct; }).length;

  let options = '';
  q.options.forEach(function(opt, i) {
    const letter = String.fromCharCode(65 + i);
    const selected = qs.selectedIndex === i ? ' selected' : '';
    options += '<div class="quiz-option' + selected + '" data-idx="' + i + '">' +
      '<div class="quiz-radio"></div>' +
      letter + ') ' + opt +
      '</div>';
  });

  return renderProgressBar() +
    '<div class="chapter-title text-center">Chapter ' + getChapter().number + ': ' + getChapter().title + ' • Quiz</div>' +
    '<div class="quiz-card">' +
      '<div class="quiz-counter"><span>Question ' + (qs.currentQuestion + 1) + ' of ' + step.questions.length + '</span><span>' + (qs.currentQuestion + 1) + '/' + step.questions.length + '</span></div>' +
      '<div class="quiz-question">' + q.text + '</div>' +
      '<div class="quiz-options">' + options + '</div>' +
      '<div class="btn-center"><button class="btn btn-primary" id="btn-submit-answer" ' + (qs.selectedIndex === null ? 'disabled style="opacity:0.5"' : '') + '>Submit Answer</button></div>' +
    '</div>' +
    '<div class="quiz-score-tracker">Score: ' + correctSoFar + '/' + qs.currentQuestion + ' so far <span class="correct-icon">✓</span></div>' +
    '<div class="btn-center mt-16"><button class="btn-skip" id="btn-skip-quiz">Skip Quiz →</button></div>';
}

function renderQuizResults(step) {
  const qs = state.quizState;
  const correct = qs.answers.filter(function(a) { return a.correct; }).length;
  const total = step.questions.length;
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= 80;

  if (passed) {
    // ── Pass ──
    let breakdown = '';
    qs.answers.forEach(function(a, i) {
      const q = step.questions[i];
      if (a.correct) {
        breakdown += '<div class="result-row"><span class="result-icon">✅</span><span class="result-text">' + q.text + '</span><span class="result-label correct">✓ CORRECT</span></div>';
      } else {
        breakdown += '<div class="result-row" style="flex-direction:column"><div style="display:flex;align-items:flex-start;gap:10px"><span class="result-icon">❌</span><span class="result-text">' + q.text + '</span><span class="result-label wrong">WRONG</span></div>' +
          '<div class="result-explanation"><strong>Your Answer:</strong> ' + q.options[a.selectedIndex] + ' (Incorrect)<br><strong>Correct:</strong> ' + q.options[q.correctIndex] + '<br><strong>Explanation:</strong> ' + q.explanation + '</div></div>';
      }
    });

    return '<div class="chapter-title text-center">Chapter ' + getChapter().number + ': ' + getChapter().title + ' • Quiz Complete</div>' +
      '<div class="results-icon">✅</div>' +
      '<div class="results-heading">You Passed!</div>' +
      '<div class="results-score pass">Score: ' + correct + '/' + total + ' (' + pct + '%)</div>' +
      '<div class="results-breakdown">' + breakdown + '</div>' +
      '<div class="tip-card"><h4>Follow-Up</h4><p>TIP: Review the concepts from this chapter to solidify your understanding of ' + getChapter().title.toLowerCase() + '.</p></div>' +
      '<div class="btn-group mt-16"><button class="btn btn-secondary" id="btn-review-answers">Review Answers</button><button class="btn btn-primary" id="btn-continue-chapter">Continue to Next Chapter</button></div>';
  } else {
    // ── Fail ──
    let reviewItems = '';
    qs.answers.forEach(function(a, i) {
      if (!a.correct) {
        reviewItems += '<li>' + step.questions[i].explanation + '</li>';
      }
    });

    return '<div class="chapter-title text-center">Chapter ' + getChapter().number + ': ' + getChapter().title + ' • Quiz Results</div>' +
      '<div class="results-icon" style="color:#FF9800">⚠</div>' +
      '<div class="results-heading">Not Quite — Let\'s Try Again</div>' +
      '<div class="results-score fail">' + correct + '/' + total + ' (' + pct + '%)</div>' +
      '<div class="fail-subtitle">You need 80% to pass.</div>' +
      '<div class="card"><h4 style="color:#fff;margin-bottom:10px">Here\'s What to Review</h4><ul class="review-list" style="padding-left:20px">' + reviewItems + '</ul></div>' +
      '<div class="tip-card"><h4>Tip:</h4><p>Review the video in this chapter before retrying.</p></div>' +
      '<div class="attempt-counter">Attempt ' + qs.attempt + '</div>' +
      '<div class="btn-group mt-16"><button class="btn btn-secondary" id="btn-review-chapter">Review Chapter</button><button class="btn btn-primary" id="btn-retry-quiz">Retry Quiz</button></div>';
  }
}

// ── Screen 9: Chapter Complete ───────────────────────────
function renderChapterComplete() {
  const ch = getChapter();
  const videoCount = ch.steps.filter(function(s) { return s.type === 'CONTENT_VIDEO'; }).length;
  const quizCount = ch.steps.filter(function(s) { return s.type === 'QUIZ'; }).length;
  const nextCh = PATH_DATA.chapters[state.chapterIndex + 1];

  let accomplishments = '';
  ch.steps.forEach(function(s) {
    if (s.type === 'AI_TRANSITION') {
      s.objectives.forEach(function(o) {
        accomplishments += '<li>' + o + '</li>';
      });
    }
  });

  // Only show up to 3
  const accList = accomplishments.split('</li>').slice(0, 3).join('</li>') + '</li>';

  return ue5Window(
    renderProgressBar() +
    '<div class="celebration-card">' +
      '<div class="celebration-title">Chapter ' + ch.number + '<br>Complete!</div>' +
      '<h3 style="color:#fff;font-size:16px;margin-bottom:12px">What You Accomplished</h3>' +
      '<ul class="accomplishment-list">' + accList + '</ul>' +
      '<div class="chapter-stats">' + videoCount + ' videos watched • ' + quizCount + ' quiz passed • ~12 minutes</div>' +
      (nextCh ? '<div class="up-next-preview"><h3>Up Next: Chapter ' + nextCh.number + ' — ' + nextCh.title + '</h3><p>' + nextCh.description + '</p></div>' : '') +
    '</div>' +
    '<div class="btn-center mt-16"><button class="btn btn-primary btn-large" id="btn-next-chapter">Continue to Chapter ' + (nextCh ? nextCh.number : '') + '</button></div>'
  );
}

// ── Screen 10: Path Complete ─────────────────────────────
function renderPathComplete() {
  const d = PATH_DATA;
  const c = d.completion;

  let badges = '';
  c.skillsMastered.forEach(function(skill) {
    const plainSkill = skill.replace(/<\/?strong>/g, '');
    const icon = plainSkill === 'NavMesh' ? '▦' : plainSkill === 'AI Controller' ? '⚙' : plainSkill === 'State Trees' ? '⑃' : '◎';
    badges += '<div class="skill-badge"><div class="skill-badge-icon">' + icon + '</div><div class="skill-badge-label">' + skill + '</div></div>';
  });

  let nextPaths = '';
  c.suggestedNext.forEach(function(p) {
    nextPaths += '<div class="next-path-card"><h4>' + p.title + '</h4><p>' + p.description + '</p><div class="next-path-progress">' + p.progress + '%</div></div>';
  });

  return '<div class="ue5-window">' +
    '<div class="path-complete-banner">PATH COMPLETE!</div>' +
    '<div class="ue5-content">' +
      '<div class="trophy-area"><div class="trophy">🏆</div></div>' +
      '<div class="path-complete-title">Path Complete!</div>' +
      '<div class="path-complete-subtitle">' + d.title + '</div>' +
      '<div class="stats-pills">' +
        '<span class="stat-pill"><strong>' + d.chapters.length + '</strong> Chapters</span>' +
        '<span class="stat-pill"><strong>' + c.totalSteps + '</strong> Steps</span>' +
        '<span class="stat-pill"><strong>' + c.totalHours + '</strong> Hours Total</span>' +
      '</div>' +
      '<div class="skills-section"><h3>Skills Mastered</h3><div class="skill-badges">' + badges + '</div></div>' +
      '<div class="whats-next"><h3>What\'s Next?</h3><div class="next-paths">' + nextPaths + '</div></div>' +
      '<div class="return-link"><a id="btn-return">← Return to Path Library</a></div>' +
    '</div></div>';
}

// ── Chapter Step Router ──────────────────────────────────
function renderChapterStep() {
  const step = getStep();
  let content;
  switch (step.type) {
    case 'AI_TRANSITION': content = renderAITransition(step); break;
    case 'CONTENT_VIDEO':  content = renderVideoStep(step); break;
    case 'CONTENT_DOC':    content = renderDocStep(step); break;
    case 'CONTENT_RAG':    content = renderRAGStep(step); break;
    case 'QUIZ':           content = renderQuiz(step); break;
    default:               content = '<p>Unknown step type</p>';
  }
  return ue5Window(content);
}

// ── UE5 Window Wrapper ───────────────────────────────────
function ue5Window(content) {
  return '<div class="ue5-window">' +
    '<div class="ue5-titlebar">' +
      '<span class="ue5-titlebar-logo"><img src="https://cdn2.unrealengine.com/ue-logo-stacked-unreal-engine-w-677x545-fac11de0943f.png" alt="UE5" style="width:20px;height:auto;filter:brightness(1.5);vertical-align:middle;"></span>' +
      '<div class="ue5-titlebar-controls"><span>—</span><span>□</span><span>✕</span></div>' +
    '</div>' +
    '<div class="ue5-content">' + content + '</div>' +
  '</div>';
}

// ── Nav Bar ──────────────────────────────────────────────
function renderNavBar(showSkip) {
  return '<div class="nav-bar">' +
    (showSkip ? '<button class="btn-skip" id="btn-skip">Skip</button>' : '<div></div>') +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-secondary" id="btn-back">Back</button>' +
      '<button class="btn btn-primary" id="btn-next">Next</button>' +
    '</div>' +
  '</div>';
}

// ── Event Binding ────────────────────────────────────────
function bindEvents() {
  bind('btn-start', startPath);
  bind('btn-next', nextStep);
  bind('btn-back', prevStep);
  bind('btn-skip', skipStep);
  bind('btn-next-chapter', nextChapter);
  bind('btn-return', goToOverview);
  bind('btn-skip-quiz', function() { nextStep(); });

  // Quiz: continue after pass
  bind('btn-continue-chapter', function() {
    nextStep();
  });

  // Quiz: retry after fail
  bind('btn-retry-quiz', function() {
    state.quizState = { answers: [], submitted: false, selectedIndex: null, currentQuestion: 0, attempt: (state.quizState ? state.quizState.attempt + 1 : 1) };
    render();
  });

  // Quiz: review chapter
  bind('btn-review-chapter', function() {
    state.stepIndex = 0;
    state.quizState = null;
    render();
  });

  // Quiz: review answers (just re-render results)
  bind('btn-review-answers', function() {
    // Already on results — could scroll up; for now no-op
  });

  // Quiz: select answer
  document.querySelectorAll('.quiz-option').forEach(function(opt) {
    opt.addEventListener('click', function() {
      const idx = parseInt(this.getAttribute('data-idx'));
      state.quizState.selectedIndex = idx;
      render();
    });
  });

  // Quiz: submit answer
  bind('btn-submit-answer', function() {
    if (state.quizState.selectedIndex === null) return;
    const step = getStep();
    const q = step.questions[state.quizState.currentQuestion];
    state.quizState.answers.push({
      selectedIndex: state.quizState.selectedIndex,
      correct: state.quizState.selectedIndex === q.correctIndex
    });
    state.quizState.currentQuestion++;
    state.quizState.selectedIndex = null;
    render();
  });

  // Chapter cards — click to jump
  document.querySelectorAll('.chapter-card').forEach(function(card) {
    card.addEventListener('click', function() {
      const chNum = parseInt(this.getAttribute('data-chapter'));
      state.chapterIndex = chNum - 1;
      state.stepIndex = 0;
      state.screen = 'CHAPTER_STEP';
      state.quizState = null;
      render();
    });
  });
}

function bind(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

// ── Utility ──────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  render();
});
