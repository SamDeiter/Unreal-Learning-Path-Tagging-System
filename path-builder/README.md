# Path Builder — React Frontend

The interactive learning path builder for the Unreal Learning Path Tagging System. Built with React 19 + Vite 7.

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173/Unreal-Learning-Path-Tagging-System/
```

## Scripts

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Start dev server (port 5173)                            |
| `npm run build`      | Production build to `dist/`                             |
| `npm test`           | Unit + component + regression tests (Vitest, 300 tests) |
| `npm run test:watch` | Watch mode                                              |
| `npm run test:e2e`   | Playwright E2E browser tests (9 tests)                  |
| `npm run lint`       | ESLint                                                  |
| `npm run lint:css`   | Stylelint                                               |

## Testing

**316 tests** across 26 files:

- **Data integrity** (32) — JSON schema validation, field linkage
- **Service units** (39) — TagGraphService, narratorService, semanticSearchService
- **E2E browser** (9) — Playwright with Firebase auth bypass (`VITE_E2E_BYPASS`)
- **Component smoke** (13) — LoadingSpinner, ErrorBoundary, DiagnosisCard, etc.
- **Search quality** (16) — Known-answer tag extraction, cosine similarity invariants
- **Bundle regression** (7) — Build verification, size caps, code-splitting validation
- **Pre-existing** (200) — Quiz, config, float16, stemmer, logger, etc.

### E2E Setup

Playwright runs on a separate Vite server (port 5174) with `VITE_E2E_BYPASS=true` to bypass Firebase auth. Install browsers first:

```bash
npx playwright install chromium
npm run test:e2e
```

## Project Structure

```
src/
├── components/       # 25 component modules (MobileNav, ProblemFirst, GuidedPlayer)
├── context/          # PathContext, TagDataContext, constants
├── hooks/            # 8 custom hooks (useIsMobile, useProblemFirst)
├── services/         # 25 service modules (search, AI, analytics)
├── data/             # 24 static JSON data files (~30MB)
├── utils/            # Shared helpers (stemming, float16, logger)
└── __tests__/        # Test files
```
