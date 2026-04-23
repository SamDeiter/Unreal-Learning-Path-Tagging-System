# Prototype Slim-Down — 2026-04-22

No real users yet. Cuts over caution.

## What changed

### Gemini calls per query: 8-13 → 2

Before (typical): `embedQuery` + `expandQuery` + `vectorSearch×N` + `rerankPassages` + `intent` + (socratic? clarify? agentic?) + `diagnosis` + `objectives` + parallel(`validation`, `path_summary`, `micro_lesson`, `answer_data`) — **8 calls typical, 13 worst case.**

After: `embedQuery` (client) + `tutor_answer` (server) — **2 calls, always.** Firestore `findNearest` for retrieval is not an LLM call.

### Code footprint

| File | Before | After |
|---|---:|---:|
| `functions/ai/handleProblemFirst.js` | 1043 lines | 511 lines |
| `functions/ai/expandQuery.js` | exported | unexported (file kept) |
| `functions/ai/rerankPassages.js` | exported | unexported (file kept) |
| `path-builder/src/services/searchPipeline.js` | expand + rerank inline | both removed |

Legacy handler preserved as `functions/ai/handleProblemFirst.legacy.js` for diffing and for restoring any stage that earns its way back.

## What's gone (and why)

| Stage | Reason |
|---|---|
| `expandQuery` | Paraphrases were being fed to keyword-only search (null embedding). `gemini-embedding-001` is paraphrase-robust; the LLM call added no retrieval signal. |
| `rerankPassages` | Cross-encoder on 30 passages × 300 chars = ~9k tokens and 1-2s per query. Unverified benefit vs cosine-after-source-weights. |
| `intent` stage | Produced structured text that was immediately re-serialized into the diagnosis prompt. Merged into the unified answer stage. |
| `socratic` | Speculative UX feature with no eval evidence. Commented in legacy file; re-add after measurable win. |
| `clarify` multi-turn loop | Same. |
| `agentic RAG` escalation | Same. |
| `diagnosis` stage | Merged into unified answer. |
| `objectives` stage | Merged into unified answer. |
| `validation` stage | Curriculum sanity check — unverified value. |
| `path_summary` stage | Merged into unified answer. |
| `micro_lesson` stage | Quick-fix/why/related — duplicates info the unified answer already produces. |
| Sparse-answer backfill | Replaced by explicit refusal when `passages.length === 0`. No hidden failures. |
| Skill state / misconception / affective / UDL-reading-level prompt injection | Each was additive token cost with no eval signal. Re-add one at a time. |
| Cross-session `priorSessionSummary` | Same. |

## What's kept

Load-bearing pieces that earn their place even in prototype mode:

- App Check + Auth + rate limiting (required to be live at all).
- Input sanitization (security, not speculation).
- Diagnosis cache via Firestore vector KNN (unified `gemini-embedding-001`).
- Evidence block + anti-injection wrapper (`wrapEvidence`).
- Zod schema validation + one repair retry (via `runStage`).
- Citation parsing/validation (groundedness proxy — audit finding).
- Structured retrieval telemetry (single `rag_retrieval_trace` log per query).
- Explicit refusal on zero retrieval.
- Session + path cache + adaptive_carts writes (UI depends on cart shape).
- Off-topic detection via guardrail prefix.

## Unified prompt

One `tutor_answer` stage backed by `TutorAnswerSchema`. One system prompt. One JSON payload containing: `systems`, `mostLikelyCause`, `confidence`, `fastChecks`, `fixSteps`, `ifStillBroken`, `whyThisResult`, `objectives.{transferable, fixSpecific}`, `pathSummary`.

Prompt discipline: ruthless grounding contract ("invent nothing"), strict citation rules ("only [n] that appears in EVIDENCE"), explicit refusal path ("NO_DATA_AVAILABLE → ask for what's missing").

## Expected deltas

| Metric | Before | After | Notes |
|---|---|---|---|
| Gemini calls per query | 8-13 | 2 | 4-6x reduction |
| Latency p50 | ~6-8s | ~2-3s | mainly from 4 parallel stages → 1 |
| Latency p95 | ~12-15s | ~4-5s | worst case no longer includes clarify+agentic |
| Tokens per query | ~15-25k | ~3-5k | evidence sent once instead of 4x |
| Failure modes | 8+ stages | 2 | much easier to debug |

Numbers are estimates — re-measure with the eval harness.

## How to validate

1. `cd functions && npm test` (not yet run).
2. `cd path-builder && npm test` (not yet run).
3. Deploy to Firebase.
4. Run `node eval/rag_eval.js --retrieval-only --k 10` — retrieval metrics should be unchanged (no retrieval code moved).
5. Fire a manual problem-first query in the app; confirm exactly one `rag_retrieval_trace` log line and one `tutor_answer` stage in the request trace.

## Restoring features

Each cut feature is either (a) commented-out in the legacy file with a `// SLIMDOWN:` marker or (b) preserved verbatim in `handleProblemFirst.legacy.js`. To restore:

1. Add a golden case to `eval/rag_golden.jsonl` that the feature should improve.
2. Run baseline eval.
3. Add the feature back to the slim handler (don't wholesale-copy from legacy — rewrite around the unified schema).
4. Re-run eval. Ship only if metrics improve.

This is the eval-gated discipline the rebuild earns.

## Files changed

- `functions/ai/handleProblemFirst.js` — rewrite (1043 → 511 lines)
- `functions/ai/handleProblemFirst.legacy.js` — copy of previous version
- `functions/index.js` — dropped `expandQuery` and `rerankPassages` exports
- `functions/pipeline/schemas.js` — added `TutorAnswerSchema` and registered as `tutor_answer`
- `path-builder/src/services/searchPipeline.js` — removed expand + rerank calls
- `PROTOTYPE_SLIMDOWN.md` — this file
