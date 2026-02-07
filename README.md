# Unreal Learning Path Tagging System

A **problem-first learning platform** for Unreal Engine 5. Users describe their problem, and the system generates a personalized learning path with AI-narrated video sequences, comprehension quizzes, and transcript-powered context cards.

> **Philosophy**: Problem-solving over tutorials. Debugging literacy over passive consumption.

---

## 🎯 What It Does

1. **Problem Analysis** — User describes their UE5 issue in plain language
2. **Intelligent Matching** — Hybrid transcript search + tag-based matching finds relevant content
3. **Guided Learning Path** — AI-narrated sequence: intro → videos → quizzes → challenges → reflection
4. **Enrichment Pipeline** — Gemini-powered summaries, learning objectives, quizzes, and prerequisites

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite (in `path-builder/`) |
| **Backend** | Firebase Cloud Functions (Node.js 20) |
| **Database** | Firebase Firestore |
| **AI** | Google Gemini 2.0 Flash (enrichment scripts) |
| **Hosting** | Firebase Hosting |
| **Testing** | Vitest + React Testing Library |
| **Linting** | ESLint 9 (flat config) |

---

## 📁 Project Structure

```
├── path-builder/          # React app (main UI)
│   ├── src/
│   │   ├── components/    # React components
│   │   │   └── GuidedPlayer/  # AI-narrated learning experience
│   │   ├── data/          # Static JSON data files
│   │   ├── services/      # API & auth services
│   │   └── utils/         # Helper functions
│   └── vitest.config.js   # Test configuration
├── scripts/               # Build-time enrichment scripts
│   ├── summarize_segments.py          # Gemini transcript summaries
│   ├── generate_learning_objectives.py # Course objectives
│   ├── generate_quiz_questions.py      # Video MCQs
│   ├── detect_prerequisites.py         # Prerequisite detection
│   └── run_enrichment_pipeline.py      # Pipeline runner
├── content/transcripts/   # 616 VTT transcript files
├── tags/                  # Tag schema & relationship graph
├── functions/             # Firebase Cloud Functions
├── docs/                  # Architecture & strategy docs
└── .env.example           # Environment variable template
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.10+ (for enrichment scripts)
- `GOOGLE_API_KEY` set as system env var (for Gemini enrichment)

### Development

```bash
cd path-builder
npm install
npm run dev          # http://localhost:5173
```

### Run Tests

```bash
cd path-builder
npm test             # Run all tests
npm run test:watch   # Watch mode
```

### Run Linter

```bash
cd path-builder
npm run lint
```

### Enrichment Pipeline

```bash
# Set API key (one-time, persists across sessions)
[System.Environment]::SetEnvironmentVariable("GOOGLE_API_KEY", "your_key", "User")

# Run all enrichment scripts
python scripts/run_enrichment_pipeline.py
```

---

## 🧪 Enrichment Pipeline

| Script | Output | Purpose |
|--------|--------|---------|
| `build_transcript_index.py` | `transcript_segments.json` | Parse 616 VTT files → 7,049 segments |
| `summarize_segments.py` | Updates `transcript_segments.json` | Natural language summaries per segment |
| `generate_learning_objectives.py` | `learning_objectives.json` | 3-5 objectives per course |
| `generate_quiz_questions.py` | `quiz_questions.json` | 2-3 MCQs per video |
| `detect_prerequisites.py` | `course_prerequisites.json` | Prerequisite relationships |

All scripts use the Google Gemini API free tier (1,500 RPD).

---

## 🔗 Related Projects

- [UE5QuestionGenerator](https://github.com/SamDeiter/UE5QuestionGenerator)
- [UE5LMSBlueprint](https://github.com/SamDeiter/UE5LMSBlueprint)
- [UE5LMSMaterials](https://github.com/SamDeiter/UE5LMSMaterials)

---

## License

MIT License
