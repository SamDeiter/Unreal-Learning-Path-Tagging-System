# Understanding Developer Search Behavior

> How users seek help in the Unreal Engine ecosystem and how this system bridges their questions to solutions.

---

## Overview

When developers encounter problems in Unreal Engine, they don't search for documentation—they search for symptoms. A user experiencing a black screen doesn't search "HDR configuration"; they search "why is my screen black." This system translates that intent into actionable learning paths.

---

## How Developers Search

### The Four Stages of Problem-Solving

Developers progress through increasingly specific query types:

1. **Discovery** - Broad questions in natural language
   - Example: *"How to make a game menu"*
   - These users need foundational tutorials

2. **Implementation** - Feature-specific queries
   - Example: *"Cast to player controller blueprint"*
   - These users know what they want, just not how

3. **Troubleshooting** - Symptom descriptions
   - Example: *"Menu buttons not responding"*
   - These users have a working system with a specific bug

4. **Failure** - Error codes and log output
   - Example: *"Access violation 0xC0000005"*
   - These users need precise diagnostic paths

Our tagging system captures all four stages by indexing both concepts AND error signatures.

---

## High-Volume Problem Clusters

Based on community forum analysis, these are the most common search patterns:

### Build Failures: The ExitCode=25 Trap

`ExitCode=25` appears in thousands of forum posts because it's a **wrapper error**—the real cause is buried in the logs. Users search for:

- "AutomationTool exiting with ExitCode=25"
- "Unknown Cook Failure"
- "Packaging failed"

**Our Solution**: Link `ExitCode=25` to specific root causes: path length limits, asset corruption, naming violations, and shader errors.

### VR/Mobile: The Black Screen Problem

New VR developers frequently encounter:

- "Quest black screen but audio plays"
- "Android launch shows nothing"

**Root Causes**: Mobile HDR, OpenXR misconfiguration, Vulkan driver issues.

### Multiplayer: The "Lag" Misnomer

Users report "lag" when experiencing replication bugs:

- What they see: *Character stuttering*
- What they search: *"fix multiplayer lag"*
- What they need: *Replication settings, Network Prediction*

---

## UE4 to UE5 Terminology Shift

Many developers learned on UE4 and search using outdated terms:

| What They Search | What They Need |
|-----------------|----------------|
| PhysX | Chaos Physics |
| Cascade | Niagara VFX |
| Static Lighting | Lumen |
| LOD Meshes | Nanite |

The `synonym_rings.json` maps legacy terms to current systems automatically.

---

## Skill Level Patterns

### Beginners

- Use natural language and vague descriptions
- Search: *"why is my character stuck"*
- Need: Step-by-step tutorials with context

### Intermediate

- Know feature names, need workflow guidance
- Search: *"blend space vs anim montage"*
- Need: Comparison content and best practices

### Advanced

- Paste exact error text from logs
- Search: *"LNK2019 unresolved external UMyClass"*
- Need: Direct, technical solutions

---

## Design Principles

These principles guide how we structure tags:

1. **Error Indexing**: Every error code is a searchable tag
2. **Synonym Coverage**: Common abbreviations ("BP") resolve to full terms
3. **Version Awareness**: Tags specify which UE versions they apply to
4. **Cause-Effect Mapping**: Symptoms link to root causes through graph edges
