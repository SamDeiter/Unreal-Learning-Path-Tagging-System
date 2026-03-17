# UE5 In-Editor Learning Path System — Builder & Viewer (v3)

## Background & Problem

Feedback requires a fundamentally new approach to how learning paths are **authored** and **consumed**. The system must:

1. **Builder** (browser-based): A visual pipeline tool for authors to compose chapter-based learning paths — this is where everything gets tied together
2. **Viewer** (inside UE5): A guided learner player that runs inside UE5's Web Browser Widget (CEF/Chromium)
3. **Preview mode** in the builder so authors can see what learners will experience before publishing
4. Support video from **YouTube** and/or an **LMS**
5. Scale to **~100 learning paths** with an efficient authoring workflow
6. Produce a **stakeholder demo** first — build one real example, get buy-in, then scale

---

## Strategy: Example-First Approach

> [!IMPORTANT]
> **Phase 0 is the real deliverable.** Before building the full system, we build **one concrete example path** end-to-end as a proof of concept. This gets shown to stakeholders. If they like it, we scale.

| Phase | Goal | Deliverable |
|---|---|---|
| **Phase 0** | Build one example path + viewer mockup | Working demo of "Set up AI to patrol and chase the player" |
| **Phase 1** | Core schema + path builder | Authoring tool that can produce paths at scale |
| **Phase 2** | Path viewer inside UE5 | Learner experience running in the editor web widget |
| **Phase 3** | Scale to 100 paths | Templates, AI auto-build, signoff workflow |

---

## Content Architecture: Chapters → Steps

Paths are **chapter-based**, not flat lists. Each chapter is a teachable module. Inside each chapter, authors arrange steps from the step-type palette in any order.

### Hierarchy

```
Learning Path
├── Metadata (name, level, industry, estimated time)
├── Chapter 1: "Setting Up the NavMesh Bounds Volume"
│   ├── AI Transition (objectives, what you'll learn)
│   ├── Content Video (YouTube tutorial)
│   ├── Quiz (5 questions, repeat till pass)
│   └── AI Transition (summary, what's next)
├── Chapter 2: "Creating the AI Character and Controller"
│   ├── AI Transition
│   ├── Content Doc Page (docs.unrealengine.com)
│   ├── Content Video
│   └── Quiz
├── Chapter 3: "Enabling and Creating a State Tree"
│   └── ...
└── ... (more chapters)
```

### Concrete Example: "Set up an Unreal AI to patrol and chase the player"

| Ch# | Chapter Title | Description |
|---|---|---|
| 1 | Setting Up the NavMesh Bounds Volume | Define the walkable area in your level so the AI can move |
| 2 | Creating the AI Character and Controller | Set up the core enemy pawn and assign an AI Controller to it |
| 3 | Enabling and Creating a State Tree | Turn on the State Tree plugin and create a new asset assigned to your AI |
| 4 | Setting Up AI Perception | Add the sight component to the AI Controller. Adjust vision radius and angle |
| 5 | Configuring State Tree Parameters and Evaluators | Add a variable for the target player. Set up an Evaluator to update it when the AI sees the player |
| 6 | Building the Roam State | Add a state with tasks that pick a random point on the NavMesh and move the AI to it |
| 7 | Building the Chase State | Add a second state with a task to move the AI directly to the target player variable |
| 8 | Adding State Transitions | Set the rules for switching states. Add a condition that forces "Roam" → "Chase" when the player is seen |

### Step-Type Palette

The building blocks authors can arrange **in any order** within a chapter:

| Step Type | Content | AI-Generated Metadata |
|---|---|---|
| **🔄 AI Transition** | Bridge between sections | Learning objectives, expected outcomes, "what's next" |
| **🎬 Content Video** | YouTube or LMS video embed | Augments to videos, "Explain Why & How" |
| **📄 Content Doc Page** | Documentation / article | Relevant snippets, possible images |
| **🤖 Content RAG Pipeline** | AI-generated content via Retrieval Augmented Generation | Pulls relevant knowledge from indexed sources, generates contextual instructional material |
| **✅ Quiz** | Knowledge check (aspirational) | 5 questions, follow-ups, repeat till pass — question banks TBD |

> [!NOTE]
> **Skippability**: Learners can skip any step or entire chapter. The viewer needs skip controls, not just "Next." Progress still tracks what was skipped vs. completed.

---

## Path Creation Wizard

Simplified flow based on your mockup:

```mermaid
flowchart TD
    A["Create New Path"] --> B["Path Name"]
    B --> C["Who is this path for?"]
    C --> D{"Skill Level"}
    D --> BEG["Beginner\n< 5 Hours"]
    D --> INT["Intermediate\n5–15 Hours"]
    D --> ADV["Advanced\n10–25 Hours"]
    BEG --> E["Industry Focus"]
    INT --> E
    ADV --> E
    E --> F["All General | Games | Film & TV\nArchitecture | Simulation\nAutomotive | Media & Entertainment"]
    F --> G["Start Building Chapters"]
```

After completing the wizard, the author lands in the **Pipeline Builder** where they add chapters and arrange steps within each chapter.

---

## Process Flowcharts

### 1. Author Workflow — Building a Learning Path

```mermaid
flowchart TD
    A["Author Opens Builder"] --> WIZ["Path Creation Wizard\n(Name → Level → Industry)"]
    WIZ --> B{"Choose Method"}
    B -->|Manual| C["Add Chapter"]
    B -->|AI Assisted| D["Enter Topic"]
    D --> E["AI Auto-Generates\nChapters + Steps"]
    E --> F["Review Generated Path"]
    C --> G["Name Chapter\n+ Add Description"]
    F --> G

    G --> H["Drag Steps from Palette\ninto Chapter"]
    H --> I["Configure Each Step\n(Video URL, Quiz bank, etc.)"]
    I --> J{"More Chapters?"}
    J -->|Yes| C
    J -->|No| K["Preview in Viewer"]
    K --> L{"Looks Good?"}
    L -->|No| G
    L -->|Yes| M["Submit for Signoff"]
    M --> N{"Approved?"}
    N -->|No| O["Revision Notes"]
    O --> G
    N -->|Yes| P["Published Path"]
```

### 2. Learner Experience — Consuming a Path in UE5

```mermaid
flowchart TD
    START(["▶ Start Path"]) --> LOAD["Load Path\n(Chapter List View)"]
    LOAD --> CHAP["Enter Current Chapter"]
    CHAP --> STEP["Display Current Step"]

    STEP --> CHECK{"Step Type?"}

    CHECK -->|AI Transition| TRANS["Show:\n• Learning Objectives\n• What's Coming Next"]
    TRANS --> NAV

    CHECK -->|Content Video| VID["YouTube/LMS Embed\n+ AI 'Why & How' Panel"]
    VID --> NAV

    CHECK -->|Content Doc| DOC["Doc Page\n+ AI Highlighted Snippets"]
    DOC --> NAV

    CHECK -->|Content RAG| RAG["AI-Generated Content\nfrom RAG Pipeline"]
    RAG --> NAV

    CHECK -->|Quiz| QUIZ["Present 5 Questions"]
    QUIZ --> SCORE{"Pass?"}
    SCORE -->|No| RETRY["Follow-Up Explanations\n→ Retry Quiz"]
    RETRY --> QUIZ
    SCORE -->|Yes| NAV

    NAV{"Navigation"} -->|Next Step| STEP
    NAV -->|Skip Step| STEP
    NAV -->|Next Chapter| CHAP
    NAV -->|Skip Chapter| CHAP

    CHAP --> DONE{"Last Chapter?"}
    DONE -->|No| STEP
    DONE -->|Yes| COMPLETE(["🎓 Path Complete"])
    COMPLETE --> UE5["Send Completion\nto UE5 Editor"]
```

### 3. System Architecture

```mermaid
flowchart LR
    subgraph AUTHOR["Author Side (Builder)"]
        WIZ2["Creation Wizard"] --> CHAPTERS["Chapter Editor"]
        CHAPTERS --> STEPS["Step Palette\n+ Config Panel"]
        STEPS --> SIGNOFF["Submit for\nSignoff"]
    end

    subgraph AI["AI Services"]
        GEMINI["Gemini API"]
        SEARCH["Video Segment\nSearch"]
        QBANK["Quiz Question\nBank"]
    end

    subgraph STORAGE["Persistence"]
        FS["Firestore\n(Path JSON)"]
        YT["YouTube"]
        LMS["LMS Content"]
    end

    subgraph LEARNER["Learner Side (Viewer in UE5)"]
        LOAD2["Load Path"] --> PLAYER["Chapter/Step\nPlayer"]
        PLAYER --> PROGRESS["Progress\nTracker"]
        PLAYER --> UE5B["UE5 Bridge"]
    end

    STEPS -->|"AI Generate"| GEMINI
    STEPS -->|"Find Videos"| SEARCH
    STEPS -->|"Load Questions"| QBANK
    SIGNOFF --> FS

    FS --> LOAD2
    YT --> PLAYER
    LMS --> PLAYER
    UE5B -->|"OnConsoleMessage"| ENGINE["UE5 Editor\nBlueprints"]
```

---

## UE5 Web Widget Constraints

> [!NOTE]
> These constraints apply to the **Viewer only**. The Builder runs in a normal browser and is not limited by CEF.

| Constraint | Impact (Viewer only) |
|---|---|
| **Chromium 90** (2021) | No modern CSS (`container-queries`, `@layer`). Use well-supported CSS only. |
| **CPU-only rendering** | No heavy animations, no WebGL. Keep it lightweight. |
| **Aggressive caching** | Cache-busting with versioned URLs |
| **YouTube iframes OK** | YouTube handles its own decoding — works in CEF |
| **UE5 ↔ Web comms** | `OnConsoleMessage` (web → UE5) and `ExecuteJavascript` (UE5 → web) |

### Design Response
- **Dark UE5 editor aesthetic** — match the dark-themed mockup style (viewer)
- **Vanilla CSS** — maximum Chromium 90 compatibility (viewer); builder can use modern CSS
- **React 18 + Vite** — keep existing toolchain, self-contained `dist/` bundles
- **No heavy dependencies in viewer** — native HTML5 drag in builder is fine
- **JSON data model** — paths stored in Firestore
- **Preview mode in builder** — renders a lightweight version of the viewer inline so authors can see what learners will experience

---

## Updated Data Schema

```json
{
  "id": "path-uuid",
  "title": "Set up an Unreal AI to patrol and chase the player",
  "version": 1,
  "status": "draft | review | approved | published",
  "author": "Sam Deiter",
  "reviewedBy": null,

  "metadata": {
    "skillLevel": "intermediate",
    "estimatedHours": "5-15",
    "industryFocus": ["games"],
    "tags": ["AI", "State Tree", "NavMesh", "AI Perception"]
  },

  "chapters": [
    {
      "id": "ch-uuid",
      "title": "Setting Up the NavMesh Bounds Volume",
      "description": "Define the walkable area in your level so the AI can move",
      "skippable": true,
      "steps": [
        {
          "id": "step-uuid",
          "type": "AI_TRANSITION",
          "config": { "objectives": ["..."], "expectedOutcome": "..." },
          "aiGenerated": { "narrative": "..." },
          "skippable": true
        },
        {
          "id": "step-uuid",
          "type": "CONTENT_VIDEO",
          "config": {
            "videoUrl": "https://youtube.com/watch?v=...",
            "source": "youtube",
            "title": "NavMesh Setup Tutorial",
            "startTime": 0,
            "endTime": null
          },
          "aiGenerated": { "whyAndHow": "...", "augmentations": [] },
          "skippable": true
        },
        {
          "id": "step-uuid",
          "type": "QUIZ",
          "config": {
            "questionCount": 5,
            "passingScore": 0.8,
            "retryAllowed": true,
            "bankId": "navmesh-basics"
          },
          "skippable": false
        }
      ]
    }
  ]
}
```

---

## What We Can Reuse

| Existing Asset | Reuse Strategy |
|---|---|
| `bespokePathService.js` | Powers "AI Auto-Build" for generating chapters from a topic |
| `quizService.js` | Extend later for per-step quiz with retry-till-pass (aspirational) |
| `geminiService.js` | AI transition, augmentation, and RAG content generation |
| `segmentSearchService.js` | Finding relevant YouTube segments |
| `searchPipeline.js` / `docsSearchService.js` | Powers the RAG pipeline step type |
| Firebase Auth / Firestore | Persistence + access control as-is |

---

## Resolved Questions

| # | Question | Answer |
|---|---|---|
| 1 | Content Rap Pipeline? | It's the **RAG pipeline** — Retrieval Augmented Generation, not music |
| 2 | Hosting? | Still TBD — likely Firebase-hosted URL |
| 3 | Quiz banks? | **Aspirational** — just an idea for now, not a priority |
| 4 | Builder location? | **Browser-based**. Builder ties everything together; only the viewer runs in UE5 |
| 5 | SCORM export? | **No**. Need a **preview mode** instead so authors can see what they're making |
| 6 | Signoff workflow? | **TBD** — not sure yet, will define later |

---

## Remaining Open Question

1. **Hosting** — Firebase-hosted URL loaded in UE5, or local HTML files bundled with a UE5 plugin, or either?

---

## Next Steps (After Approval)

1. **Generate visual mockups** of the learner viewer (dark UE5 aesthetic) for stakeholder presentation
2. **Build the example path** ("AI patrol and chase") as a static JSON to validate the schema
3. **Build the viewer** first (the stakeholder demo) — this gets shown to others to see if they like it
4. **Build the builder** tooling after buy-in is confirmed
