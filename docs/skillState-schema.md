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
      "encounters": 4
    },
    "niagara.emitters": {
      "level": "beginner",
      "confidence": 0.31,
      "lastSeenAt": "2026-04-19T09:10:00Z",
      "encounters": 1
    }
  }
}
```

Valid `level` values: `beginner` | `intermediate` | `expert`.
`confidence` is a float in `[0, 1]`. `encounters` is a non-negative integer.

## `sessions/{sessionId}` fields

`uid`, `mode`, `query`, `conversationHistory` (array), `result`, `createdAt`, `updatedAt`.

## `feedback/{feedbackId}` fields

`uid`, `sessionId`, `signal`, `tagTouched`, `createdAt`.
