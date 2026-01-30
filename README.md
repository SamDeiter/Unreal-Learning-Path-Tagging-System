# Unreal Learning Path Tagging System

A schema-driven system to **analyze user queries** about Unreal Engine, **tag them semantically**, and **generate personalized learning paths** for solving UE issues.

> **Philosophy**: Problem-solving over tutorials. Debugging literacy over passive consumption.

---

## 🎯 Project Goals

1. **Query Analysis** – Capture and normalize user questions about Unreal Engine
2. **Semantic Tagging** – Automatically categorize queries using deterministic matching
3. **Learning Path Generation** – Match tagged queries to step-by-step resolution paths

## 🚫 Non-Goals

- No monolithic video courses or "tutorial hell"
- No embeddings-based matching (v0.1 uses regex/contains only)
- No user accounts or progress tracking (POC scope)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS, HTML, CSS (in `ui/` directory) |
| **Backend** | Firebase Cloud Functions (Node.js 20) |
| **Database** | Firebase Firestore |
| **AI** | Google Gemini 2.0 Flash (via Vertex AI / Studio) |
| **Hosting** | Firebase Hosting |
| **Development** | Firebase Emulators (Legacy: Python local server) |

---

## 📁 Project Structure

```
├── functions/        # Firebase Cloud Functions (Backend Logic)
│   ├── ai/           # AI Generation Logic (Gemini 2.0)
│   └── index.js      # Functions Entry Point
├── ui/               # Frontend Application
│   ├── js/           # Client-side Logic
│   ├── css/          # Styles
│   └── index.html    # Entry Point
├── tags/
│   ├── tags.json     # 55 canonical tags with full schema
│   └── edges.json    # Tag relationship graph
├── learning_paths/   # JSON Schema configs
├── ingestion/        # Legacy Python ingestion scripts & matching rules
├── firebase.json     # Firebase Project Configuration
└── README.md
```

---

## 🏷️ Tag Schema (v0.1)

Each tag includes:

| Field | Description |
|-------|-------------|
| `tag_id` | Namespaced identifier (e.g., `build.exitcode_25`) |
| `display_name` | Human-readable name |
| `tag_type` | One of: `system`, `workflow`, `symptom`, `error_code`, `tool`, `platform`, `concept`, `ui_surface` |
| `synonyms` | Search trigger variants |
| `aliases` | Typed variants (abbrev, legacy, community) |
| `signals.error_signatures` | Exact error strings for matching |
| `constraints.engine_versions` | UE version compatibility |
| `relevance.global_weight` | 0-1 importance score |

---

## 🔄 How Matching Works

```
User Query → AI Analysis/Deterministic Match → Tag Assignment → Learning Path Selection
```

1. **AI Analysis**: `generateLearningPath` Cloud Function analyzes query intent.
2. **Tag Matching**: Contextual tags are extracted from the problem description.
3. **Path Generation**:
   - **RAG**: Retrieves curated videos from catalog.
   - **Grounding**: Falls back to Google Search for novel topics.
4. **Structured Output**: AI generates a valid JSON learning path with:
   - Understanding (Concept)
   - Diagnostics (Root Cause)
   - Resolution (Fix)
   - Prevention (Best Practices)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud Project with Gemini API enabled

### Quick Start (Modern)

1. **Navigate to App Directory**

   ```bash
   cd path-builder
   ```

2. **Install & Run**

   ```bash
   npm install
   npm run dev
   ```

3. **Open App**
   <http://localhost:5173>

### Legacy Python Server

*Deprecated. Do not use `ui/server.py`.*

---

## 📊 Current Tag Coverage (v0.1)

| Category | Count |
|----------|-------|
| Core Systems (C++, Blueprint, AI, Multiplayer) | 8 |
| Visuals (Lumen, Nanite, Niagara, Materials) | 10 |
| Characters & Animation | 5 |
| Platforms (VR, Quest, Android, iOS) | 8 |
| Genres & Templates | 8 |
| Build & Errors | 6 |
| Crashes & Debugging | 6 |
| **Total** | **55** |

---

## 🔗 Related Projects

- [UE5QuestionGenerator](https://github.com/SamDeiter/UE5QuestionGenerator)
- [UE5LMSBlueprint](https://github.com/SamDeiter/UE5LMSBlueprint)
- [UE5LMSMaterials](https://github.com/SamDeiter/UE5LMSMaterials)

---

## License

MIT License
