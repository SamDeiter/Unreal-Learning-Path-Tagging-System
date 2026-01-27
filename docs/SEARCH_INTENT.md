# Search Intent Analysis: UE5 Developer Behavior

This document describes the psychology of how developers search for help in the Unreal Engine ecosystem, based on Section 12 of the Unified Taxonomy research.

---

## The Escalation of Specificity

Users progress through distinct stages when seeking help:

| Stage | Query Type | Example | Associated Tags |
|-------|-----------|---------|-----------------|
| **1. Discovery** | Natural Language | "How to make a game menu" | `ui.umg`, `ui.widget` |
| **2. Implementation** | Specific Feature | "Cast to player controller" | `scripting.casting`, `core.player_controller` |
| **3. Troubleshooting** | Symptom Description | "Menu buttons not clicking" | `ui.input_mode`, `ui.focus` |
| **4. Failure** | Error/Log Signature | "Access violation 0xC0000005" | `crash.access_violation`, `debug.callstack` |

> **Insight**: The tag database must capture users at ALL stages. A novice searching for "Menu" needs to find `ui.umg`. An expert searching for `0xC0000005` needs memory debugging tools.

---

## Common Search Patterns

### The "Unknown Cook Failure" Search Black Hole

Users who encounter `ExitCode=25` rarely realize it's a wrapper error. Their queries:

- "AutomationTool exiting with ExitCode=25"
- "Unknown Cook Failure UE5"
- "Packaging failed Unknown Error"

**Solution**: The database provides symptom-to-cause hierarchy linking `ExitCode=25` to specific root causes (Path_Length_Limit, Asset_Validation, Corrupt_Asset).

### The "Black Screen" Cluster

High-volume searches for VR/Mobile:

- "Oculus Quest black screen audio plays"
- "Android build black screen"
- "VR game shows nothing"

**Root Causes**: Mobile HDR enabled on unsupported hardware, OpenXR configuration, Vulkan issues.

### The "Lag" Misnomer

In multiplayer, users search for "Lag" when experiencing replication issues:

- User sees: Character stuttering
- User searches: "fix multiplayer lag"
- Actual solution: `CharacterMovementComponent`, Network Prediction, Replication settings

---

## Vocabulary Bifurcation: UE4 to UE5

The transition introduced terminology changes users may not know:

| Legacy Term (UE4) | Current Term (UE5) | Canonical Tag |
|-------------------|-------------------|---------------|
| PhysX | Chaos | `physics.chaos` |
| Cascade | Niagara | `rendering.niagara` |
| Static Lighting | Lumen (optional) | `rendering.lumen` |
| LOD System | Nanite | `rendering.nanite` |

**Tagging Implication**: The `synonym_rings.json` includes legacy terms pointing to current systems.

---

## Proficiency-Based Search Intent

### Novice Users

- Search for high-level workflows
- Use imprecise language ("why is my screen black")
- Need: Tutorials tagged with `skill_level.beginner`

### Intermediate Users

- Search for specific Blueprint nodes
- Use feature names ("Get Player Controller")
- Need: Workflow examples with step-by-step guidance

### Advanced/Engineers

- Search for exact log signatures
- Paste error codes verbatim
- Need: Error indexing that matches `LNK1181` or `ExitCode=25` precisely

---

## Design Principles for Discoverability

1. **Index Error Signatures**: Tags must include exact error codes as searchable terms
2. **Support Synonyms**: Link vernacular ("BP") to canonical ("Blueprint")
3. **Version Awareness**: Every tag must specify engine version compatibility
4. **Symptom-to-Cause Mapping**: Visual artifacts connect to root causes via `edges.json`
