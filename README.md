# Unreal Learning Path Tagging System

A **problem-first learning platform** for Unreal Engine 5. Users describe their problem in plain language, and the system generates a personalized learning path with AI-narrated video sequences, persona-aware onboarding, semantic search, and interactive analytics.

> **Philosophy**: Problem-solving over tutorials. Debugging literacy over passive consumption.

[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-blue?logo=github)](https://samdeiter.github.io/Unreal-Learning-Path-Tagging-System/)

---

## 🎯 What It Does

1. **Persona Onboarding** — 3-question quiz identifies user role (Artist, Programmer, Designer, etc.) to personalize the experience
2. **Problem Analysis** — User describes their UE5 issue in plain language
3. **Intelligent Matching** — Hybrid pipeline: semantic embeddings → transcript search → tag-based fallback with confidence routing
4. **Guided Learning Path** — AI-narrated sequence: intro → videos → quizzes → challenges → reflection
5. **Analytics & Insights** — Tag heatmaps, skill radar, prerequisite flows, industry demand gap analysis, and more
6. **Enrichment Pipeline** — Gemini-powered summaries, learning objectives, quizzes, prerequisites, and embeddings

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite 7 (in `path-builder/`) |
| **State** | React Context (`PathContext`, `TagDataContext`) |
| **Visualizations** | Cytoscape.js (tag graph), custom chart components |
| **Backend** | Firebase Cloud Functions (Node.js 20) |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Auth with Google Sign-In + invite-based access control |
| **AI** | Google Gemini 2.0 Flash (enrichment, narration, embeddings) |
| **Search** | Semantic embeddings + TF-IDF transcript index + tag matching |
| **Hosting** | GitHub Pages (frontend), Firebase Hosting (API) |
| **Testing** | Vitest + React Testing Library + Playwright (316 tests) |
| **Linting** | ESLint 9 (flat config) + Stylelint |

---

## 📁 Project Structure

```
├── path-builder/                  # React app (main UI)
│   ├── src/
│   │   ├── components/            # 24 component modules
│   │   │   ├── ProblemFirst/      # "Fix a Problem" — main user-facing flow
│   │   │   ├── GuidedPlayer/      # AI-narrated learning experience
│   │   │   ├── PersonaQuiz/       # Role-detection onboarding quiz
│   │   │   ├── TagGraph/          # Interactive Cytoscape tag relationship graph
│   │   │   ├── Visualizations/    # Analytics charts (heatmaps, radar, trends)
│   │   │   ├── Dashboard/         # Overview dashboard
│   │   │   ├── AssemblyLine/      # Drag-and-drop path assembly
│   │   │   ├── CourseLibrary/     # Browsable course catalog
│   │   │   ├── AdminFeedback/     # Admin feedback review panel
│   │   │   └── ...               # AuthGate, InviteManager, Feedback, etc.
│   │   ├── context/               # PathContext, TagDataContext, constants
│   │   ├── hooks/                 # 7 custom hooks (useProblemFirst, useGuidedPlayer, etc.)
│   │   ├── services/              # 25 service modules
│   │   │   ├── searchPipeline.js          # Orchestrates search strategies
│   │   │   ├── segmentSearchService.js    # TF-IDF transcript segment search
│   │   │   ├── semanticSearchService.js   # Embedding-based semantic search
│   │   │   ├── geminiService.js           # Gemini AI integration
│   │   │   ├── narratorService.js         # AI narrator for guided paths
│   │   │   ├── PersonaService.js          # Persona detection & personalization
│   │   │   ├── accessControl.js           # Invite-based access + admin roles
│   │   │   ├── analyticsService.js        # Usage analytics
│   │   │   └── ...                        # feedbackService, TagGraphService, etc.
│   │   ├── data/                  # 24 static JSON data files (~30MB total)
│   │   │   ├── video_library_enriched.json  # Core course + video catalog
│   │   │   ├── segment_embeddings.json      # Semantic vectors (~6MB)
│   │   │   ├── search_index.json            # TF-IDF search index (~5MB)
│   │   │   ├── transcript_segments.json     # 7,000+ parsed transcript segments
│   │   │   ├── tags.json                    # 500+ tag definitions
│   │   │   ├── personas.json                # Persona definitions & routing
│   │   │   └── ...                          # edges, prerequisites, challenges, etc.
│   │   └── utils/                 # Shared helpers (stemming, stopwords, float16, etc.)
│   └── vite.config.js             # Advanced code-splitting (vendor, data, search chunks)
├── functions/                     # Firebase Cloud Functions
│   ├── ai/                        # Gemini-powered AI endpoints
│   ├── data/                      # Data management functions
│   ├── pipeline/                  # Server-side enrichment pipeline
│   ├── triggers/                  # Firestore event triggers
│   └── scheduled/                 # Cron/scheduled functions
├── scripts/                       # 83+ build-time enrichment & data scripts
│   ├── build_embeddings.py                # Generate semantic embeddings
│   ├── build_search_index.py              # Build TF-IDF search index
│   ├── build_transcript_index.py          # Parse VTT → transcript segments
│   ├── summarize_segments.py              # Gemini transcript summaries
│   ├── generate_learning_objectives.py    # Course objectives
│   ├── generate_quiz_questions.py         # Video MCQs
│   ├── detect_prerequisites.py            # Prerequisite detection
│   ├── augment_transcript.py              # Transcript augmentation
│   ├── scrape_epic_docs.py                # UDN documentation scraping
│   ├── embed_segments.py                  # Segment embedding generation
│   └── ...                                # 70+ more enrichment/audit/validation scripts
├── content/transcripts/           # 616+ VTT transcript files
├── tags/                          # Tag schema & relationship graph
├── docs/                          # Architecture & strategy documentation
├── prototype/                     # Standalone prototypes (augmentation dashboard, etc.)
├── firestore.rules                # Firestore security rules
├── firebase.json                  # Firebase project configuration
└── .env.example                   # Environment variable template
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.10+ (for enrichment scripts)
- A Google account (for Firebase Auth sign-in)

### Development

```bash
cd path-builder
npm install
npm run dev          # http://localhost:5173/Unreal-Learning-Path-Tagging-System/
```

### Run Tests

```bash
cd path-builder
npm test             # Unit + component + regression tests (300 tests, ~3s)
npm run test:watch   # Watch mode
npm run test:e2e     # Playwright E2E browser tests (9 tests, ~13s)
```

Tests are organized in 7 phases — see [CHANGES.md](./CHANGES.md) for details. CI runs automatically via GitHub Actions on push/PR.

### Run Linters

```bash
cd path-builder
npm run lint         # ESLint
npm run lint:css     # Stylelint
```

### Enrichment Pipeline

```powershell
# Set API key (one-time, persists across sessions)
[System.Environment]::SetEnvironmentVariable("GOOGLE_API_KEY", "your_key", "User")

# Run all enrichment scripts
python scripts/run_enrichment_pipeline.py
```

---

## 🧩 Application Tabs

| Tab | Description |
|-----|-------------|
| **📊 Dashboard** | Overview of content library, tag coverage, and system health |
| **📚 Path Readiness** | Evaluate which learning paths are ready for deployment |
| **🏷️ Tag Sources** | Compare tag origins (canonical, AI, transcript, Gemini) |
| **✏️ Tag Editor** | Edit and curate tag assignments per course |
| **🏗️ Path Builder** | Drag-and-drop learning path assembly with intent headers |
| **🚀 Onboarding** | Persona definitions and onboarding flow management |
| **🔧 Fix a Problem** | The main user-facing "describe your problem" search flow |
| **📊 Analytics** | Rich visualizations: tag heatmaps, skill radar, demand gaps, prerequisite flows |
| **🔬 Augmentation** | Embedded dashboard for transcript augmentation quality monitoring |
| **🎟️ Invites** | Admin-only invite code management |
| **📋 Feedback** | Admin-only user feedback review and triage |

---

## 🧪 Enrichment Pipeline

| Script | Output | Purpose |
|--------|--------|---------|
| `build_transcript_index.py` | `transcript_segments.json` | Parse 616 VTT files → 7,000+ segments |
| `build_embeddings.py` | `course_embeddings.json` | Semantic vectors for course matching |
| `embed_segments.py` | `segment_embeddings.json` | Semantic vectors for segment-level search |
| `build_search_index.py` | `search_index.json` | TF-IDF index for fast text search |
| `summarize_segments.py` | Updates `transcript_segments.json` | Natural language summaries per segment |
| `generate_learning_objectives.py` | `learning_objectives.json` | 3–5 objectives per course |
| `generate_quiz_questions.py` | `quiz_questions.json` | 2–3 MCQs per video |
| `detect_prerequisites.py` | `course_prerequisites.json` | Prerequisite relationships |
| `augment_transcript.py` | Augmented transcripts | Add context, keywords, and summaries |

All AI-powered scripts use the Google Gemini API.

---

## 🔒 Access Control

The platform uses **invite-based access**:
- Users must sign in with Google via Firebase Auth
- Access is granted through invite codes managed by admins
- Admin users get additional tabs (Invites, Feedback) for platform management

---

## 🔗 Related Projects

- [UE5QuestionGenerator](https://github.com/SamDeiter/UE5QuestionGenerator)
- [UE5LMSBlueprint](https://github.com/SamDeiter/UE5LMSBlueprint)
- [UE5LMSMaterials](https://github.com/SamDeiter/UE5LMSMaterials)

---

## License

MIT License
