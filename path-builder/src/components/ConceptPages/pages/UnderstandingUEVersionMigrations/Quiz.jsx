import { useMemo, useState } from "react";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Circle,
} from "lucide-react";

/**
 * Quiz — 5-question retrieval-practice block for the
 * "Understanding UE Version Migrations" concept page.
 *
 * Contract: { questions: Array<MatchQ | McQ | TfQ> }
 *   match: { id, kind: "match", prompt, pairs: [{ left, right, explain? }] }
 *   mc:    { id, kind: "mc",    prompt, options: [{ id, label }], correct, explain }
 *   tf:    { id, kind: "tf",    prompt, correct: true|false, explain }
 *
 * State is fully ephemeral — nothing is persisted.
 */

// ---------- helpers ----------

/**
 * Deterministic shuffle keyed by a string seed (so a given question id
 * always renders the same shuffled order, instead of reshuffling on every
 * render). Mulberry32 over a tiny FNV-1a hash of the seed.
 */
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- match question ----------

function MatchQuestion({ question, answer, locked, onChange, onSubmit }) {
  const lefts = question.pairs.map((p) => p.left);
  const rights = useMemo(
    () => seededShuffle(question.pairs.map((p) => p.right), question.id),
    [question.id, question.pairs]
  );

  const matches = answer?.matches ?? {};
  const selectedLeft = answer?.selectedLeft ?? null;

  const rightToLeft = Object.fromEntries(
    Object.entries(matches).map(([l, r]) => [r, l])
  );

  function pickLeft(left) {
    if (locked) return;
    onChange({ ...answer, matches, selectedLeft: left });
  }

  function pickRight(right) {
    if (locked) return;
    if (!selectedLeft) return;
    const next = { ...matches };
    for (const k of Object.keys(next)) {
      if (next[k] === right) delete next[k];
    }
    next[selectedLeft] = right;
    onChange({ matches: next, selectedLeft: null });
  }

  const allMatched = lefts.every((l) => matches[l]);

  const correctness = {};
  for (const p of question.pairs) {
    correctness[p.left] = matches[p.left] === p.right;
  }

  function leftClasses(left) {
    const isSelected = selectedLeft === left;
    const isMatched = !!matches[left];
    if (locked) {
      return correctness[left]
        ? "bg-emerald-500/15 text-emerald-200"
        : "bg-rose-500/15 text-rose-200";
    }
    if (isSelected) {
      return "bg-indigo-500 text-white";
    }
    if (isMatched) {
      return "bg-indigo-500/15 text-zinc-100";
    }
    return "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 motion-reduce:hover:bg-zinc-800";
  }

  function rightClasses(right) {
    const matchedFromLeft = rightToLeft[right];
    if (locked) {
      if (!matchedFromLeft) {
        return "bg-zinc-800/60 text-zinc-400";
      }
      const ok =
        matches[matchedFromLeft] ===
        question.pairs.find((p) => p.left === matchedFromLeft)?.right;
      return ok
        ? "bg-emerald-500/15 text-emerald-200"
        : "bg-rose-500/15 text-rose-200";
    }
    if (matchedFromLeft) {
      return "bg-indigo-500/15 text-zinc-100";
    }
    return "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 motion-reduce:hover:bg-zinc-800";
  }

  return (
    <div className="space-y-5">
      <div className="text-base text-zinc-100 break-words min-w-0">
        {question.prompt}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 min-w-0">
          <div className="text-xs uppercase tracking-widest font-bold text-zinc-400">
            Deprecated in 5.6
          </div>
          <div className="flex flex-wrap gap-2">
            {lefts.map((l) => {
              const matchedRight = matches[l];
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => pickLeft(l)}
                  disabled={locked}
                  className={`inline-flex max-w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm font-medium transition-colors motion-reduce:transition-none break-words min-w-0 ${leftClasses(
                    l
                  )}`}
                >
                  <span className="break-words min-w-0">{l}</span>
                  {matchedRight ? (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                      <ArrowRight className="h-3 w-3" />
                      <span className="break-words min-w-0">{matchedRight}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <div className="text-xs uppercase tracking-widest font-bold text-zinc-400">
            Replacement in 5.7
          </div>
          <div className="flex flex-wrap gap-2">
            {rights.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => pickRight(r)}
                disabled={locked || !selectedLeft}
                className={`inline-flex max-w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 break-words min-w-0 ${rightClasses(
                  r
                )}`}
              >
                <span className="break-words min-w-0">{r}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!locked && Object.keys(matches).length > 0 ? (
        <div className="rounded-md bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400 break-words min-w-0">
          <span className="uppercase tracking-widest font-bold text-zinc-500">
            Pairs so far:
          </span>{" "}
          {Object.entries(matches)
            .map(([l, r]) => `${l} → ${r}`)
            .join("  ·  ")}
        </div>
      ) : null}

      {!locked ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 min-w-0 break-words">
            {selectedLeft
              ? `Now click a replacement to pair it with "${selectedLeft}".`
              : "Click a left item, then click its replacement on the right."}
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!allMatched}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 motion-reduce:transition-none"
          >
            Check answers
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {question.pairs.map((p) => {
            const ok = correctness[p.left];
            return (
              <li
                key={p.left}
                className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                  ok ? "bg-emerald-500/10" : "bg-rose-500/10"
                }`}
              >
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                )}
                <div className="min-w-0">
                  <div className="text-zinc-100 break-words min-w-0">
                    <span className="font-medium">{p.left}</span>
                    <span className="text-zinc-500"> &rarr; </span>
                    <span className="font-medium">{p.right}</span>
                  </div>
                  {p.explain ? (
                    <div className="mt-1 text-xs text-zinc-400 break-words min-w-0">
                      {p.explain}
                    </div>
                  ) : null}
                  {!ok && matches[p.left] ? (
                    <div className="mt-1 text-xs text-rose-300 break-words min-w-0">
                      You picked: {matches[p.left]}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- multiple-choice ----------

function McQuestion({ question, answer, locked, onChange }) {
  const selected = answer?.selected ?? null;

  function pick(id) {
    if (locked) return;
    onChange({ selected: id });
  }

  function optionClasses(id) {
    const isSelected = selected === id;
    const isCorrect = id === question.correct;
    if (!locked) {
      return isSelected
        ? "border-indigo-500 bg-indigo-500/10 text-indigo-200"
        : "border-zinc-800 text-zinc-300 hover:bg-zinc-800";
    }
    if (isSelected && isCorrect) {
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
    }
    if (isSelected && !isCorrect) {
      return "border-rose-500/50 bg-rose-500/10 text-rose-200";
    }
    if (!isSelected && isCorrect) {
      return "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";
    }
    return "border-zinc-800 text-zinc-500";
  }

  return (
    <div className="space-y-4">
      <div className="text-base text-zinc-100 break-words min-w-0">
        {question.prompt}
      </div>
      <div className="flex flex-col gap-2">
        {question.options.map((opt) => {
          const isSelected = selected === opt.id;
          const showCheck = locked && opt.id === question.correct;
          const showX =
            locked && selected === opt.id && opt.id !== question.correct;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              disabled={locked}
              className={`w-full text-left p-3 border rounded transition-colors motion-reduce:transition-none flex items-center justify-between gap-2 ${optionClasses(
                opt.id
              )}`}
            >
              <span className="text-[13px] font-medium break-words min-w-0">
                {opt.label}
              </span>
              {showCheck ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : showX ? (
                <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
              ) : isSelected ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-300" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-600" />
              )}
            </button>
          );
        })}
      </div>
      {locked ? (
        <div
          className={`rounded-md px-3 py-2 text-sm break-words min-w-0 ${
            selected === question.correct
              ? "bg-emerald-500/10 text-emerald-100"
              : "bg-rose-500/10 text-rose-100"
          }`}
        >
          <span className="font-medium">
            {selected === question.correct ? "Correct. " : "Not quite. "}
          </span>
          <span className="text-zinc-300">{question.explain}</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------- true/false ----------

function TfQuestion({ question, answer, locked, onChange }) {
  const selected = answer?.selected ?? null;

  function pick(val) {
    if (locked) return;
    onChange({ selected: val });
  }

  function pillClasses(val) {
    const isSelected = selected === val;
    const isCorrect = val === question.correct;
    if (!locked) {
      return isSelected
        ? "bg-indigo-500/20 text-zinc-100 border-indigo-500"
        : "bg-zinc-800 text-zinc-200 border-zinc-800 hover:bg-zinc-700 motion-reduce:hover:bg-zinc-800";
    }
    if (isSelected && isCorrect) {
      return "bg-emerald-500/15 text-emerald-100 border-emerald-500/40";
    }
    if (isSelected && !isCorrect) {
      return "bg-rose-500/15 text-rose-100 border-rose-500/40";
    }
    if (!isSelected && isCorrect) {
      return "bg-emerald-500/10 text-emerald-200 border-emerald-500/30";
    }
    return "bg-zinc-800/40 text-zinc-400 border-zinc-800";
  }

  return (
    <div className="space-y-4">
      <div className="text-base text-zinc-100 break-words min-w-0">
        {question.prompt}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((val) => (
          <button
            key={String(val)}
            type="button"
            onClick={() => pick(val)}
            disabled={locked}
            className={`rounded-full border px-4 py-3 text-base font-medium transition-colors motion-reduce:transition-none ${pillClasses(
              val
            )}`}
          >
            {val ? "True" : "False"}
          </button>
        ))}
      </div>
      {locked ? (
        <div
          className={`rounded-md px-3 py-2 text-sm break-words min-w-0 ${
            selected === question.correct
              ? "bg-emerald-500/10 text-emerald-100"
              : "bg-rose-500/10 text-rose-100"
          }`}
        >
          <span className="font-medium">
            {selected === question.correct ? "Correct. " : "Not quite. "}
          </span>
          <span className="text-zinc-300">{question.explain}</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------- scoring ----------

function isCorrect(question, answer) {
  if (!answer) return false;
  if (question.kind === "mc") return answer.selected === question.correct;
  if (question.kind === "tf") return answer.selected === question.correct;
  if (question.kind === "match") {
    if (!answer.matches) return false;
    return question.pairs.every((p) => answer.matches[p.left] === p.right);
  }
  return false;
}

function questionLabel(q, idx) {
  if (q.kind === "match") return `Q${idx + 1} — Match deprecated APIs`;
  if (q.kind === "tf") return `Q${idx + 1} — True / false`;
  return `Q${idx + 1} — Multiple choice`;
}

// ---------- main ----------

export function Quiz({ questions = [] }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});

  const total = questions.length;
  const current = questions[index];
  const isLastQuestion = index === total - 1;
  const allLocked = questions.every((q) => locked[q.id]);

  function setAnswer(qId, value) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function lockCurrent() {
    if (!current) return;
    setLocked((prev) => ({ ...prev, [current.id]: true }));
  }

  function canLockCurrent() {
    if (!current) return false;
    const a = answers[current.id];
    if (!a) return false;
    if (current.kind === "mc") return !!a.selected;
    if (current.kind === "tf")
      return a.selected === true || a.selected === false;
    if (current.kind === "match") {
      return current.pairs.every((p) => a.matches && a.matches[p.left]);
    }
    return false;
  }

  function next() {
    if (index < total - 1) setIndex(index + 1);
  }

  function reset() {
    setIndex(0);
    setAnswers({});
    setLocked({});
  }

  const score = questions.reduce(
    (acc, q) => acc + (isCorrect(q, answers[q.id]) ? 1 : 0),
    0
  );

  if (total === 0) {
    return (
      <section className="px-margin py-lg">
        <div className="mx-auto max-w-4xl">
          <div className="bg-gradient-to-br from-surface-container to-surface-container-high border border-outline-variant p-md rounded-2xl text-on-surface-variant">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
              Quick Quiz
            </h3>
            <p className="font-body-base text-code-sm text-on-surface-variant">
              No quiz questions provided.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const lockedCount = Object.keys(locked).length;
  const progressPct = Math.round((lockedCount / total) * 100);
  const currentNum = Math.min(index + 1, total);
  const padded = (n) => String(n).padStart(2, "0");

  return (
    <section className="px-margin py-lg">
      <div className="mx-auto max-w-4xl">
      <div className="bg-gradient-to-br from-surface-container to-surface-container-high border border-outline-variant p-md rounded-2xl">
        <div className="flex justify-between items-start mb-md gap-sm">
          <div className="min-w-0">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
              Quick Quiz
            </h3>
            <p className="font-body-base text-code-sm text-on-surface-variant">
              Verify your migration knowledge.
            </p>
          </div>
          <span className="font-display-lg text-headline-md text-primary shrink-0">
            {padded(currentNum)}/{padded(total)}
          </span>
        </div>

        <div className="bg-background/50 p-gutter rounded-xl border border-outline-variant mb-md">
          {!allLocked ? (
            <>
              <div className="mb-3 text-xs uppercase tracking-widest font-bold text-zinc-500">
                {questionLabel(current, index)}
              </div>
              {current.kind === "match" ? (
                <MatchQuestion
                  question={current}
                  answer={answers[current.id]}
                  locked={!!locked[current.id]}
                  onChange={(v) => setAnswer(current.id, v)}
                  onSubmit={lockCurrent}
                />
              ) : current.kind === "mc" ? (
                <McQuestion
                  question={current}
                  answer={answers[current.id]}
                  locked={!!locked[current.id]}
                  onChange={(v) => setAnswer(current.id, v)}
                />
              ) : current.kind === "tf" ? (
                <TfQuestion
                  question={current}
                  answer={answers[current.id]}
                  locked={!!locked[current.id]}
                  onChange={(v) => setAnswer(current.id, v)}
                />
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                {current.kind !== "match" && !locked[current.id] ? (
                  <button
                    type="button"
                    onClick={lockCurrent}
                    disabled={!canLockCurrent()}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 motion-reduce:transition-none"
                  >
                    Check answer
                  </button>
                ) : null}
                {locked[current.id] && !isLastQuestion ? (
                  <button
                    type="button"
                    onClick={next}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-500/15 px-3 py-1.5 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25 motion-reduce:transition-none"
                  >
                    Next question
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
                {locked[current.id] && isLastQuestion ? (
                  <button
                    type="button"
                    onClick={() => setIndex(total)}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-500/15 px-3 py-1.5 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25 motion-reduce:transition-none"
                  >
                    See results
                    <Trophy className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <Summary
              questions={questions}
              answers={answers}
              score={score}
              onReset={reset}
            />
          )}
        </div>

        <div className="h-1.5 w-full bg-outline-variant rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${progressPct}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
      </div>
    </section>
  );
}

// ---------- summary ----------

function Summary({ questions, answers, score, onReset }) {
  const total = questions.length;
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest font-bold text-zinc-400">
            Done
          </div>
          <div className="text-xl font-semibold text-zinc-100">
            Score: {score} / {total}
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {questions.map((q, i) => {
          const ok = isCorrect(q, answers[q.id]);
          return (
            <li
              key={q.id}
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                ok ? "bg-emerald-500/10" : "bg-rose-500/10"
              }`}
            >
              {ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-zinc-100 break-words min-w-0">
                  {questionLabel(q, i)}
                  <span
                    className={`ml-2 text-xs ${
                      ok ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {ok ? "Correct" : "Missed"}
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-zinc-400 break-words min-w-0">
                  {q.prompt}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 motion-reduce:transition-none"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
