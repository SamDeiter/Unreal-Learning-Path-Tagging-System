# Digital Tutor Roadmap

**Status:** draft — 2026-04-21
**North Star:** `research/Defining a Good Digital Tutor.md`
**Framing:** transform the system from "AI search engine that returns lessons" into an Intelligent Tutoring System (ITS) per the 4-component framework (Domain / Student / Tutor / UI).

---

## 1. Where we are today

### Shipped (infra + wedge features)
- **Problem-First flow**: [`handleProblemFirst.js`](../functions/ai/handleProblemFirst.js) runs intent extraction → optional clarification loop (up to 3 rounds) → diagnosis → objectives → parallel validation / summary / micro-lesson.
- **Lesson page**: [`generateLesson.js`](../functions/ai/generateLesson.js) + [`LessonPage.jsx`](../path-builder/src/components/Lesson/LessonPage.jsx) + chat CTA. Produces diagnosis, objectives, deep dive, widget, quiz, takeaways. Persisted to `users/{uid}/lessons/{lessonId}`.
- **Student Model scaffold**: [`skillStateReader.js`](../functions/ai/skillStateReader.js) injects learner context into prompts; [`skillStateWriter.js`](../functions/ai/skillStateWriter.js) applies `{encountered, completed, mastered, struggled, rejected}` signals. Schema in [`skillState-schema.md`](../docs/skillState-schema.md).
- **Feedback capture**: [`FeedbackBar.jsx`](../path-builder/src/components/chat/FeedbackBar.jsx) → [`submitFeedback.js`](../functions/ai/submitFeedback.js) → writes to `users/{uid}/feedback/{id}` + updates `skillState`.
- **Session persistence + UI resume**: [`useSessions.js`](../path-builder/src/hooks/useSessions.js), [`ResumeSessionList.jsx`](../path-builder/src/components/sessions/ResumeSessionList.jsx), [`sessions.js`](../functions/ai/sessions.js).

### Framework gap analysis

| Axis | Status | Gap |
|---|---|---|
| **Domain Model** (RAG + content) | 🟢 strong | Embeddings live, citations returned, hallucination mitigation via passages. |
| **Student Model** (knowledge tracing) | 🟡 scaffolded | Reader injects prior state into prompts; writer updates on explicit feedback only. No BKT/PFA, no quiz-result ingestion, no mastery computation. |
| **Tutor Model — Socratic** | 🔴 missing | `handleProblemFirst` diagnoses immediately. No "what do you think is happening?" turn. Vending machine, not dialogue. |
| **Tutor Model — Fade logic** | 🔴 missing | Every learner gets identical lesson depth regardless of mastery. |
| **Feedback — KCR** | 🟢 present | [`QuizEngine.jsx:92-98`](../path-builder/src/components/BespokePath/QuizEngine.jsx#L92-L98) shows right/wrong + explanation. |
| **Feedback — EF (elaborated)** | 🔴 missing | Quiz `explanation` is per-question, not per-choice. No misconception-tailored feedback. |
| **Affective signal loop** | 🔴 dead-letter | `FeedbackBar` writes `helpful/confused/not_helpful`; nothing reads it to adapt next turn. `skillState` is updated only when `tagsTouched` is supplied — rarely is. |
| **Cross-session memory** | 🔴 UI-only | Resumed sessions rehydrate the chat view, but prior diagnoses do NOT flow back into the next call. See [`useProblemFirst.js`](../path-builder/src/hooks/useProblemFirst.js) — no `priorSessionId` parameter. |
| **UDL / accessibility** | 🟡 partial | Skeletons + ARIA labels; no text-to-speech, dyslexic font toggle, or pacing control. |

---

## 2. Sequencing principle

**Close the learning loop before deepening any single stage.** Right now capture happens (feedback, skillState writes) but nothing **adapts** from it. Shipping a half-measure adaptive loop beats shipping best-in-class BKT that isn't wired to anything learner-facing.

Phase 1 is about making the existing infra *round-trip*. Phase 2 deepens the model. Phase 3 widens the surface area.

---

## 3. Phase 1 — Close the loop (2 weeks)

**Goal:** every interaction the learner has should visibly change the tutor's next move. No new infra, mostly prompt + schema refactors.

### 1A. Socratic diagnosis turn
**Problem:** `handleProblemFirst` jumps straight to diagnosis. A tutor elicits the learner's hypothesis first.

**Change:** add an initial "hypothesis elicitation" turn before the current intent→clarification→diagnosis pipeline. The AI asks *"Before I diagnose — what do you think is happening, and what have you tried?"* The learner's answer becomes a new signal that influences the diagnosis prompt ("the learner thinks X is the cause; confirm or redirect").

**Files:**
- [`handleProblemFirst.js:195-287`](../functions/ai/handleProblemFirst.js#L195) — insert new stage before intent extraction
- [`prompts.js`](../functions/ai/prompts.js) — add `SOCRATIC_ELICITATION_PROMPT`
- [`ProblemFirst.jsx:66-100`](../path-builder/src/components/ProblemFirst/ProblemFirst.jsx#L66-L100) — UI support for "Skip — just diagnose" escape hatch
- [`useProblemFirst.js`](../path-builder/src/hooks/useProblemFirst.js) — thread learner hypothesis into diagnosis call

**Exit criteria:**
- 80% of new problem-first threads include a learner hypothesis turn.
- A/B'able: Socratic vs direct, measure confusion-signal rate and session-length.
- Escape hatch: one-click "skip" for power users (bypasses elicitation).

**Risk:** doubles latency-to-first-answer. Mitigated by escape hatch + making the elicitation itself feel fast (small text field, enter-to-submit).

**Framework axis:** Tutor Model / ZPD / Scaffolding.

---

### 1B. Per-choice elaborated feedback (EF) in quiz
**Problem:** [`QuizEngine.jsx`](../path-builder/src/components/BespokePath/QuizEngine.jsx) shows one `explanation` field per question. Misses the "why this wrong answer was tempting" moment.

**Change:** quiz schema becomes `{ stem, choices: {A,B,C,D}, correct, explanations: {A,B,C,D} }`. The AI generates per-choice explanation during [`generateLesson.js`](../functions/ai/generateLesson.js#L184). On reveal, learner sees explanation for the choice they picked, not a generic one.

**Files:**
- [`generateLesson.js:184-187`](../functions/ai/generateLesson.js#L184) — update quiz prompt to demand per-choice explanations
- [`QuizEngine.jsx:92-98`](../path-builder/src/components/BespokePath/QuizEngine.jsx#L92-L98) — render `explanations[selected]` instead of `explanation`
- [`LessonPage.jsx:25-43`](../path-builder/src/components/Lesson/LessonPage.jsx#L25-L43) — update `adaptQuizQuestions` to pass per-choice explanations through

**Exit criteria:**
- New lessons generate with 4 distinct per-choice explanations.
- Backward compat: old lessons fall back to per-question `explanation`.
- Quiz reveal shows misconception-specific text for wrong answers.

**Framework axis:** Feedback (KCR → EF).

---

### 1C. Quiz → skillState write-back
**Problem:** [`skillStateWriter.js`](../functions/ai/skillStateWriter.js) is only called from [`submitFeedback.js:96`](../functions/ai/submitFeedback.js#L96), and only when `tagsTouched` is supplied. Quiz performance — the strongest mastery signal we have — is thrown away.

**Change:** after a quiz completes, write skillState signals: `mastered` if ≥80%, `struggled` if ≤40%, `encountered` otherwise. Tag the lesson's `objectives.fix_specific` + `transferable` arrays.

**Files:**
- New: `functions/ai/ingestQuizResult.js` — callable that accepts `{lessonId, score, total, perQuestionResults[]}`
- [`QuizEngine.jsx:42-44`](../path-builder/src/components/BespokePath/QuizEngine.jsx#L42) — `onComplete` calls the new function
- [`generateLesson.js`](../functions/ai/generateLesson.js) — persist a `skillTags` array on the lesson doc for the ingester to reference
- [`firestore.rules`](../firestore.rules) — no changes (function writes via Admin SDK)

**Exit criteria:**
- Quiz completion updates `skillState` for all lesson tags.
- Next session's [`skillStateReader.js`](../functions/ai/skillStateReader.js) call reflects the update.
- Observable in user doc: `skillState[tag].confidence` shifts after quiz.

**Framework axis:** Student Model (mastery signal ingestion).

---

### 1D. Cross-session memory for diagnosis
**Problem:** Resumed sessions rehydrate the UI but don't feed prior context into the next AI call. A learner who's been struggling for three sessions gets a clean-slate diagnosis on the fourth.

**Change:** when the learner resumes a session and asks a follow-up, include a condensed summary of the prior diagnosis + their feedback signals in the system prompt.

**Files:**
- [`useProblemFirst.js`](../path-builder/src/hooks/useProblemFirst.js) — accept `priorSessionId`, pass to function
- [`handleProblemFirst.js:27`](../functions/ai/handleProblemFirst.js#L27) — read prior session if ID provided, inject summary into diagnosis prompt
- [`sessions.js`](../functions/ai/sessions.js) — add `summarizeSession()` helper (compresses prior diagnosis to 2-3 sentences)
- [`ProblemFirst.jsx:133-150`](../path-builder/src/components/ProblemFirst/ProblemFirst.jsx#L133) — pass `priorSessionId` on resume

**Exit criteria:**
- Resuming a session + asking a follow-up produces a diagnosis that references prior context ("last time we looked at X; building on that...").
- `priorSessionId` is threaded through the entire call chain.

**Framework axis:** Student Model (cross-session continuity).

---

## 4. Phase 2 — Student Model depth (3-5 weeks)

**Goal:** the tutor has a real, quantitative model of what each learner knows.

### 2A. Knowledge tracing implementation (PFA first, BKT if needed)
- Extend `skillState` schema with PFA fields: `{successes, failures, opportunities}` per tag.
- Implement Performance Factor Analysis (logistic regression over prior attempts) in [`skillStateWriter.js`](../functions/ai/skillStateWriter.js). Lightweight, no neural nets.
- If PFA proves insufficient on pilot data, upgrade to BKT (Bayesian Knowledge Tracing).
- Gate: keep DKT/DKVMN out of scope until PFA+BKT exhaust their value.

**Why PFA not DKT:** DKT needs hundreds of interactions per learner to be accurate; we have dozens. PFA works with sparse data.

### 2B. Fade logic in lesson generation
- [`generateLesson.js`](../functions/ai/generateLesson.js) reads mastery per tag before composing.
- High-mastery tags → compress deep dive, skip foundational notes, ramp quiz difficulty.
- Low-mastery tags → full scaffolding, pre-requisite mini-explainers injected.
- **Exit criteria:** two learners with different `skillState` get visibly different lessons for the same query.

### 2C. ZPD-aware quiz difficulty
- [`QuizEngine.jsx`](../path-builder/src/components/BespokePath/QuizEngine.jsx) + [`generateLesson.js`](../functions/ai/generateLesson.js) — quiz generator receives mastery, picks difficulty band.
- Desirable difficulty: aim for 70-80% success rate per learner.

---

## 5. Phase 3 — Affective & UDL (open-ended)

- **Affective loop**: `FeedbackBar` signals `confused` → next response adds scaffolding; `already_knew` → compresses next response. Wire in [`handleProblemFirst.js`](../functions/ai/handleProblemFirst.js) via `priorFeedbackSignal` parameter.
- **Pacing / UDL**: TTS playback, dyslexic-friendly font toggle, reduced-motion respect, adjustable reading-level slider for prose.
- **Misconception library**: mine quiz wrong-answers + `confused` feedback to build a named misconception taxonomy. Fold into Domain Model so future lessons *preempt* known misconceptions.

Deferred until Phase 1+2 are live because they depend on having adaptive machinery to connect to.

---

## 6. Non-goals (deliberately out of scope)

- **Multimodal emotion detection (camera/voice)**: privacy + infra cost vs. marginal signal gain.
- **Tutor persona customization**: not a tutor-quality lever; pure cosmetics.
- **Full DKT/DKVMN**: wait until PFA/BKT ceiling is hit.
- **Live tutor chat / human-in-loop**: different product.

---

## 7. Decision log (resolved 2026-04-22)

- [x] **Socratic turn: always-on.** The opt-in toggle contradicted the product thesis — the tutor *is* the product, so elicitation is the default turn (commit 82219de4, `ProblemFirst.jsx`). No user-preference flag.
- [x] **Quiz→skillState: full completion only.** Partial quiz attempts are ignored (see `LessonPage.jsx:160`). Rationale: partial completion is a noisy signal — confounds "quit because confused" with "quit because interrupted". Revisit if dropout is high enough to matter.
- [x] **Prior-session summary: fixed shape, not dynamic.** `summarizeSession` in `functions/ai/sessions.js` emits `problem_summary + first root cause + first objective` (≈2-3 sentences). Dynamic length deferred — fixed shape keeps token cost predictable.
- [x] **PFA shipped.** BKT deferred; upgrade only if PFA plateaus on pilot data.
- [x] **`skillTags` persisted on the lesson doc.** `generateLesson.js` writes them; `ingestQuizResult.js:149` reads `lessonData.skillTags` server-side. Avoids re-deriving from objectives on every quiz submit and keeps ingestion deterministic if the lesson's objective text ever drifts.

---

## 8. Status as of 2026-04-22

All three phases are shipped. Summary of what's live:

- **Phase 1** — Socratic elicitation (always-on), per-choice EF in quiz, quiz→skillState ingestion, cross-session memory via prior-session summary.
- **Phase 2** — PFA knowledge tracing, fade logic in lesson generation, ZPD-aware quiz difficulty.
- **Phase 3** — Affective feedback loop (confused/already_knew → next-turn directives), UDL accessibility (TTS + dyslexic font + reduced motion), misconception library (capture → mining → preempt in prompts, admin tool at `#admin-misconceptions`).

Next open directions are operational rather than roadmap: observe misconception taxonomy quality once signal volume grows, and decide whether to add a scheduled wrapper for `mineMisconceptions` or leave it admin-triggered.
