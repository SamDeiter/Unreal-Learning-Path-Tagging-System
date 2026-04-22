# skillState Schema

Contract for the digital-tutor user state stored at `users/{uid}` in Firestore.
Wave 2 handlers read/write against this shape. Keep fields additive.

## Path layout

- `users/{uid}` — main profile + skill state
- `users/{uid}/sessions/{sessionId}` — conversation history (Wave 1A writer)
- `users/{uid}/feedback/{feedbackId}` — quality signals (Wave 2)

## `users/{uid}` fields

| Field            | Type      | Notes                                                   |
| ---------------- | --------- | ------------------------------------------------------- |
| `skillState`     | map       | Keyed by topic tag. See shape below.                    |
| `topicsLearned`  | string[]  | Flat list of tag strings the user has completed.        |
| `lastQueryAt`    | timestamp | Last time the user issued a tutor query.                |
| `lastPathId`     | string?   | Optional — most recent generated path id.               |
| `persona`        | string?   | Optional — e.g., `gameplay-programmer`.                 |
| `createdAt`      | timestamp | Server timestamp on create.                             |
| `updatedAt`      | timestamp | Server timestamp on every write.                        |

### `skillState` map shape

```json
{
  "skillState": {
    "blueprints.basics": {
      "level": "intermediate",
      "confidence": 0.72,
      "lastSeenAt": "2026-04-21T14:02:11Z",
      "encounters": 4,
      "successes": 3,
      "failures": 1,
      "opportunities": 4,
      "mastery": 0.62
    },
    "niagara.emitters": {
      "level": "beginner",
      "confidence": 0.31,
      "lastSeenAt": "2026-04-19T09:10:00Z",
      "encounters": 1,
      "successes": 0,
      "failures": 0,
      "opportunities": 1,
      "mastery": 0.27
    }
  }
}
```

Valid `level` values: `beginner` | `intermediate` | `expert`.
`confidence` is a float in `[0, 1]`. `encounters` is a non-negative integer.

#### Performance Factor Analysis (PFA) fields — Phase 2A

Additive, nullable on legacy documents. Defaults: `0`.

| Field            | Type  | Notes                                                    |
| ---------------- | ----- | -------------------------------------------------------- |
| `successes`      | int   | Count of successful interactions on this tag.            |
| `failures`       | int   | Count of failed interactions on this tag.                |
| `opportunities`  | int   | Total attempts = successes + failures + encounters-only. |
| `mastery`        | float | PFA probability of a correct next response, in `[0, 1]`. |

**Signal → counter mapping** (applied by `skillStateWriter.js`):

| Signal       | successes | failures | opportunities |
| ------------ | --------- | -------- | ------------- |
| `mastered`   | +1        |          | +1            |
| `completed`  | +1        |          | +1            |
| `struggled`  |           | +1       | +1            |
| `encountered`|           |          | +1            |
| `rejected`   | no-op     | no-op    | no-op         |

**PFA mastery formula** (simplified logistic form; see `computeMastery` in
`functions/ai/skillStateWriter.js`):

```text
logit   = β0 + γ · successes + ρ · failures
mastery = 1 / (1 + exp(-logit))
```

Default coefficients (exported as `PFA_COEFFICIENTS`, tune as data accrues):

| Coefficient | Value |
| ----------- | ----- |
| `β0`        | -1.0  |
| `γ`         |  0.4  |
| `ρ`         | -0.3  |

The logit is clamped to `[-10, 10]` for numerical stability on extreme counters.

`mastery` interacts with `level` on the upgrade path only:

- `mastery > 0.85` → `level = expert`
- `mastery > 0.5` & current `beginner` → `level = intermediate`
- Downgrades remain the responsibility of the confidence-driven
  `downgradeLevel` path so `struggled` still erodes level.

## `sessions/{sessionId}` fields

`uid`, `mode`, `query`, `conversationHistory` (array), `result`, `createdAt`, `updatedAt`.

## `feedback/{feedbackId}` fields

`uid`, `sessionId`, `signal`, `tagTouched`, `createdAt`.
