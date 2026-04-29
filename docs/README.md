# Project Documentation

Planning, architecture, and audit docs that used to live at the repo root. The
top-level `README.md` covers setup and day-to-day use; everything below is
deeper context.

## Active references

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Service map, data flows, and component
  layout for the tutor + path-builder.
- [EVAL_PLAN.md](./EVAL_PLAN.md) — RAG/answer-quality eval methodology and
  metrics. Keep current with anything in `eval/`.
- [RAG_AUDIT.md](./RAG_AUDIT.md) — Issue tracker for the retrieval pipeline.
  Mark items resolved as fixes land.
- [skillState-schema.md](./skillState-schema.md) — Firestore schema for the
  PFA knowledge tracing layer.

## Historical / pinned-in-time

- [CHANGES.md](./CHANGES.md) — Dated changelog. Append-only.
- [PLAN.md](./PLAN.md), [ROADMAP_v8.md](./ROADMAP_v8.md) — Older planning
  snapshots; kept for context, not load-bearing.
- [PROTOTYPE_SLIMDOWN.md](./PROTOTYPE_SLIMDOWN.md) — Notes from the 2026-04
  pipeline simplification.
