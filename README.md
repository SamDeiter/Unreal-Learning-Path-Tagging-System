# Unreal Learning Path Tagging System

A **problem-first learning platform** for Unreal Engine 5. Users describe their problem in plain language, and the system generates a personalized learning path with AI-narrated video sequences, persona-aware onboarding, semantic search, and interactive analytics.

> **Philosophy**: Problem-solving over tutorials. Debugging literacy over passive consumption.

[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-blue?logo=github)](https://samdeiter.github.io/Unreal-Learning-Path-Tagging-System/)

---

## 🎯 What It Does

1. **Persona Onboarding** — 3-question quiz identifies user role (Artist, Programmer, Designer, etc.) to personalize the experience
2. **Problem Analysis** — User describes their UE5 issue in plain language; skeleton preview shows while AI diagnoses
3. **Intelligent Matching** — Hybrid pipeline: semantic embeddings → transcript search → tag-based fallback with confidence routing
4. **Experience-Aware Ordering** — Prerequisite sorting based on user experience level and topic generality
5. **Guided Learning Path** — AI-narrated sequence: intro → videos → quizzes → challenges → reflection
6. **Citation-linked Answers** — Diagnosis responses include clickable `[N]` references linking to Vertex AI documentation
7. **Dashboard Insights** — Readiness score, persona coverage chart, content gap analysis, quick search, and tooltips on all metrics
8. **Analytics & Insights** — Admin dashboard with parallel data loading, RAG pipeline health metrics (similarity scores, fallback rates, collection breakdown), AI cost tracking, daily volume charts, and persona distribution
9. **Content Gap Intelligence** — Tracks where official docs fall short: AI fill rate, top content gaps ranked by AI ratio, most common knowledge gaps, and per-query coverage analysis
10. **Bespoke Learning Paths** — AI-generated personalized paths using RAG + transcript search, Firestore vector search, security guardrails, and 10 pre-seeded popular paths
11. **Adaptive Learning Paths** — Diagnostic quiz (with image-based questions) builds a knowledge profile, then generates a depth-adjusted path with Blueprint-first content bias, audio briefings with auto-advance, and an end-of-path knowledge check quiz
12. **Hybrid AI Fallback** — When corpus coverage is too low, generates learning paths from Gemini's general UE5 knowledge with workflow intent matching (e.g., assumes FAB assets for "create a sword" queries). Gated by the Query Feasibility Gate to prevent hallucinations on off-topic queries
13. **Query Feasibility Gate** — Blocks off-topic queries (e.g., "Horses in UE5") from triggering AI-generated paths. Checks queries against 80+ UE5 domain terms before allowing hybrid fallback. Shows a rich "Topic Not Covered" card with clickable UE5 query suggestions
14. **Enrichment Pipeline** — Gemini-powered summaries, learning objectives, quizzes, prerequisites, and embeddings
15. **Mobile Responsive** — Optimized for phone (375px), tablet (768px), and desktop viewports with adaptive drawer navigation

---

## 🛠️ Tech Stack

| Layer              | Technology                                                                         |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Frontend**       | React 19 + Vite 7 (in `path-builder/`)                                             |
| **State**          | React Context (`PathContext`, `TagDataContext`)                                    |
| **Visualizations** | Cytoscape.js (tag graph), custom chart components                                  |
| **Backend**        | Firebase Cloud Functions (Node.js 20, rate-limited)                                |
| **Database**       | Firebase Firestore                                                                 |
| **Auth**           | Firebase Auth with Google Sign-In + invite-based access control                    |
| **AI**             | Google Gemini 2.0 Flash (enrichment, narration, embeddings, grounding)             |
| **Search**         | Firestore vector search + TF-IDF transcript index + Vertex AI docs + tag matching  |
| **Embeddings**     | 3,622 doc chunks (1,880 scraped + 1,742 UDN/Perforce) + 2,402 segment chunks       |
| **Hosting**        | GitHub Pages (frontend), Firebase Hosting (API)                                    |
| **Testing**        | Vitest + React Testing Library + Playwright (566 tests)                            |
| **Security**       | DOMPurify (XSS sanitization), Firebase Security Rules, invite-based access control |
| **Linting**        | ESLint 9 (flat config) + Stylelint                                                 |

---

## 📁 Project Structure

```
├── path-builder/                  # React app (main UI)
│   ├── src/
│   │   ├── components/            # 27 component modules
│   │   │   ├── MobileNav/         # Adaptive hamburger drawer navigation
│   │   │   ├── ProblemFirst/      # "Fix a Problem" — main user-facing flow
│   │   │   ├── GuidedPlayer/      # AI-narrated learning experience
│   │   │   ├── PersonaQuiz/       # Role-detection onboarding quiz
│   │   │   ├── AdaptivePath/      # Diagnostic quiz → depth-adjusted learning path
│   │   │   ├── DemandDashboard/   # Community demand analysis + authoring suggestions
│   │   │   ├── AuthoringWorkbench/ # 5-stage course creation pipeline (Plan→Export)
│   │   │   ├── BespokePath/       # On-demand AI-generated learning paths
│   │   │   ├── TagGraph/          # Interactive Cytoscape tag relationship graph
│   │   │   ├── Visualizations/    # Analytics charts (heatmaps, radar, trends)
│   │   │   ├── Dashboard/         # Overview dashboard + Content Gap Analysis
│   │   │   ├── AssemblyLine/      # Drag-and-drop path assembly
│   │   │   ├── CourseLibrary/     # Browsable course catalog
│   │   │   ├── TagEditor/         # Bulk tagging, synonym mapping + edge editor
│   │   │   ├── AdminFeedback/     # Admin feedback review panel
│   │   │   └── ...               # AuthGate, InviteManager, Feedback, etc.
│   │   ├── context/               # PathContext, TagDataContext, constants
│   │   ├── hooks/                 # 9 custom hooks (useIsMobile, useProblemFirst, etc.)
│   │   ├── services/              # 29 service modules
│   │   │   ├── searchPipeline.js          # Orchestrates search strategies
│   │   │   ├── segmentSearchService.js    # TF-IDF transcript segment search
│   │   │   ├── semanticSearchService.js   # Embedding-based semantic search
│   │   │   ├── geminiService.js           # Gemini AI integration
│   │   │   ├── narratorService.js         # AI narrator for guided paths
│   │   │   ├── PersonaService.js          # Persona detection & personalization
│   │   │   ├── accessControl.js           # Invite-based access + admin roles
│   │   │   ├── analyticsService.js        # Usage analytics
│   │   │   ├── demandIntelligenceService.js # Community demand analysis + scoring
│   │   │   ├── videoBriefService.js         # Recording brief generation for authoring
│   │   │   └── ...                          # feedbackService, TagGraphService, etc.
│   │   ├── data/                  # 20+ static JSON data files (~22MB after Firestore vector migration)
│   │   │   ├── video_library_enriched.json  # Core course + video catalog
│   │   │   ├── segment_embeddings.json      # Semantic vectors (~6MB)
│   │   │   ├── search_index.json            # TF-IDF search index (~5MB)
│   │   │   ├── transcript_segments.json     # 7,000+ parsed transcript segments
│   │   │   ├── tags.json                    # 500+ tag definitions
│   │   │   ├── personas.json                # Persona definitions & routing
│   │   │   └── ...                          # edges, prerequisites, challenges, etc.
│   │   ├── utils/                 # Shared helpers (stemming, stopwords, float16, etc.)
│   │   └── __tests__/fixtures/    # Shared test fixtures (production-realistic course data)
│   └── vite.config.js             # Advanced code-splitting (vendor, data, search chunks)
├── functions/                     # Firebase Cloud Functions
│   ├── ai/                        # Gemini-powered AI endpoints
│   ├── data/                      # Data management functions
│   ├── pipeline/                  # Server-side enrichment pipeline
│   ├── triggers/                  # Firestore event triggers
│   └── scheduled/                 # Cron/scheduled functions
├── scripts/                       # 110+ build-time enrichment & data scripts
│   ├── build_embeddings.py                # Generate semantic embeddings
│   ├── build_search_index.py              # Build TF-IDF search index
│   ├── build_transcript_index.py          # Parse VTT → transcript segments
│   ├── summarize_segments.py              # Gemini transcript summaries
│   ├── generate_learning_objectives.py    # Course objectives
│   ├── generate_quiz_questions.py         # Video MCQs
│   ├── detect_prerequisites.py            # Prerequisite detection
│   ├── augment_transcript.py              # Transcript augmentation
│   ├── scrape_epic_docs.py                # UDN documentation scraping
│   ├── embed_udn_docs.py                 # Perforce UDN doc embedding (parallel)
│   ├── embed_segments.py                  # Segment embedding generation
│   ├── drive_to_txt.py                    # GPU Whisper video transcription
│   ├── whisper_cms_transcripts_v2.py      # 2-phase CMS Whisper pipeline
│   ├── clean_whisper_transcripts.py       # Transcript cleanup & hallucination detection
│   ├── embed_epic_learning.py             # Epic Learning RAG embeddings
│   ├── merge_embeddings.py                # Merge scraped + UDN doc embeddings
│   ├── content_gap_analysis.py            # Content gap identification
│   ├── deploy_ghpages.py                  # Orphan-branch GitHub Pages deploy
│   └── ...                                # 80+ more enrichment/audit/validation scripts
├── content/epic_learning/         # Epic Learning transcript pipeline
│   ├── transcripts/               # 1,900+ transcript files (yt_*, cms_*, whisper_*, lesson_*)
│   ├── video_manifest.json        # 34 YouTube + 187 CMS video catalog
│   ├── lesson_stream_urls.json    # 793+ lesson stream manifests
│   └── whisper_priority.json      # 118 priority videos for Whisper
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
npm test             # Unit + component + regression tests (546 tests, ~40s)
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

| Tab                   | Description                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **📊 Dashboard**      | Readiness score, persona coverage chart, quick search, tag cloud, tooltips on all metrics                               |
| **📚 Path Readiness** | Evaluate which learning paths are ready for deployment                                                                  |
| **🏷️ Tag Sources**    | Compare tag origins (canonical, AI, transcript, Gemini)                                                                 |
| **✏️ Tag Editor**     | Edit and curate tag assignments per course                                                                              |
| **🏗️ Path Builder**   | Drag-and-drop learning path assembly with intent headers                                                                |
| **🚀 Onboarding**     | Persona definitions and onboarding flow management                                                                      |
| **🔧 Fix a Problem**  | Describe your problem → skeleton loader → AI diagnosis with citation links, search history, and enhanced error recovery |
| **📊 Analytics**      | Rich visualizations: tag heatmaps, skill radar, demand gaps, prerequisite flows                                         |
| **🧩 Content Gaps**   | Content gap intelligence: AI fill rate, top gaps, knowledge gap frequency, path generation analysis                     |
| **🔬 Augmentation**   | Embedded dashboard for transcript augmentation quality monitoring                                                       |
| **🎟️ Invites**        | Admin-only invite code management                                                                                       |
| **📋 Feedback**       | Admin-only user feedback review and triage                                                                              |
| **📊 Demand Intel**   | Community demand analysis: opportunity-ranked suggestions, category filters, source-linked insights, Start Brief flow   |
| **✍️ Authoring**       | 5-stage course creation: Plan → Review → Brief → Link → Export with SCORM 1.2 packaging and V3 viewer export           |

---

## 🧪 Enrichment Pipeline

| Script                            | Output                             | Purpose                                   |
| --------------------------------- | ---------------------------------- | ----------------------------------------- |
| `build_transcript_index.py`       | `transcript_segments.json`         | Parse 616 VTT files → 7,000+ segments     |
| `build_embeddings.py`             | `course_embeddings.json`           | Semantic vectors for course matching      |
| `embed_segments.py`               | `segment_embeddings.json`          | Semantic vectors for segment-level search |
| `build_search_index.py`           | `search_index.json`                | TF-IDF index for fast text search         |
| `summarize_segments.py`           | Updates `transcript_segments.json` | Natural language summaries per segment    |
| `generate_learning_objectives.py` | `learning_objectives.json`         | 3–5 objectives per course                 |
| `generate_quiz_questions.py`      | `quiz_questions.json`              | 2–3 MCQs per video                        |
| `detect_prerequisites.py`         | `course_prerequisites.json`        | Prerequisite relationships                |
| `augment_transcript.py`           | Augmented transcripts              | Add context, keywords, and summaries      |
| `embed_epic_learning.py`          | `epic_learning_embeddings.json`    | Chunked transcript embeddings for RAG     |
| `embed_udn_docs.py`               | `udn_doc_embeddings.json`          | Perforce UDN docs → 1,742 embedded chunks |
| `merge_embeddings.py`             | `docs_embeddings.json`             | Merge scraped + UDN embeddings (3,622)    |
| `content_gap_analysis.py`         | Gap report                         | Identifies missing content areas          |

All AI-powered scripts use the Google Gemini API.

---

## 🎙️ Video Transcript Pipeline

Video transcripts power the semantic search and RAG database. Three sources feed transcripts into `content/epic_learning/transcripts/`:

| Stage | Source                | Prefix     | Count  | Method                                                                                           |
| ----- | --------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| 1     | YouTube captions      | `yt_`      | ~166   | `fetch_yt_channel_transcripts.py` — downloads official captions                                  |
| 2     | CMS embedded captions | `cms_`     | ~95    | `fetch_cms_transcripts.py` — extracts from Epic's CMS player                                     |
| 3     | Whisper GPU (CMS)     | `whisper_` | ~168   | `whisper_cms_transcripts_v2.py` — OpenAI Whisper on CUDA for CMS videos without captions         |
| 4     | Whisper GPU (Lessons) | `lesson_`  | ~1,476 | `whisper_lesson_videos.py` — 2-phase Kaltura MPD capture + Whisper transcription (24hr pipeline) |

### Whisper Transcription

```powershell
# CMS videos (from embedded player pages)
python scripts/whisper_cms_transcripts_v2.py --phase both --model medium

# Lesson videos (from Kaltura-hosted course pages)
python scripts/whisper_lesson_videos.py --phase a    # Capture MPD manifests
python scripts/whisper_lesson_videos.py --phase b --model base   # Transcribe
```

- **CMS Phase A**: Extracts stream URLs from CMS video pages → `cms_stream_urls_v2.json`
- **CMS Phase B**: Downloads audio, transcribes with Whisper, saves to `whisper_*.txt`
- **Lesson Phase A**: Playwright captures Kaltura DASH manifests → `lesson_stream_urls.json` (793+ MPDs)
- **Lesson Phase B**: ffmpeg extracts audio from MPD streams, Whisper transcribes → `lesson_*.txt`
- Recommended models: `medium` for CMS (best accuracy), `base` for lessons (speed at scale)

### Post-Processing & Quality

```powershell
# Audit transcript health (broken files, hallucinations, coverage)
python scripts/audit_transcripts.py

# Clean Whisper transcripts (fix UE5 misspellings, detect hallucination loops)
python scripts/clean_whisper_transcripts.py --dry-run    # preview
python scripts/clean_whisper_transcripts.py              # apply fixes
python scripts/clean_whisper_transcripts.py --all        # all transcripts
```

### Embedding

After transcripts are collected, generate the RAG embeddings:

```powershell
python scripts/embed_epic_learning.py
```

This produces transcript embeddings for semantic search. Embeddings are uploaded to Firestore vector collections for server-side KNN search via `upload_embeddings_to_firestore.py`.

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
