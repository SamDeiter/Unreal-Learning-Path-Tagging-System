# Architecture: Unreal Learning Path Tagging System

**Version**: 1.0.0  
**Status**: Active  
**Last Updated**: 2026-01-27

---

## System Overview

The Unreal Learning Path Tagging System is a **deterministic, scored, composable** engine that:

1. Analyzes user queries about Unreal Engine problems
2. Matches queries to semantic tags with ranked scores
3. Expands tags via prerequisite edges
4. Composes personalized learning paths from atomic steps

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER QUERY                                       │
│               "UE5 packaging fails with ExitCode=25"                     │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SCORED MATCHER                                        │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐             │
│  │ match_rules.json│  │   tags.json    │  │ synonym_rings  │             │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘             │
│          │                   │                   │                       │
│          └───────────────────┴───────────────────┘                       │
│                              │                                           │
│                              ▼                                           │
│              Score = SignalType × RuleWeight × TagWeight                 │
│                              │                                           │
│                              ▼                                           │
│         ┌────────────────────────────────────────────┐                   │
│         │  Ranked Tags: [build.exitcode_25: 0.95,    │                   │
│         │                build.packaging: 0.72,      │                   │
│         │                tool.uat: 0.54]             │                   │
│         └────────────────────────────────────────────┘                   │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    EDGE EXPANDER                                         │
│  ┌────────────────┐                                                      │
│  │   edges.json   │ ─── symptom_of, often_caused_by, prerequisite       │
│  └───────┬────────┘                                                      │
│          │                                                               │
│          ▼                                                               │
│    Expand Prerequisites: build.exitcode_25 → build.packaging (0.9)      │
│    Resolve Conflicts:    If conflicting tags, apply resolution rules    │
│    Check Versions:       Filter tags incompatible with user's UE version│
│                                                                          │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PATH COMPOSER                                         │
│  ┌────────────────┐  ┌────────────────┐                                  │
│  │  steps/atoms/  │  │   templates/   │                                  │
│  └───────┬────────┘  └───────┬────────┘                                  │
│          │                   │                                           │
│          │   Compose from atoms if available                             │
│          │   Fallback to golden template if not                          │
│          │                                                               │
│          ▼                                                               │
│    Learning Path with:                                                   │
│      - foundation steps (WHY)                                            │
│      - diagnostic steps (HOW to identify)                                │
│      - remediation steps (HOW to fix)                                    │
│      - verification steps (confirm fix)                                  │
│                                                                          │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    OUTPUT                                                │
│  {                                                                       │
│    "path_id": "lp.build.exitcode_25.composed",                          │
│    "tags": [...],                                                        │
│    "steps": [                                                            │
│      { "atom": "understand_build_pipeline", "evidence": [...] },        │
│      { "atom": "read_build_log", "evidence": [...] },                   │
│      ...                                                                 │
│    ],                                                                    │
│    "trace": { "scores": [...], "edge_expansions": [...] }               │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Scoring Formula

### Core Formula

```
TagScore = Σ(SignalTypeMultiplier × RuleWeight × TagGlobalWeight)
```

Where:

- **SignalTypeMultiplier**: How strong the signal is based on pattern type
- **RuleWeight**: Confidence weight of the matching rule (0.0-1.0)
- **TagGlobalWeight**: Importance of the tag from `tags.json` (0.0-1.0)

### Signal Type Multipliers

| Signal Type | Multiplier | Description | Example |
|-------------|------------|-------------|---------|
| `exact_signature` | **1.0** | Exact error string match | `DXGI_ERROR_DEVICE_REMOVED` |
| `regex` | **0.8** | Pattern match | `ExitCode[=:\s]*25` |
| `contains` | **0.6** | Substring match | `"packaging"` found in query |
| `synonym` | **0.4** | Synonym ring match | `"BP"` → `blueprint` |
| `negative` | **-1.0** | Blocks tag entirely | Presence of `ExitCode=0` |

### Scoring Examples

**Query**: `"UE5 packaging fails with ExitCode=25"`

| Tag | Rule Match | SignalType | RuleWeight | TagWeight | Score |
|-----|------------|------------|------------|-----------|-------|
| `build.exitcode_25` | `ExitCode[=:\s]*25` regex | 0.8 | 0.95 | 1.0 | **0.76** |
| `build.packaging` | `packaging` contains | 0.6 | 0.90 | 0.88 | **0.48** |
| `build.packaging` | `cook` contains | 0.6 | 0.90 | 0.88 | **0.48** |
| **Total for packaging** | | | | | **0.96** |

Final ranked output:

1. `build.packaging`: 0.96
2. `build.exitcode_25`: 0.76

---

## Tie-Breaker Rules

When two tags have identical scores, apply these rules **in order**:

1. **Higher priority rule wins** - Use `priority` field from `match_rules.json`
2. **More specific tag wins** - Longer `tag_id` = more specific (`crash.d3d_device_lost` > `crash`)
3. **Alphabetical order** - Deterministic fallback

---

## Conflict Resolution

### When Conflicts Occur

- Two tags with `conflict` edge relation
- Mutually exclusive platforms (e.g., `platform.ios` + `platform.android` for single-platform query)
- Version-incompatible tags

### Resolution Strategies

| Strategy | When Applied | Behavior |
|----------|-------------|----------|
| `prefer_higher_score` | Default | Keep tag with higher score |
| `prefer_source` | Edge has `conflict_resolution: "prefer_source"` | Keep source tag |
| `keep_both` | Non-exclusive conflict | Include both with warning |

---

## Edge Behavior

### Edge Types and Their Effects

| Edge Type | Effect on Matching | Effect on Path Composition |
|-----------|-------------------|---------------------------|
| `symptom_of` | If symptom matched, boost root cause score | Add root cause diagnosis step |
| `often_caused_by` | Suggest related causes | Include related causes in path options |
| `prerequisite` | Auto-expand: if A matched, include B | Ensure B's steps come before A's |
| `subtopic` | Child inherits parent context | Include parent overview before subtopic |
| `related` | No auto-expansion | Include as "see also" suggestions |
| `replaces` | If legacy matched, redirect to new | Use new tag's learning content |

### Prerequisite Expansion Algorithm

```python
def expand_prerequisites(matched_tags, edges):
    expanded = set(matched_tags)
    for tag in matched_tags:
        for edge in edges:
            if edge.source == tag and edge.relation == "symptom_of":
                # Add the root cause with weight
                expanded.add((edge.target, edge.weight))
    return expanded
```

---

## Version Constraint Enforcement

Each tag in `tags.json` has version constraints:

```json
{
  "constraints": {
    "engine_versions": { "min": "5.0", "max": null },
    "platforms": ["Windows", "PS5", "XSX"]
  }
}
```

### Enforcement Rules

1. **During Matching**: If query mentions `UE4`, filter out tags with `min: "5.0"`
2. **During Path Composition**: Warn if path includes version-incompatible steps
3. **Version Detection**: Extract version from query via regex: `UE([45])\.?\d*`, `Unreal\s*(\d+)`

---

## Data Contracts

### Input: User Query

```typescript
interface UserQuery {
  queryText: string;           // Raw user input
  engineVersion?: string;      // Optional: "5.3", "4.27"
  platform?: string;           // Optional: "Windows", "Quest"
}
```

### Output: Scored Tags

```typescript
interface ScoredTag {
  tag_id: string;              // e.g., "build.exitcode_25"
  score: number;               // 0.0 - 1.0+
  matched_rules: string[];     // Rule IDs that matched
  trace: MatchTrace;           // Debug info
}

interface MatchTrace {
  patterns_matched: PatternMatch[];
  negative_blocks: string[];   // Patterns that blocked
  edge_expansions: string[];   // Tags added via edges
}
```

### Output: Composed Path

```typescript
interface ComposedPath {
  path_id: string;
  title: string;
  tags: ScoredTag[];
  steps: ComposedStep[];
  trace: CompositionTrace;
}

interface ComposedStep {
  atom_id: string;             // Reference to steps/atoms/
  step_type: "foundation" | "diagnostic" | "remediation" | "verification";
  why: string;                 // Why this step is included
  evidence: string[];          // Sources backing this step
  verification: Verification;  // How to confirm completion
}
```

---

## Atomic Steps vs Golden Templates

### When to Use Atoms

- New or dynamic paths composed from multiple tags
- Paths that need customization based on edge traversal
- A/B testing different step orderings

### When to Use Golden Templates

- Well-tested, curated paths for common problems (ExitCode=25, D3D crash)
- Paths with complex decision gates that need human curation
- Fallback when atoms don't cover all required steps

### Fallback Logic

```python
def compose_path(tags, edges):
    atoms = find_atoms_for_tags(tags)
    if covers_all_step_types(atoms):
        return compose_from_atoms(atoms, edges)
    else:
        template = find_golden_template(tags)
        if template:
            return template
        else:
            return partial_atom_path(atoms)  # Best effort
```

---

## File Structure

```
├── ingestion/
│   ├── match_rules.json      # Pattern → Tag matching rules
│   ├── scored_matcher.py     # NEW: Scoring engine
│   ├── path_composer.py      # NEW: Atom-based composition
│   └── path_generator.py     # Existing: AI-assisted generation
├── tags/
│   ├── tags.json             # Canonical tag definitions
│   ├── edges.json            # Tag relationship graph
│   └── synonym_rings.json    # Synonym expansions
├── steps/
│   └── atoms/                # NEW: Atomic learning steps
│       ├── understand_build_pipeline.json
│       └── ...
├── learning_paths/
│   ├── templates/            # Golden path templates
│   └── generated/            # Runtime-generated paths
├── computed_matches/         # NEW: Debug trace output
├── tests/                    # NEW: Test suite
└── docs/
    └── architecture.md       # This file
```

---

## Invariants (Always True)

1. **Deterministic**: Same query → Same tags → Same path (no randomness)
2. **Explainable**: Every tag score can be traced to specific pattern matches
3. **Version-Aware**: No UE5-only content shown for UE4 queries
4. **Complete Steps**: Every step has `why`, `evidence`, and `verification`
5. **No Embeddings**: All matching is pattern-based, not semantic similarity
