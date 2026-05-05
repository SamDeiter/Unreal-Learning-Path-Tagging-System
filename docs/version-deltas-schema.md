# Version Deltas — Data Model

Tracks UE engine elements and how they change between versions, so the path-builder can tell learners when a tutorial video's content differs from their installed UE version.

> Naming note: the existing `atoms/` directory holds **learning atoms** (teaching units). To avoid collision, version-delta units are called **engine refs**.

## Collections

### `engineRefs/{refId}`

One document per nameable UE element (module, class, function, Blueprint node, menu path, console command, plugin, property, etc.).

```json
{
  "refId": "ref_metahumancapturesource_module",
  "kind": "module",
  "canonicalName": "MetaHumanCaptureSource Module",
  "aliases": ["MetaHuman Capture Source"],
  "area": "MetaHuman Animator",
  "versions": {
    "5.6": { "exists": true, "location": null, "notes": "" },
    "5.7": { "exists": false, "deprecatedIn": "5.7", "removedIn": null, "replacement": "Capture Manager Plugin", "notes": "Module deprecated; functionality moved into Capture Manager Plugin." }
  },
  "changeLog": [
    {
      "from": "5.6",
      "to": "5.7",
      "changeType": "deprecated",
      "severity": "breaking",
      "summary": "MetaHumanCaptureSource module removed; use Capture Manager Plugin instead.",
      "source": { "provider": "jira", "ref": "MH-16160", "url": "https://epicgames.atlassian.net/browse/MH-16160" }
    }
  ],
  "status": "draft",
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

**Field notes:**

- `kind` — one of: `module`, `class`, `function`, `property`, `blueprint_node`, `menu_path`, `console_cmd`, `plugin`, `shortcut`, `default_value`, `workflow_step`, `asset_type`. Drives UI grouping.
- `area` — denormalized from Jira `components[0].name` for quick filtering by feature area.
- `versions[N]` — keyed by UE major.minor. `exists: false` means the element no longer exists in that version. `replacement` is free text pointing to the successor.
- `changeLog[]` — append-only. New entries added when curators or the extractor detect a transition.
- `status` — `draft` (extractor wrote it, awaits curator) | `verified` (curator approved) | `rejected` (curator dismissed).
- `source` — provenance for the change entry. Jira ticket, UDN page URL, or `manual`.

### `engineRefMentions/{mentionId}`

Links an `engineRef` to a video (or learning-path step) at a specific timestamp. Created at video-ingest time by NLP matching against the engineRef catalog, or manually.

```json
{
  "mentionId": "mention_<videoId>_<refId>_<timestampSec>",
  "videoId": "abc123",
  "refId": "ref_metahumancapturesource_module",
  "timestampSec": 142,
  "durationSec": 8,
  "context": "transcript",
  "confidence": 0.92,
  "stepRefs": ["step-3"],
  "authoredBy": "ingest-nlp"
}
```

**Field notes:**

- `context` — `title` | `description` | `transcript` | `chapter` | `visual` | `manual`.
- `stepRefs` — optional learning-path step IDs that anchor on this mention.
- `authoredBy` — `ingest-nlp` | `manual` | `tutor-flagged`.

### `videos` (existing collection — additive field)

Add a single field to existing video docs:

```json
{
  "engineVersion": "5.6"
}
```

Parsed at ingest from title/description/tags. Required for delta computation. Backfill script needed for existing videos.

## Delta computation (read-side, no separate collection)

Deltas are **derived**, not stored. For a given video and a learner's engine version:

```js
// Pseudocode — runs client-side in path-builder
function deltasForVideo(video, userVersion) {
  const mentions = await getMentions(video.id);
  const deltas = [];
  for (const m of mentions) {
    const ref = await getEngineRef(m.refId);
    const change = ref.changeLog.find(c =>
      versionGTE(userVersion, c.to) && versionGTE(c.to, video.engineVersion)
    );
    if (change && change.severity !== "minor-noncritical") {
      deltas.push({ ref, change, mention: m });
    }
  }
  return deltas;
}
```

A 5.6 video viewed by a 5.8 user automatically picks up 5.6→5.7 *and* 5.7→5.8 changes.

## Curator flow

1. **Extractor** (Cloud Function or local script) reads Jira tickets via HODOR, calls Gemini to extract `engineRef` candidates, writes them with `status: "draft"`.
2. **Curator UI** (path-builder admin route) shows draft queue. Curator can approve, edit, or reject.
3. **On approve**: `status: "verified"`, surface to learners.

## Surfacing in the UI (three places)

1. **Video card chip** — "⚠️ N changes since 5.6" if `userVersion > video.engineVersion` and any mentions resolve to a delta.
2. **Inline player callout** — at `mention.timestampSec`, show `change.summary` + `replacement`.
3. **Tutor grounding** — pass matching deltas into the prompt so answers reflect the user's version, not the source video's.

## Indexes

Composite indexes to add to `firestore.indexes.json`:

- `engineRefs`: (`status`, `updatedAt`) for curator queue
- `engineRefMentions`: (`videoId`, `confidence`) for fast mention lookup
- `engineRefs`: (`area`, `status`) for area-filtered review

## Firestore rules (sketch)

- `engineRefs` — read public; write only by curators (`request.auth.token.curator == true`).
- `engineRefMentions` — read public; write by curators or by Cloud Function service account.
- `videos.engineVersion` — additive update by ingest function only.
