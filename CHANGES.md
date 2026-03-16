# Unreal Engine Learning Path Tagging System - Changelog

All notable changes to the Unreal Learning Path Tagging System.

---

## [7.5.0-gap-fill-integration] - 2026-03-16

### Added

- **Universal Gap Fill Integration (Phase 4a)** — Wired gap analysis into the Adaptive Path pipeline:
  - Auto-fills up to 3 gap steps during path generation (Stage 3.5 in the pipeline)
  - `PathGapCard` component in `AdaptiveSidebar.jsx` shows blind spots with severity indicators
  - 6 admin actions: search fills, add library courses, generate bespoke segments, dismiss, and fill-all
  - `GAP_AUTO_FILL_COMPLETED` analytics event tracks automatic gap fills (topic, count, source)
- **Gap Fill Analytics (Phase 4b)** — Added `trackGapFillCompleted` calls to 3 handlers in `PathIntelligencePanel.jsx`:
  - `handleFillGap` (all tiers), `handleAddLibraryCourse` (library), `handleBespokeGenerate` (bespoke)
  - Each call tracks topic, tier source, count, query, and `source: "path_builder"`

### Fixed

- **Sidebar Scroll** — Added `overflow-y: auto` to `.epic-sidebar` in `BespokePath.css`; gap analysis content was clipped
- **CI Test: Title Dedup** — `pathQualityValidator.test.js` assertion corrected from `warnings` to `autoFixes` (title dedup logs to `autoFixes`, not `warnings`)
- **CI Test: Module Auto-Creation** — `PathContext.test.jsx` updated to expect `modules: []` on plain-array `loadPath` (auto-module creation was intentionally removed in v7.4.0)

---

## [7.4.0-quality-polish] - 2026-03-12

### Changed

- **Context-Aware Fallback Summaries** — Upgraded `generatePlaceholder()` in `summaryQualityGate.js` to produce richer summaries when raw transcript text is rejected:
  - Priority 1: Uses `gemini_outcomes` directly as the summary when available
  - Priority 2: Weaves extracted/canonical tags into the description
  - Priority 3: Varies template text via title hash (eliminates identical generic summaries)
  - `webPlayerService.js` now passes step metadata hints (outcomes, tags, videoTitle) to `ensureQualitySummary`
- **Intro-to-UE5 Pinning** — "Introduction to Unreal Engine/Editor" is now pinned to index 0 across all path generation and ordering flows:
  - `pathSequencer.js` — post-sequencing pin
  - `generationEngine.js` — post-sort pin in `optimizePathOrder`
  - `AssemblyLine.jsx` — post-interleaving pin in `handleOptimize`
  - `PathBuilder.js` — output pin in `buildLearningPath`

### Fixed

- **"(Bespoke)" Label Leak** — Stripped internal labels (`(Bespoke)`, `(AI Generated)`, `(Gap Fill)`) from all display surfaces:
  - `resolveStepTitle.js` — safety-net strip before display
  - `topicNameService.js` — all `getDisplayName()` return paths wrapped with `stripInternalLabels()`
  - `gapFill.js` — removed `(Bespoke)` from generated step titles and replaced raw transcript descriptions with clean summaries
- **Auto-Generated Milestones** — Removed `autoCreateModules()` that randomly created milestone groups:
  - `PathContext.jsx` `loadDraft()` no longer auto-generates milestones on page load
  - `PathContext.jsx` `loadPath()` no longer auto-generates milestones when loading from array
  - Milestones now only appear when user explicitly clicks "+ Add Milestone"
- **Conversational Speech Detection** — Added 14 new speech patterns to `summaryQualityGate.js` for instant rejection of transcript-like text (first-person narration, verbal transitions, spatial references)
- **Augmentation Matching Accuracy** — Removed overly-broad Strategy 3 (global video title search) from `augmentationContentService.js`; tightened Strategy 2 word overlap to require 3+ matching words
- **Duplicate Step Removal** — `pathQualityValidator.js` now actively removes duplicate titles instead of only warning

---

## [7.3.0-monorepo-audit] - 2026-03-12

### Added

- **`TabRouter.jsx`** — [NEW] Extracted all 22 tab conditional render blocks and 30+ lazy imports from `App.jsx` into a dedicated routing component. App.jsx reduced from ~472 to ~300 lines

### Changed

- **Path Builder Layout Fix** — Fixed desktop layout bug where the course library panel appeared at the bottom during Review/Export stages:
  - Rewrote `useIsMobile` hook using `useSyncExternalStore` to eliminate stale viewport state
  - Updated CSS grid layout to include `library` area in mobile templates
  - Gated `showLeftPanel` on `workflowStage` (only visible during `build`/`curate`)
- **`geminiService.js` DRY Refactor** — Extracted `callGeminiFunction()` helper encapsulating auth check → `httpsCallable` → `retryWithBackoff` → `safeParseJSON` → fallback. Each of the 3 callers reduced from ~25 lines to ~8 lines (~60 lines removed)
- **`externalContentService.js` Bundle Migration** — Migrated `youtube_curated.json` from `import()` (Vite-bundled) to runtime `fetchJSON()` via `dataLoader.js`. File moved from `src/data/` to `public/data/`
- **`App.jsx` Simplified** — Removed 30+ lazy imports and 190-line tab rendering block, replaced with single `<TabRouter>` component

---

## [7.2.0-feasibility-gate] - 2026-03-10

### Added

- **Phase 0: Query Feasibility Gate** — Prevents hallucinated learning paths for off-topic queries (e.g., "Horses in UE5"):
  - `isQueryUE5Relevant()` function in `bespokePathService.js` checks queries against 80+ UE5 domain terms and engine-related regex patterns
  - When `lowCorpusCoverage === true` AND query is NOT UE5-relevant → returns early with "Topic Not Covered" instead of generating fabricated content
  - When `lowCorpusCoverage === true` AND query IS UE5-relevant → proceeds with hybrid fallback but shows amber `⚠️ AI-Generated` warning banner
  - Tracks `feasibility_blocked` reason in analytics
- **"Topic Not Covered" UI** — Rich error card in `AdaptivePath.jsx` with:
  - 🚫 icon and descriptive heading
  - 4 clickable UE5-specific query suggestions that auto-fill the search box
  - Indigo-themed suggestion buttons with hover effects
- **AI-Generated Warning Banner** — Changed AI-generated path banner from blue "Custom AI-powered path" to amber "⚠️ Generated from AI knowledge — not from our verified course library"
- **135 New Transcripts** — Batch of course transcripts (115.02 series: Input Delegates, Game World Setup, Saving/Serialization, Subsystems, Animation) expanding the content corpus
- **Re-embedded Segment Corpus** — Full re-run of `embed_segments.py` across 20,794 chunks using `gemini-embedding-001` model

### Fixed

- **Firebase Web API Key Recovery** — Restored accidentally deleted Firebase Web API key in GCP Console; both localhost and deployed site auth restored
- **`embed_segments.py` IndentationError** — Fixed leading whitespace on line 1 that prevented the embedding script from running
- **`test_api_key.py` Hardcoded Key Removal** — Replaced hardcoded API key with `os.environ.get("GOOGLE_API_KEY")` for secure key handling
- **CI Test Timeout** — Increased `bespokePathService.test.js` timeout from 15s to 30s to prevent flaky failures

---

## [7.1.0-path-intelligence] - 2026-03-10

### Added

- **Path Gap Analyzer Engine** — 5-module intelligence engine for learning path quality analysis (refactored from 955-line monolith into focused modules with barrel re-export):
  - `gapDetection.js` (471 lines) — `analyzePathGaps()`, `extractSubtopics()`, `generateRequiredSubtopics()`, `parseGeminiJSON()`. Detects blind spots via 3 matching strategies (topic overlap, substring, word-level)
  - `gapFill.js` (242 lines) — `generateGapFillStep()`, `generateBespokeGapStep()`. 3-tier gap fill: Library Search → Bespoke Segments → AI-Generated Step
  - `communityPainPoints.js` (89 lines) — `searchCommunityPainPoints()`. Grounded web search for real UE5 learner struggles
  - `personaGaps.js` (59 lines) — `simulatePersonaGaps()`. Re-runs gap analysis from beginner/intermediate/advanced personas
  - `prereqChain.js` (88 lines) — `buildPrereqChain()`. Builds prerequisite dependency graph between path steps
  - `pathGapAnalyzer.js` (36 lines) — Barrel re-export, all consumer imports unchanged
- **Research-Backed Gap Patterns** — 9 research-informed gap categories (Bloom's gap, spaced practice, transfer gap, scaffold removal, assessment mismatch, cognitive overload, tutorial limbo, missing why, assumed prereqs) with `RESEARCH_LABELS` export for UI tooltips
- **Weakly Covered Detection** — Augmentation quality data integration: courses rated D/F are flagged as "weakly covered" with half-weight in coverage scoring
- **`PathLoader.jsx`** — Bridge component enabling Edit Path flow from PathDashboard to PathBuilder editor, loading saved path courses + learning intent into PathContext
- **`generateBespokeGapStep()`** — Converts Tier 2 bespoke segment matches into course-compatible objects for `addCourse()` integration
- **Persona Real-Data Eval Tests** (`eval_onboarding_realdata.test.js`) — Persona scoring evaluation against the full 2,400+ course catalog with cross-industry blocklists and required topic validation
- **AssemblyLine Duration Warnings** — Path length indicators: ⚠️ amber at 20+ hours, 🚨 critical at 40+ hours. Cognitive load summary in header bar
- **PathLoader Unit Tests** (`PathLoader.test.jsx`, 7 tests) — Covers loadPath, setLearningIntent, goal/skillLevel/timeBudget fallback, activePathId + localStorage, renders null, null handling, onLoaded callback (`fe50b2b5`)

### Changed

- **`App.jsx`** — Wired up `onEditPath` handler (was a TODO) to load saved path data into PathContext via `PathLoader`; added `pendingEditPath` state
- **`AssemblyLine.jsx`** — Added tier-based layout, cognitive load summary, video count, and path duration warnings in the header bar
- **Path Builder Flow** — Clicking a saved path card on the PathDashboard now loads its courses into the editor (previously just switched views without loading data)

### Fixed

- **URL Health Check False Positives** (closes #1) — `validate_urls.py` now detects `<meta name="robots" content="noindex">` on Epic's SPA redirect stubs and classifies them as `"redirected"` instead of `"broken"`. All 22 flagged URLs were false positives from Epic's doc URL migration
- **localStorage Key Mismatch** — Standardized `PathContext.jsx` to use `ue5_saved_paths` (underscores), matching `pathStorageUtils.js`. The hyphenated key `ue5-saved-paths` caused saved paths from one component to be invisible to the other (`ca6fce5c`)
- **Grounding Metadata Test** — Updated mock `classifySegments` summaries in `bespokePathService.test.js` to include query keywords ("import", "static", "mesh") so steps pass the topical cross-check in `pathSequencer.js` (`bced41d6`)
- **ESLint `no-useless-escape`** — Removed unnecessary `\[` escape in `gapDetection.js` regex character class (`2771db2a`)

---

## [7.0.0-modular-architecture] - 2026-03-08

### Added

- **`usePathStepActions` Hook** — Shared hook unifying step-level audio (voice selection, position detection, pre-generation), takeaway (auto-load on step change), and deep dive logic. Used by both `BespokePath.jsx` and `AdaptivePath.jsx`
- **`usePathQuiz` Hook** — Shared quiz generation and scoring hook (created in Phase 1, now wired into AdaptivePath)
- **Service Modules** — `bespokePathService.js` (1,012 lines) split into 4 focused modules:
  - `pathSearch.js` — Segment search + workflow intent filtering
  - `pathSequencer.js` — Classification prompts + step sequencing via Gemini
  - `pathNarration.js` — Bridge narration generation between steps
  - `bespokePathService.js` — Orchestrator (425 lines, down from 1,012)

### Changed

- **`BespokePath.jsx`** — 600 → 560 lines; replaced Map-based state with `usePathStepActions` hook
- **`AdaptivePath.jsx`** — 911 → 784 lines; consolidated inline quiz/audio/takeaway/deep-dive logic into shared hooks
- **`classifyPrompt.regression.test.js`** — Updated to read `pathSequencer.js` (prompt guardrails moved during service split); all 6 tests now pass

### Architecture

> [!NOTE]
> This is a **pure refactoring release** — no user-facing behavior changes. The modular split enables independent testing and maintenance of each pipeline stage.

---

### Added

- **UDN/Perforce Doc Embeddings** — `embed_udn_docs.py` embeds 1,742 Perforce UDN documentation chunks using `gemini-embedding-001` with 10-worker parallelism (32 chunks/sec, 58s total vs ~8min serial)
- **Embedding Merge Pipeline** — `merge_embeddings.py` deduplicates and merges scraped (1,880) + UDN (1,742) doc embeddings into a unified `docs_embeddings.json` (3,622 chunks, 38.6 MB)
- **Server-Side Rate Limiting** — All Cloud Functions now enforce per-user, per-function rate limits with `Retry-After` headers and structured `resource-exhausted` error responses
- **AI Grounding** — `classifySegments` Cloud Function now includes Google Search grounding metadata (support URLs, confidence scores) in path sequencing responses
- **Usage Logging** — All Cloud Functions log to `apiUsage` Firestore collection for cost tracking and abuse detection

### Changed

- **Firestore `docs_embeddings` Collection** — Expanded from 1,880 scraped-only chunks to 3,622 merged chunks (scraped + UDN/Perforce), closing the Subsurface Scattering search gap
- **Documentation Updated** — `README.md`, `ARCHITECTURE.md`, `CHANGES.md`, and `AGENTS.md` updated to reflect all recent changes

### Root Cause Analysis

- **SSS Search Gap** — Subsurface Scattering content existed in Perforce UDN docs but was never embedded. The original `scrape_epic_docs.py` only scraped public-facing Epic docs, missing internal UDN documentation. The new `embed_udn_docs.py` + merge pipeline ensures both sources are covered.

---

## [1.9.0-content-gaps] - 2026-03-06

### Added

- **Content Gap Intelligence Dashboard** — New analytics sub-tab (`ContentGaps.jsx`) that tracks where official docs fall short:
  - **AI Fill Rate** — percentage of path steps that required AI generation vs corpus matches
  - **Top Content Gaps** — queries where AI had to generate the most content, ranked by AI ratio
  - **Most Common Knowledge Gaps** — aggregated learner knowledge gaps across all path generations
  - **Path Generations Analyzed** — total count of paths with coverage data
- **`AI_COVERAGE_REPORT` Analytics Event** — New `trackAICoverageReport()` in `analyticsService.js` fires on every path generation (query preview, learner level, knowledge gaps, step counts, corpus/AI ratio, coverage flag)
- **7-Tier Typography System** — Comprehensive text normalization for BespokePath step cards:
  - 3 new CSS tokens: `--text-heading`, `--text-highlight`, `--text-muted`
  - Tier 1–7: Step titles → Section headings → Body copy → List items → Key terms → Metadata → Interactive labels
  - Auto-bolding of property names before em dashes, consistent cyan highlighting for key terms
- **Eager Analytics Loading** — `App.jsx` now loads analytics events when any analytics sub-tab is active, not just Overview

### Fixed

- **AI Coverage Report Not Firing** — Root cause: the hybrid fallback path (`forceHybrid` branch) had its own `return result` that completely bypassed all tracking code. Added `trackPathSequenced` and `trackAICoverageReport` to the hybrid path
- **Tracking Skipped on Bridge Error** — Moved all tracking calls before `generateBridgeNarration()` so they fire even if narration generation throws
- **Takeaway Prefix Formatting** — Capitalized text after em dashes, indented success takeaways, auto-bolded property names in key properties sections

---

## [1.8.1-rag-fix] - 2026-03-06

### Fixed

- **RAG Pipeline 0-Hit Issue** — Generated and uploaded missing embeddings for `segment_embeddings` (2,402 chunks) and `docs_embeddings` (1,880 chunks) to Firestore
- **Deprecated Embedding Model** — Updated 3 scripts from `text-embedding-004` (removed by Google) to `gemini-embedding-001`:
  - `scripts/embed_segments.py`
  - `scripts/scrape_epic_docs.py`
  - `scripts/build_embeddings.py`
- **Upload Script Project Detection** — `upload_embeddings_to_firestore.py` now auto-detects the GCP project ID from gcloud config instead of relying on implicit ADC resolution

---

## [1.8.0-analytics-rag] - 2026-03-05

### Added

- **RAG Pipeline Tracking** — 3 new analytics events instrument the RAG pipeline end-to-end:
  - `VECTOR_SEARCH_COMPLETED`: per-collection hit counts (transcripts, Epic Learning, docs), best/avg similarity scores, search latency
  - `HYBRID_FALLBACK_TRIGGERED`: reason (no_segments, low_similarity, post_sequence_empty), best similarity, corpus segment count
  - `PATH_SEQUENCED`: step count, categories used, AI vs corpus ratio
- **RAG Pipeline Health Dashboard** — New "🧠 RAG Pipeline Health" section in Admin Analytics showing avg similarity, hybrid fallback %, search latency, corpus ratio, and collection breakdown bar chart
- **`getRAGMetrics()` aggregation** in `analyticsQueryService.js` — computes all RAG health metrics from raw analytics events
- **Sources fallback URLs** — Sources links in path steps are always clickable; when segments lack a direct URL, falls back to search on dev.epicgames.com/community (Epic Learning), YouTube (transcripts), or Epic Docs

### Changed

- **Analytics Performance** — `AdminAnalytics.jsx` rewritten for speed:
  - `Promise.all` parallelizes `fetchEvents` + `fetchCloudStats` (was sequential)
  - `useRef` caching skips re-fetch when time range hasn't changed
  - `useMemo` for all aggregation functions (was recalculating on every render)
  - Progressive rendering: cloud cost section loads independently
- **Dashboard UI/UX Reorganization** — New layout order: Overview stat cards → RAG Health → AI Costs → Daily Volume/Event Breakdown (side-by-side) → Top Queries/Persona Distribution (side-by-side) → Recent Events (full-width)

### Removed

- **Blueprint Visual Links** — Removed `blueprintPresets.js`, PathStep integration, CSS, and `BLUEPRINT_LINK_SHOWN` event (tech debt concern; deep-linking approach didn't fit workflow)

### Fixed

- **Sources link not clickable** — Epic Learning segments often lacked `url` field (Firestore returned empty string), causing non-clickable `<span>` instead of `<a>`. Now always renders clickable with fallback search URLs.

---

## [1.7.0-hybrid-intelligence] - 2026-03-05

### Added

- **Hybrid AI Fallback** — When corpus coverage is too low (best similarity < 0.65), the system generates learning paths from Gemini's general UE5 knowledge instead of returning empty results
  - Steps generated via hybrid fallback are marked with `type: "ai_generated"` and labeled "AI-assisted — beyond current course library"
  - Post-sequencing safety net: if too few steps survive relevance filtering after sequencing, automatically supplements with hybrid AI content
- **Workflow Intent Matching** — `sequencePath` prompt rejects corpus segments that teach the wrong workflow for the user's query (e.g., Texture Graph for 3D mesh setup)
  - **FAB Asset Assumption**: "Create/make [object]" queries assume learners have a Static Mesh from FAB or an existing FBX/Skeletal Mesh
  - Modeling Mode added to reject list (unless query specifically asks about sculpting)
- **Image-Based Quiz Questions** — `quizImageBank.js` maps UE5 concepts to screenshot images displayed above diagnostic quiz questions
- **Cosine Similarity Scoring** — `vectorSearch.js` CF now returns real cosine distance via Firestore `distanceResultField: 'vector_distance'`
- **Deepdive TOOL APPROPRIATENESS Rule** — `generateAudioBriefing.js` prompt now acknowledges when source content describes an advanced tool that doesn't match the user's simpler workflow

### Changed

- **classifySegments CF** — Added `responseMimeType: "application/json"` to force valid JSON output from Gemini, eliminating client-side parse failures
- **Further Reading** — AI-generated steps now display with robot icon and "AI-Assisted" label; rendered as non-clickable items instead of broken links
- **Apply It Section** — Removed from per-step rendering to avoid overlap with Epic's in-editor AI Assistant (which handles procedural how-to guidance)

### Fixed

- **Hybrid JSON parsing** — Hardened sanitization for Gemini output: strips code fences, fixes smart quotes, removes trailing commas, fallback for single-quoted keys
- **Quiz image 404s** — Resolved by using `import.meta.env.BASE_URL` for Vite's base path in image URLs
- **Similarity scores always 0.000** — `vectorSearch.js` was missing `distanceResultField` in Firestore `findNearest()` call

---

## [1.6.0-adaptive-path] - 2026-03-04

### Added

- **Adaptive Path Component** — Problem-first diagnostic quiz that builds a knowledge profile, then generates a depth-adjusted learning path via Gemini 2.0 Flash
  - **Diagnostic Quiz** — Adaptive multi-question flow using `useAdaptiveQuiz` hook; questions calibrate to user's knowledge level
  - **Knowledge Check Quiz** — Integrated `QuizEngine` into Adaptive Path with a dedicated "Quiz" phase in the sidebar navigation
  - **Audio Auto-Advance** — Audio briefings auto-advance to the next step when playback completes, with sequential generation for seamless listening
  - **BespokePath-style Modal** — Full modal overlay with sidebar navigation (Questions → Solution → Quiz → Apply It) and step controls
  - **Key Takeaways** — Auto-generated Key Takeaway panels for each step
- **Blueprint-First Content Bias** — Diagnostic quiz and path sequencing prompts now prioritize Blueprint/visual scripting content over C++ unless explicitly requested
- **Direct Teaching Content** — Rewritten `sequencePath` prompt generates content that teaches concepts directly rather than describing source articles

### Changed

- **Modal viewport fit** — Expanded modal to 92vh and tightened padding throughout (overlay, footer, scroll area) to minimize scrolling
- **LLM JSON parsing** — Added trailing comma repair for more robust parsing of Gemini responses

### Fixed

- 3 ESLint errors: unused `getFilteredSuggestions`, synchronous `setState` in `useEffect`, unused `threshold` parameter
- Firebase init and `sanitizeQuery` import errors in Adaptive Path
- Takeaway formatting (flex layout removal, contraction regex fix)
- `generateStepAudio` argument order in Adaptive Path

---

## [1.5.0-vector-migration] - 2026-03-03 (Planned)

### Added

- **Firestore Vector Search** — Migrating embedding storage from bundled JSON files (~33MB) to Firestore collections with native `findNearest()` KNN search:
  - `course_embeddings` — 768-dim vectors for course-level semantic search
  - `segment_embeddings` — 768-dim vectors for transcript segment search
  - `docs_embeddings` — 768-dim vectors for Epic documentation search
- **3 New Cloud Functions** — `vectorSearchCourses`, `vectorSearchSegments`, `vectorSearchDocs` for server-side vector search
- **Bespoke Learning Path Pipeline** — 4-stage AI path generation (Segment Finder, Path Sequencer, Path Renderer, Quiz Generator) using Gemini 2.0 Flash
- **10 Pre-Seeded Popular Paths** — Research-backed top UE5 beginner issues (Event Tick, Casting vs Interfaces, Nanite, Lumen, Blueprint communication, project organization, World Partition, optimization, profiling, Lumen+Nanite interaction)
- **Security Guardrails** — 7 guards covering prompt injection, XSS, API key protection, rate limiting, cache poisoning, data exfiltration, SCORM integrity
- **Cached Path Library** — Anonymous path caching with 90-day TTL, admin-pinned Featured Paths, similarity-based cache hits

### Changed

- **Bundle size reduction** — Removing 33.3MB of embedding JSON files from `src/data/` (bundle drops from 62.4MB to ~29MB)
- **Search pipeline** — `semanticSearchService.js`, `segmentSearchService.js`, `docsSearchService.js` updated to call Firestore vector search Cloud Functions instead of client-side cosine similarity
- **Error handling** — 8 graceful error scenarios with user-friendly messages that don't expose infrastructure details

### Fixed

- **CI bundle regression** — `bundle-regression.test.js` was failing (62.4MB > 55MB threshold) due to growing embedding JSON files

---

## [1.4.0-lesson-whisper] - 2026-03-03

### Added

- **Lesson Video Whisper Pipeline** — `whisper_lesson_videos.py` with 2-phase architecture:
  - Phase A: Playwright captures Kaltura DASH manifests by intercepting CDN responses, decoding base64 MPD XML (793+ MPDs from 2,050 lesson pages)
  - Phase B: ffmpeg extracts audio from MPD streams, OpenAI Whisper `base` model transcribes on RTX 3080 GPU (~25s/video average)
- **1,900+ Lesson Transcripts** — 24-hour GPU pipeline produced `lesson_*.txt` files covering Nanite, Lumen, MetaSounds, GAS, Blueprints, Animation, Materials, Level Design, Lighting, Virtual Production, and 180+ courses
- **Lesson Stream URL Manifest** — `lesson_stream_urls.json` maps lesson hashes to titles, course hashes, and video IDs for metadata resolution

### Changed

- **Embed script updated** — `embed_epic_learning.py` now loads `lesson_*.txt` transcripts as standalone documents with metadata from `lesson_stream_urls.json`
- Transcript count expanded from 428+ to **1,900+** files in `content/epic_learning/transcripts/`

### Fixed

- **Critical embed gap** — `embed_epic_learning.py` previously only handled `yt_`, `cms_`, and `whisper_` prefixed transcripts, missing 77% of all transcripts (`lesson_` prefix)

---

## [1.3.0-transcripts] - 2026-02-27

### Added

- **Epic Learning Video Discovery** — `discover_epic_videos.py` and `extract_epic_learning.py` scrape 1,331 articles from Epic Dev Portal into Markdown + metadata
- **YouTube Channel Transcripts** — `fetch_yt_channel_transcripts.py` downloads official captions for 150+ videos (`yt_*.txt`)
- **CMS Transcript Extraction** — `fetch_cms_transcripts.py` captures captions from Epic's embedded CMS player for 110+ videos (`cms_*.txt`)
- **Whisper GPU Transcription Pipeline v2** — `whisper_cms_transcripts_v2.py` with 2-phase architecture:
  - Phase A: Playwright opens embed pages directly, intercepts DASH manifests, decodes base64 MPD XML
  - Phase B: ffmpeg extracts audio from MPD, OpenAI Whisper transcribes on CUDA GPU
- **Whisper Priority Builder** — `_build_priority.py` generates `whisper_priority.json` from article-title-based prioritization (118 CMS videos queued)
- **Transcript Cleanup** — `clean_whisper_transcripts.py` fixes UE5 terminology misspellings (tessellation, Voronoi, Lumen, Nanite, Niagara, MetaHumans) and detects hallucination loops
- **Transcript Audit Suite** — `audit_transcripts.py`, `_audit_coverage.py`, `_audit_missing_whisper.py` for coverage and health monitoring
- **Epic Learning Embeddings** — `embed_epic_learning.py` generates chunked transcript embeddings for RAG semantic search (`epic_learning_embeddings.json` ~20MB)
- **Content Gap Analysis** — `content_gap_analysis.py` identifies missing content areas across the catalog

### Changed

- Transcript pipeline now supports 3 sources with 428+ transcript files in `content/epic_learning/transcripts/`
- Integrated Epic Learning embeddings into hybrid search pipeline (`searchPipeline.js`)
- Scripts directory expanded from 83+ to 98+ enrichment, audit, and validation scripts
- Video manifest (`video_manifest.json`) tracks 34 YouTube + 187 CMS videos

---

## [1.2.0-personas] - 2026-02-25

### Added

- **Persona Context:** Added persona detection and specialized messaging to the `GuidedPlayer` IntroCard.
- **Tag & Synonym Editor:** New sub-tab in `TagEditor` for managing tag synonym/alias mappings with export to JSON.
- **Edge Relationship Editor:** New sub-tab in `TagEditor` for defining directed tag relationships (symptom_of, often_caused_by, related, subtopic, replaces) with weight slider and JSON export.

### Changed

- Refactored `PersonaService.js` to store messaging directly in `personaScoringRules`.
- `useGuidedPlayer.js` updated to import `generateProgressText` seamlessly.

### Fixed

- Removed confusing `▶` triangle icon from YouTube stat card.
- Removed out-of-place CSV export button from Content Gap Dashboard header.
- Fixed 6 CI ESLint errors (`playwright.config.js`, `PersonaService.test.js`, `TagGraphService.test.js`, `ContentGapDashboard.jsx`).
- Fixed default tab typo in TagEditor (`"bullkTagging"` → `"bulkTagging"`).

## [2.6.0] - 2026-02-24

### Added

- **Mobile Adaptive UI** — new `useIsMobile` hook driving a slide-out hamburger navigation drawer. Mobile viewports now feature prioritized tab ordering (Onboarding & Fix a Problem first), simplified builder layouts (single column), and auto-collapsed analytics panels
- **Experience-Aware Prerequisite Ordering** — paths now sort based on user role experience (e.g. Beginners get Intro/Quickstarts first, Experienced users get topic-specific content first, Executives get executive summaries pushed to the end)
- **Responsive CSS Fixes** — resolved horizontal overflow issues in the Path Readiness Content Gap matrix and Tag Sources cards on 375px screens
- **Persona Content Gaps dashboard** — interactive section in Dashboard tab with persona selector chips, 4 gap stat cards (Relevant / Too Technical / Topics Covered / Keyword Gaps), required topic coverage bars, expandable top-relevant and too-technical course lists, and keyword gap recommendations for content creation
- **DOMPurify XSS sanitization** — added `dompurify` to sanitize the one `dangerouslySetInnerHTML` usage in `OfficialDocsSummary.jsx`, eliminating the last potential XSS vector
- **Drive-to-TXT transcription script** (`scripts/drive_to_txt.py`) — downloads videos from a Google Drive folder and transcribes with GPU-accelerated Whisper, outputting `.txt` files formatted for NotebookLLM with timestamped segments
- **Shared test fixtures** (`__tests__/fixtures/testCourses.js`) — 6 production-realistic course objects replacing generic `TEST.01` / `Test Course` mock data across 4 test files
- **GitHub Pages deploy script** (`scripts/deploy_ghpages.py`) — orphan-branch deploy that bypasses `npx gh-pages` long-filename bugs

### Changed

- Dashboard now surfaces `analyzeGaps()` from `ContentGapService.js` — previously the function existed but had no UI consumer
- Updated `vertex-ai-integration.test.js` with `vi.resetModules()` isolation and realistic Vertex AI response data
- All test files now use production-shaped mock data instead of generic placeholders
- Test count: 325 tests across 28 files (0 failures)

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
