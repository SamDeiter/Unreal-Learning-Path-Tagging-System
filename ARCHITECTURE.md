# Architecture Document

> System design, data flow, and authentication for the **Unreal Learning Path Tagging System**.

---

## System Overview

```mermaid
graph TB
    subgraph "Client (React SPA)"
        UI["React 19 + Vite"]
        CTX["PathContext / TagDataContext"]
        SVC["Service Layer (25 modules)"]
    end

    subgraph "Firebase"
        AUTH["Firebase Auth<br/>(Google Sign-In)"]
        FS["Cloud Firestore"]
        CF["Cloud Functions<br/>(Node.js 20)"]
        FH["Firebase Hosting<br/>(API)"]
    end

    subgraph "External"
        GD["Google Drive<br/>(Video Storage)"]
        GM["Gemini 2.0 Flash<br/>(AI)"]
        GHP["GitHub Pages<br/>(Frontend)"]
    end

    UI --> CTX --> SVC
    SVC --> AUTH
    SVC --> FS
    SVC --> CF --> GM
    CF --> FS
    UI -.->|iframe embed| GD
    GHP -->|serves| UI
```

---

## Authentication Flow

Authentication uses **Firebase Auth with Google Sign-In** combined with an **invite-based access control** layer.

### Login Sequence

```mermaid
sequenceDiagram
    actor User
    participant App as React App
    participant GA as googleAuthService
    participant FB as Firebase Auth
    participant AC as accessControl
    participant FS as Firestore

    User->>App: Click "Sign In"
    App->>GA: signInWithGoogle()
    GA->>FB: signInWithPopup(GoogleAuthProvider)
    FB-->>GA: user object (email, uid, etc.)
    GA-->>App: { user, error: null }
    App->>AC: isAuthorized(user)

    alt @epicgames.com email
        AC-->>App: true (auto-admitted)
    else Other email
        AC->>FS: getDoc("path_builder_access/{email}")
        FS-->>AC: exists?
        alt On allowlist
            AC-->>App: true
        else Not on allowlist
            AC-->>App: false
            App->>User: "Enter invite code"
            User->>App: invite code
            App->>AC: consumeInvite(code, email)
            AC->>FS: validate "path_builder_invites/{code}"
            AC->>FS: setDoc("path_builder_access/{email}")
            AC-->>App: { success: true }
        end
    end
```

### Access Tiers

| Role              | Criteria                   | Capabilities                                                   |
| ----------------- | -------------------------- | -------------------------------------------------------------- |
| **Admin**         | Hardcoded email list       | All features + invite management, feedback review, tag editing |
| **Epic Employee** | `@epicgames.com` domain    | Full access, auto-admitted                                     |
| **Invited User**  | Valid invite code consumed | Full access after code validation                              |
| **Anonymous**     | No auth                    | Blocked at `AuthGate` component                                |

### Key Files

| File                   | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `firebaseConfig.js`    | Firebase app initialization (env vars via `VITE_*`) |
| `googleAuthService.js` | Google Sign-In popup, sign-out, auth state listener |
| `accessControl.js`     | Domain check, Firestore allowlist, invite CRUD      |

---

## Data Flow

### Static Data (Build-Time)

These JSON files are bundled into the app at build time. No runtime fetching required.

```mermaid
graph LR
    subgraph "Source Data (JSON)"
        C["courses_enriched.json<br/>(course catalog)"]
        T["tags.json<br/>(tag taxonomy)"]
        E["edges.json<br/>(tag relationships)"]
        V["video_registry.json<br/>(video metadata)"]
        D["doc_links.json<br/>(Epic docs)"]
        Y["youtube_curated.json<br/>(curated YT)"]
        EM["course_embeddings.float16.bin<br/>(semantic vectors)"]
    end

    subgraph "Context Providers"
        TDC["TagDataContext<br/>(courses, tags, edges)"]
        PC["PathContext<br/>(user state, cart, path)"]
    end

    C & T & E & V --> TDC
    TDC --> PC
    D & Y --> SVC["Service Layer"]
    EM --> SVC
```

### Runtime Data (Firestore)

```mermaid
graph TB
    subgraph "Firestore Collections"
        PBA["path_builder_access/{email}<br/>• email, grantedAt, inviteCode"]
        PBI["path_builder_invites/{code}<br/>• maxUses, usedCount, revoked, expiresAt"]
        FB["feedback/{docId}<br/>• query, rating, comment, userId"]
        UF["userFeedback/{userId}/videoSignals/{videoId}<br/>• liked, completed, skippedAt"]
        AE["analytics_events/{docId}<br/>• type, timestamp, metadata"]
        AU["apiUsage/{docId}<br/>• type, outcome, pipelineDurationMs<br/>(written by Cloud Function)"]
    end
```

### User Query Pipeline

This is the core data flow when a user submits a problem:

```mermaid
sequenceDiagram
    actor User
    participant UI as ProblemFirst UI
    participant QN as QueryNormalizer
    participant SP as searchPipeline
    participant CF as Cloud Functions
    participant CM as courseMatching
    participant PB as PathBuilder
    participant GP as GuidedPlayer

    User->>UI: "My Lumen reflections are flickering"
    UI->>QN: normalize(query)
    QN-->>UI: cleaned query + detected tags

    UI->>SP: runSearchPipeline(query)
    SP->>CF: embedQuery(query)
    CF-->>SP: query embedding (768-dim)

    par Parallel Search
        SP->>SP: findSimilarCourses(embedding)
        SP->>SP: searchSegmentsHybrid(query, embedding)
        SP->>SP: searchDocsSemantic(embedding)
    end

    SP-->>UI: semanticResults + retrievedPassages
    UI->>CM: matchCoursesToCart(cartData, courses)
    CM-->>UI: ranked courses
    UI->>PB: buildLearningPath(courses, tags)
    PB-->>UI: sequenced path with roles
    UI->>GP: launch guided player
    GP->>CF: generateNarration(context)
    CF->>CF: Gemini 2.0 Flash
    CF-->>GP: AI narration text
```

---

## Deployment Architecture

```mermaid
graph LR
    subgraph "CI/CD"
        GH["GitHub (master branch)"]
        GA["GitHub Actions<br/>deploy.yml"]
        GHP["GitHub Pages<br/>(gh-pages branch)"]
    end

    subgraph "Firebase"
        FH["Firebase Hosting"]
        CF["Cloud Functions"]
    end

    GH -->|push to master| GA
    GA -->|npm ci + build| GA
    GA -->|deploy action| GHP
    GHP -->|serves SPA| USER["End Users"]
    FH -->|API endpoints| CF
    USER -->|API calls| CF
```

### Build Pipeline

1. Developer pushes to `master`
2. `deploy.yml` triggers: checkout → Node 20 → `npm ci` → `npm run build`
3. Firebase secrets injected as env vars (`VITE_FIREBASE_*`)
4. `JamesIves/github-pages-deploy-action` pushes `dist/` to `gh-pages` branch
5. GitHub Pages serves the SPA

### Environment Variables

All secrets are stored as **GitHub Actions secrets** and injected at build time:

| Variable                            | Purpose                        |
| ----------------------------------- | ------------------------------ |
| `VITE_FIREBASE_API_KEY`             | Firebase Web API key           |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Auth domain for Google Sign-In |
| `VITE_FIREBASE_PROJECT_ID`          | Firestore project identifier   |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Cloud Storage bucket           |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID                  |
| `VITE_FIREBASE_APP_ID`              | Firebase app identifier        |

> **Security**: No secrets are committed to the repository. Local development uses a `.env` file (gitignored).

---

## Firestore Security Rules

- **Read/Write** on `path_builder_access` and `path_builder_invites`: authenticated users only
- **Write** on `feedback` and `analytics_events`: authenticated users, scoped to own data
- **Write** on `apiUsage`: Cloud Functions only (admin SDK)
- **Read** on `userFeedback`: scoped to authenticated user's own subcollection

---

## Key Services Reference

| Service                    | Responsibility                                | External Dependencies                                     |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `searchPipeline.js`        | Orchestrates embed → expand → search → rerank | Cloud Functions (embedQuery, expandQuery, rerankPassages) |
| `semanticSearchService.js` | Cosine similarity against course embeddings   | None (client-side)                                        |
| `segmentSearchService.js`  | TF-IDF transcript segment search              | None (client-side)                                        |
| `coverageAnalyzer.js`      | Multi-source coverage analysis                | docsSearchService, externalContentService                 |
| `PathBuilder.js`           | Sequencing, role assignment, time budgeting   | None (pure logic)                                         |
| `narratorService.js`       | AI narration generation                       | Cloud Functions (Gemini)                                  |
| `PersonaService.js`        | Persona detection + messaging                 | None (pure logic)                                         |
| `feedbackService.js`       | User feedback + video signals                 | Firestore                                                 |
| `analyticsService.js`      | Event logging                                 | Firestore                                                 |
| `accessControl.js`         | Auth gating + invite system                   | Firestore                                                 |
