# Learning & Training YouTube Strategy 2026

> **Source**: Internal strategy document for UE5 Learning & Training
> **Purpose**: Define the end-goal vision for the tagging system and learning path builder

---

## Vision Statement

The tagging system exists to **drive new user growth & successful onboarding** by delivering personalized, persona-aware learning paths that match how real creators learn and consume content.

---

## Core Pillars

| Pillar | Description |
|--------|-------------|
| **The Encyclopedia** | Comprehensive documentation of all UE5 topics |
| **The Paths** | Curated learning journeys based on skill gaps |
| **Onboarding & Adoption** | First-time user success optimization |
| **Third Party Content** | Integration with YouTube, GDC Vault, community tutorials |

---

## Primary Persona: "Animator Alex"

### Demographics

- **Age**: ~25 years old (mid-career or student)
- **Company**: Indie Games, 2-10 people
- **Background**: Proficient in Maya/Blender; exploring Unreal Engine

### Mindset

- **Artist-First, Tech-Second**: Interested in how shaders *look*, not the math
- **Creative Problem Solvers**: Want tools that stay out of their way
- **Apprehensive but Curious**: Fear UE is "too programming-like" vs artist-friendly DCCs

### Passions

- 🎭 **The Art of Performance** - timing, weight, emotion
- 🎬 **Cinematography & Storytelling** - camera angles, lighting, narrative feel
- ⚡ **Efficiency & Immediate Feedback** - frustrated with "waiting for the green bar"

### Pain Points

| Pain Point | Description |
|------------|-------------|
| **Uncanny Valley Fears** | Worried real-time won't match offline render quality |
| **Rigging Translation** | Maya rigs breaking when imported to game engines |
| **Black Box Shaders** | Fear of math nodes (Dot Product, Lerp) gate-keeping art |
| **Data Management Anxiety** | Version control, FBX exports, broken file paths |

### Content Preferences

- ✅ Side-by-side comparisons ("Maya Workflow vs Unreal Sequencer")
- ✅ Shot breakdowns (block-out to final polish)
- ✅ Humorous industry relatability (bad rigs, client notes)
- ✅ High-fidelity visuals proving real-time = offline quality

### Media Consumption

- **Inspiration**: ArtStation, Instagram, Pinterest
- **Education**: GDC Vault, Behind-the-Scenes features
- **YouTube**: Sir Wade Neistadt, FlippedNormals
- **Community**: Reddit (r/animation, r/vfx), Discord servers

---

## Integration with Tagging System

### How Tags Enable This Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER ENTERS LEARNING GOAL                    │
│            "Master Lumen Lighting for Cinematics"                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TAG MATCHING ENGINE                         │
│  • Parses goal → [Lumen, Lighting, Cinematics, Sequencer]       │
│  • Identifies persona signals → "Animator Alex"                  │
│  • Matches skill level → Intermediate                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PERSONALIZED PATH OUTPUT                      │
│  • Artist-first content prioritized (less math, more visuals)   │
│  • Comparison content included (UE vs Maya workflows)           │
│  • Pain point addressed: "You won't need to wait for renders"   │
└─────────────────────────────────────────────────────────────────┘
```

### Tag Taxonomy Alignment

| Tag Category | Persona Relevance | Example Tags |
|--------------|-------------------|--------------|
| **Animation** | Core interest | Control Rig, Animation Blueprint, Sequencer |
| **Cinematics** | High passion area | Virtual Camera, Movie Render Queue, Lumen |
| **Materials** | Artist-friendly needed | Material Editor, Subsurface, Skin Shaders |
| **Real-Time VFX** | Efficiency focus | Niagara, GPU Particles, Real-Time Hair |

---

## Implementation Roadmap

### Phase 1: Persona-Aware Recommendations ✅ Partially Complete

- [x] Tag coverage analysis (SkillRadar)
- [x] Industry demand comparison (SkillGapAnalysis)
- [ ] Persona detection from learning goal input
- [ ] Pain point messaging in path recommendations

### Phase 2: Content Gap Analysis

- [ ] Map existing courses to persona pain points
- [ ] Identify missing "comparison" content (UE vs Maya, UE vs Blender)
- [ ] Flag courses that are "too technical" for artist personas
- [ ] Recommend third-party YouTube content to fill gaps

### Phase 3: Personalized Path Generation

- [ ] Generate paths optimized for persona type
- [ ] Include messaging that addresses pain points
- [ ] Output learning objectives aligned with persona goals
- [ ] Track successful onboarding metrics

### Phase 4: Third-Party Integration

- [ ] YouTube API integration for recommended external content
- [ ] GDC Vault talk recommendations
- [ ] Community resource links (ArtStation references, Discord servers)

---

## Success Metrics

| Metric | Target | How We Measure |
|--------|--------|----------------|
| **Path Completion Rate** | 70%+ | Users who finish generated paths |
| **Time to First Project** | < 2 weeks | New users creating real work |
| **Skill Gap Reduction** | -20% avg gap | Coverage vs industry demand |
| **Persona Satisfaction** | 4.5/5 | "This felt made for me" ratings |

---

## Next Steps

1. **Review this document** and confirm alignment with strategy
2. **Prioritize Phase 1 completion** - add persona detection
3. **Content audit** - map courses to persona pain points
4. **Prototype third-party integration** with YouTube API
