# Streamlining Plan — Unreal Learning Path Tagging System

## 🎯 Objective
Reduce cognitive load, improve build efficiency, and ensure data integrity across the repository.

## 🛠️ Proposed Improvements

### 1. Repository Hygiene & Cleanup
*   **Move root artifacts to appropriate subdirectories:**
    *   Move `ci_log.txt`, `local_scrape_log.txt`, `test_eval*.txt`, `test_output.log`, and `mobile_docs_*.txt` into a new `logs/` subdirectory.
    *   Move `Learning & Training Youtube_Strategy 2026 .pdf` to `docs/`.
    *   Ensure `credentials.json` and `token.pickle` are in a safer location (like `scripts/auth/`) to keep the root clean.
*   **Audit `.gitignore`:** Ensure these transient files are ignored once moved.

### 2. Data Consolidation (Single Source of Truth)
*   **Problem**: `video_library_enriched.json` exists in `content/`, `src/data/`, and `public/data/`.
*   **Fix**: 
    1.  Designate `content/video_library_enriched.json` as the **Single Source of Truth (SSoT)**.
    2.  Update `scripts/link_drive_videos.py` and other enrichment scripts to write ONLY to the SSoT.
    3.  Automate the distribution of the SSoT to `path-builder/src/data/` and `path-builder/public/data/` at build time.
    4.  Update the React app to fetch from `/data/video_library_enriched.json` exclusively.

### 3. Script Rationalization
*   **De-bloat `scripts/`**:
    *   Identify and remove/archive `_` prefixed "v1" scripts if they've been superseded by `v2` or the enrichment pipeline.
    *   Consolidate individual validation scripts into a single `scripts/validate_all.py` tool.
    *   Remove `node_modules` inside `scripts/` if they can be moved to the root `package.json` or a safer location.

### 4. Build & Deployment Optimization
*   **Vite Chunks**: Further optimize `vite.config.js` to ensure the `data-courses` chunk isn't unnecessarily heavy.
*   **GitHub Actions**: Ensure the `deploy.yml` doesn't re-run expensive enrichment scripts on every push unless explicitly requested.

---

## ⚡ NEXT STEPS
1.  [ ] **Phase 1: Cleanup** — Move root artifacts.
2.  [ ] **Phase 2: Data Consolidation** — Unify `video_library_enriched.json`.
3.  [ ] **Phase 3: Validation Consolidation** — Merge validation scripts.

**Senior Developer Active. Awaiting Approval.**
