# Changelog

All notable changes to the Unreal Learning Path Tagging System.

---

## [2.6.0] - 2026-02-24

### Added

- **Persona Content Gaps dashboard** — interactive section in Dashboard tab with persona selector chips, 4 gap stat cards (Relevant / Too Technical / Topics Covered / Keyword Gaps), required topic coverage bars, expandable top-relevant and too-technical course lists, and keyword gap recommendations for content creation
- **DOMPurify XSS sanitization** — added `dompurify` to sanitize the one `dangerouslySetInnerHTML` usage in `OfficialDocsSummary.jsx`, eliminating the last potential XSS vector
- **Drive-to-TXT transcription script** (`scripts/drive_to_txt.py`) — downloads videos from a Google Drive folder and transcribes with GPU-accelerated Whisper, outputting `.txt` files formatted for NotebookLLM with timestamped segments

### Changed

- Dashboard now surfaces `analyzeGaps()` from `ContentGapService.js` — previously the function existed but had no UI consumer
- Updated `vertex-ai-integration.test.js` to properly expand the collapsible `OfficialDocsSummary` component before asserting on body content (pre-existing test gap)

### Security

- Codebase audit: zero `innerHTML`, `document.write()`, or `eval()` usage; all dynamic `href`/`src` attributes use safe sources; React JSX auto-escaping covers 99% of rendering
- `DOMPurify.sanitize()` now wraps all raw HTML rendering

---

## [2.5.0] - 2026-02-23

### Added

- **Persona Onboarding Quiz** — 3-question modal with weighted scoring to detect user role (Artist, Programmer, Designer, etc.) and personalize the experience
- **Augmentation Dashboard** — embedded dashboard for monitoring transcript augmentation quality, grade distribution, and per-course augmentation load
- **"Change My Role" button** — allows users to retake the persona quiz at any time from the header
- **Expandable course cards** — course-level statistics (grade distribution, weakest criteria, augmentation load) in the augmentation view
- **Video detail cards** — criteria bar charts and priority indicators per video
- **Clickable citation links** — `[N]` references in diagnosis answers now link to Vertex AI documentation sources with hover tooltips
- **Dashboard: Readiness Score** — weighted completeness gauge (40% videos, 30% AI enrichment, 30% complete tags) with progress bar
- **Dashboard: Persona Coverage chart** — keyword-scored distribution showing how many courses serve each of the 9 learner personas
- **Dashboard: Quick Search** — filter bar above the courses table (searches by name, code, or topic)
- **Dashboard tooltips** — explanatory title tooltips on all 6 stat cards, 3 charts, and 3 section headings
- **Diagnosis skeleton loader** — animated pulse lines in DiagnosisLoader that preview the answer structure while loading
- **Enhanced error state** — tips section with UE5-specific suggestions + dual buttons (Retry Same Question / Ask Something Else)
- **Mobile responsive breakpoints** — Dashboard (480px), FixProblem (768px), App header (600px) with compact nav, hidden title, single-column layouts
- **Automated Testing Suite (316 tests)** — 7-phase test infrastructure:
  - Phase 1: Data integrity tests (32 tests) — JSON schema validation and field linkage
  - Phase 2: Service unit tests (39 tests) — TagGraphService, narratorService, semanticSearchService
  - Phase 3: E2E browser tests (9 tests) — Playwright with Firebase auth bypass via `VITE_E2E_BYPASS`
  - Phase 4: Component smoke tests (13 tests) — LoadingSpinner, ErrorBoundary, DiagnosisCard, etc.
  - Phase 5: Search quality regression (16 tests) — known-answer tag extraction, course scoring, cosine invariants
  - Phase 6: Bundle regression (7 tests) — build verification, size caps, code-splitting validation
  - Phase 7: CI pipeline — Playwright + Vitest integrated into GitHub Actions `path-builder-quality` job


### Changed

- Augmentation iframe styling switched to `position: absolute` for reliable sizing
- Courses grid uses scroll container for better layout
- Tag graph label readability improvements
- Updated dist build for GitHub Pages deployment
- Persona distribution chart now uses keyword scoring from `personaScoringRules.boostKeywords` instead of industry-only mapping
- Official UE5 Documentation section consistently placed at bottom of Answer View

### Fixed

- Video playback order — sort video arrays by filename prefix to fix sequence issues
- "Change My Role" button styling refined to integrate with dark theme
- Persona coverage chart — 5 personas previously showed 0 courses due to industry-only mapping

---

## [2.4.0] - 2026-02-20

### Added

- **"Fix a Problem" UX redesign** — 2-column layout with always-visible Case Details panel
- **Diagnosis loading screen** — animated loading state with bold UE5 term highlighting in answers
- **RAG pipeline for onboarding** — 3-stage architecture (Planner → Retriever → Assembler) replacing monolithic handler
- **First Hour Quick-Win generator** — upgraded onboarding handler that generates actionable quick wins
- **Codebase refactoring** — extracted shared utilities (float16 decoding, stemming, stopwords) into `utils/`, consolidated `constants.js`
- **Service unit tests** — added test coverage for services that previously lacked them
- **"Learn More" section refactor** — removed redundant info, relocated transferable skills inline

### Changed

- Analytics tooltips added to all metrics, removed debug text
- Output panel resized for better horizontal space usage

---

## [2.3.0] - 2026-02-19

### Added

- **Third-Party Notices** — auto-generated `THIRD_PARTY_NOTICES.md` documenting all 338 open-source dependencies with license types
- **Pipeline reliability refactor** — Zod validation, repair retries, caching, and telemetry for enrichment pipeline
- **Comprehensive dist build** — production build for GitHub Pages with code-splitting optimizations

---

## [2.2.0] - 2026-02-17

### Added

- **Invite-based access control** — admin-only invite code management with `InviteManager` component
- **Admin feedback panel** — review, triage, and manage user-submitted feedback with real-time badge count
- **Feedback submission system** — `FeedbackButton` component with thumbs up/down on video results, stored in Firestore
- **Confidence routing analytics** — `ConfidenceAnalytics` visualization showing search confidence distribution

### Changed

- Firestore security rules updated for feedback and invite collections

---

## [2.1.0] - 2026-02-14

### Added

- **Semantic search pipeline** — embedding-based matching via `semanticSearchService.js` + `segment_embeddings.json` (~6MB)
- **TF-IDF transcript search** — `segmentSearchService.js` with `search_index.json` (~5MB) and `segment_index.json` (~4MB)
- **Search pipeline orchestrator** — `searchPipeline.js` that routes queries through semantic → transcript → tag-based strategies with confidence scoring
- **Tag graph visualization** — interactive Cytoscape.js graph with co-occurrence edges, category coloring, and drill-down
- **Skill Radar & Gap Analysis** — `SkillRadar` and `SkillGapAnalysis` visualizations comparing coverage vs. industry demand
- **Analytics tab** — full suite: `JourneyHeatmap`, `TagTimeline`, `TagTrends`, `PrereqFlow`, `InstructorMap`, `TagHeatmap`, `TagHistorySparkline`
- **Insights panel** — actionable recommendations from analytics data with navigation links
- **Advanced code-splitting** — Vite `manualChunks` config for vendor libs, data files, and search indices

---

## [2.0.0] - 2026-02-07

### Added

#### React App (`path-builder/`)

- **Complete rewrite as React 19 + Vite app** replacing standalone HTML/JS prototype
- **11-tab navigation**: Dashboard, Path Readiness, Tag Sources, Tag Editor, Path Builder, Onboarding, Fix a Problem, Analytics, Augmentation, Invites, Feedback
- **PathContext & TagDataContext** — centralized state management via React Context
- **7 custom hooks**: `useProblemFirst`, `useGuidedPlayer`, `useExploreFirst`, `useOnboardingRAG`, `useCourseBuilder`, `useTagGraph`, `useVideoCart`
- **GuidedPlayer** — AI-narrated learning experience with intro → videos → quizzes → challenges → reflection
- **ProblemFirst** — main search flow: user describes a problem, system returns matched videos with explanations
- **Path Builder** — 3-panel layout: course library (left), drag-and-drop assembly (center), SCORM/JSON output (right)
- **Dashboard** — overview of content library health, tag coverage, video counts
- **Path Readiness** — evaluate which learning paths are ready for deployment
- **Tag Sources** — compare tag origins across canonical, AI, transcript, and Gemini sources
- **Tag Editor** — CRUD interface for editing tag assignments per course
- **Personas** — persona definitions and routing logic
- **CourseLibrary & CartPanel** — browsable catalog with video cart for path building
- **ErrorBoundary** — graceful error handling wrapper
- **LoadingSpinner** — consistent loading states across lazy-loaded components

#### Services

- **25 service modules** including:
  - `geminiService.js` — Gemini AI integration for enrichment and narration
  - `narratorService.js` — AI narrator for guided learning paths
  - `PersonaService.js` — persona detection and personalized messaging
  - `PersonalizedMessaging.js` — persona-aware content adaptation
  - `QueryNormalizer.js` — query cleanup and normalization
  - `PathBuilder.js` — learning path assembly logic
  - `blendedPathBuilder.js` — hybrid path building with multiple strategies
  - `coverageAnalyzer.js` — content gap and coverage analysis
  - `ContentGapService.js` — identifies missing content areas
  - `challengeService.js` — challenge generation for guided paths
  - `courseToVideos.js` — course-to-video mapping utility
  - `docsSearchService.js` — UE5 documentation search integration
  - `externalContentService.js` — external resource discovery
  - `domainTypes.js` — shared type definitions
  - `firebaseConfig.js` — Firebase initialization
  - `googleAuthService.js` — Google Sign-In authentication
  - `learningProgressService.js` — user progress tracking
  - `onboardingTelemetry.js` — onboarding flow analytics
  - `feedbackService.js` — feedback CRUD operations

#### Data Files (24 total)

- `video_library_enriched.json` — core course + video catalog with AI enrichment
- `course_embeddings.json` — course-level semantic vectors
- `segment_embeddings.json` — segment-level semantic vectors (~6MB)
- `search_index.json` — TF-IDF search index (~5MB)
- `segment_index.json` — segment search index (~4MB)
- `transcript_segments.json` — 7,000+ parsed transcript segments
- `tags.json` — 500+ tag definitions with metadata
- `edges.json` — tag relationship edges
- `personas.json` — persona definitions and scoring
- `challengeRegistry.json` — hands-on challenge definitions
- `doc_links.json` — UE5 documentation links (~4MB)
- `docs_embeddings.json` — documentation embeddings (~5MB)
- `course_prerequisites.json` — prerequisite relationships
- `synonym_map.json` — tag synonym mappings
- `curated_solutions.json`, `curator_insights.json`, `demand_benchmarks.json`, `external_sources.json`, `tag_history.json`, `youtube_curated.json`

#### Enrichment Scripts (83+)

- `build_embeddings.py` — generate semantic embeddings for courses
- `embed_segments.py` — generate segment-level embeddings
- `build_search_index.py` — build TF-IDF search index
- `build_segment_index.py` — build segment search index
- `augment_transcript.py` — transcript augmentation with AI
- `scrape_epic_docs.py` — UDN documentation scraping
- `expand_synonyms.py` — synonym expansion via AI
- `enrich_doc_links.py` — documentation link enrichment
- `extract_key_steps.py` — key step extraction from transcripts
- `generate_cooccurrence_edges.py` — co-occurrence edge generation
- 70+ additional audit, validation, and enrichment scripts

#### Firebase Cloud Functions (`functions/`)

- `ai/` — Gemini-powered AI endpoints for learning path generation
- `data/` — data management functions
- `pipeline/` — server-side enrichment pipeline
- `triggers/` — Firestore event triggers
- `scheduled/` — scheduled/cron functions

#### Testing

- Vitest + React Testing Library test suite
- 11+ test files across `src/__tests__/` and `src/services/__tests__/`
- `vitest.config.js` with jsdom environment

### Changed

- **Hosting moved to GitHub Pages** — `vite.config.js` base path set to `/Unreal-Learning-Path-Tagging-System/`
- Firebase Hosting retained for API endpoints via rewrites
- ESLint upgraded to v9 flat config
- Stylelint added for CSS linting

### Breaking Changes

> [!CAUTION]
> v2.0.0 is a complete rewrite. The standalone HTML/JS prototype is archived in `prototype/`.

1. **React app replaces HTML prototype** — all UI is now in `path-builder/src/`
2. **Firebase Auth required** — users must sign in with Google
3. **Invite-based access** — new users need an invite code or admin approval
4. **JSON data files restructured** — enriched data includes AI-generated fields

---

## [1.0.0] - 2026-01-27

### Added

#### Scoring Engine (`ingestion/scored_matcher.py`)

- **Deterministic scoring formula**: `TagScore = Σ(SignalTypeMultiplier × RuleWeight × TagGlobalWeight)`
- **Signal type multipliers**: `exact_signature` (1.0) > `regex` (0.8) > `contains` (0.6) > `synonym` (0.4)
- **Negative pattern blocking**: Rules can define patterns that block a tag from matching
- **Version-aware matching**: Tags can be filtered by UE engine version constraints
- **Full trace output**: Every match produces a traceable JSON showing exactly why each tag matched
- **Deterministic tie-breakers**: Score → Priority → Specificity → Alphabetical

#### Path Composer (`ingestion/path_composer.py`)

- **Atom-based composition**: Learning paths built from atomic steps in `steps/atoms/`
- **Edge expansion**: `symptom_of` and `prerequisite` edges expand tag sets automatically
- **Step ordering**: Foundation → Diagnostic → Remediation → Verification
- **Template fallback**: Falls back to golden templates when atoms don't cover all step types

#### Atomic Steps (`steps/atoms/`)

- New directory for atomic learning steps
- Each atom includes: `why`, `evidence`, `verification`, `tags`, `prerequisites`
- Example atoms for build/packaging workflow

#### Test Suite (`tests/`)

- `test_scored_matcher.py`: Tests for scoring precedence, negative blocking, tie-breakers, version constraints
- `test_path_composer.py`: Tests for edge expansion, atom selection, ordering, determinism
- `conftest.py`: Shared fixtures for sample queries and data loading

#### CI/CD (`.github/workflows/ci.yml`)

- Automated test runs on push/PR to main
- JSON schema validation for all JSON files
- Coverage reporting via Codecov

### Changed

#### `match_rules.json` Schema Updates

- Added `rule_weight` field (0.0-1.0) to each rule
- Added `signal_type` field to each pattern
- Added `negative_patterns` array to rules

### Breaking Changes

> [!CAUTION]
> The following changes may require updates to downstream consumers.

1. **Scores are now numeric**: Tags return `score` as a float (0.0-1.0+) instead of just presence/absence
2. **Match results are objects**: `ScoredTag` objects replace simple tag ID strings
3. **Rule order matters less**: Scoring replaces priority-only ordering

### Migration Guide

If you were using the previous tag matching logic:

```python
# Before (v0.x)
tags = match_query("my error")  # Returns list of tag_id strings

# After (v1.0)
from ingestion.scored_matcher import ScoredMatcher
matcher = ScoredMatcher()
results = matcher.match_query("my error")  # Returns list of ScoredTag objects
tag_ids = [t.tag_id for t in results]      # Extract IDs if needed
```

---

## [0.1.0] - 2026-01-26

### Added

- Initial tag database (`tags/tags.json`)
- Edge relationships (`tags/edges.json`)
- Match rules (`ingestion/match_rules.json`)
- Learning path templates (`learning_paths/templates/`)
- Sample queries (`user_queries/examples/`)
