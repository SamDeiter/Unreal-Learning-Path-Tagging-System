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

> **Important**: This is a **JavaScript/Node.js** project. Do not add Python scripts.

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS, HTML, CSS |
| **Backend** | Firebase Cloud Functions (Node.js) |
| **Database** | Firebase Firestore |
| **AI** | Google Gemini API |
| **Hosting** | Firebase Hosting |
| **Scripts** | Node.js (not Python)

---

## 📁 Project Structure

```
├── tags/
│   ├── tags.json         # 55 canonical tags with full schema
│   ├── categories.json   # Lightweight category taxonomy
│   ├── edges.json        # Tag relationship graph
│   └── GOVERNANCE.md     # Rules to prevent schema rot
├── user_queries/
│   ├── schema.json       # Query schema definition
│   └── examples/         # Sample queries for testing
├── learning_paths/
│   ├── schema.json       # Learning path schema
│   └── templates/        # Step-by-step resolution paths
├── ingestion/
│   ├── match_rules.json  # Deterministic text→tag matching
│   └── content_index.json # Atomic content references
├── .env.example          # API key template
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
User Query → Deterministic Match → Tag Assignment → Learning Path Selection
```

1. User submits query: `"UE5 packaging fails with ExitCode=25"`
2. `match_rules.json` applies regex/contains patterns
3. Matches: `build.exitcode_25` + `build.packaging`
4. System selects: `lp.build.exitcode_25.v1` learning path

**No embeddings required** – all matching is deterministic via:

- Regex patterns: `ExitCode[=:\s]*25`
- Contains rules: `"D3D device lost"`
- Error signatures: `0xC0000005`, `DXGI_ERROR_DEVICE_REMOVED`

---

## 📚 Learning Path Structure

Each path has:

- **Entry conditions**: Required/optional tags
- **Steps**: foundation → diagnostic → remediation → verification
- **Decision gates**: Branch based on detected symptoms
- **Skills gained**: What the user learns (not just actions)

Example path: `lp.build.exitcode_25.v1.json`

```
Step 1: Understanding the Build Pipeline (foundation)
Step 2: Reading the Build Log (diagnostic)
  └─ Decision Gate: What error type?
     ├─ Cook error → Step 3
     ├─ Compile error → Step 4
     └─ Shader error → Step 5
Step 7: Verify the Fix (verification)
```

---

## 🚀 Quick Start

**Live Demo**: <https://ue5-learning-paths.web.app>

### Cloud Deployment (Production)

The app uses Firebase Cloud Functions for serverless AI generation:

```bash
# Deploy functions (requires Blaze plan)
firebase deploy --only functions

# Deploy hosting
firebase deploy --only hosting
```

### Local Development

```bash
# Clone the repo
git clone https://github.com/SamDeiter/Unreal-Learning-Path-Tagging-System.git

# Copy environment template
cp .env.example .env

# Add your API keys to .env
# YOUTUBE_API_KEY=your_key_here
# GEMINI_API_KEY=your_key_here

# Run local server
python ui/server.py
# Open http://localhost:8080
```

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
