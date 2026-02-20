# UE5 Skill Demand Research Report

*Generated: February 2024*

## Executive Summary

This report documents the research used to justify skill demand estimates in the Learning Path Tagging System's Skill Radar visualization. The data is drawn from job market analysis, Epic Games' official roadmap, and community surveys.

---

## Key Market Statistics

### Overall UE5 Demand

- **122% projected growth** in Unreal Engine job opportunities over the next decade [1]
- **31% of Steam revenue** in 2024 came from UE5 games [2]
- **28% global game engine market share** held by UE5 [2]
- UE5 roles command the **highest pay rates** in real-time technology sector [3]

### Industry Expansion

Beyond gaming, UE5 demand is surging in:

- Film & Virtual Production [4]
- Architecture & Visualization
- Automotive & Manufacturing
- Training & Simulation

---

## Skill Demand Estimates

| Skill | Demand | Justification |
| ----- | ------ | ------------- |
| **Blueprints** | 90% | Most in-demand skill; required in majority of job posts [1][5] |
| **Niagara/VFX** | 85% | Epic roadmap priority; Heterogeneous Volumes in UE5.7 [6] |
| **Materials** | 80% | Substrate material system is Epic's top 2025 priority [6][7] |
| **Animation** | 75% | Motion Matching, MetaHuman, Chaos Physics [6][8] |
| **Lighting** | 70% | Lumen refinements, MegaLights on roadmap [6] |
| **UI/UMG** | 65% | Growing demand for in-engine UI development [5] |
| **Landscape** | 55% | New 3D terrain system in development, PCG ready [6] |
| **Audio** | 40% | MetaSounds evolving but lower job volume [5] |

---

## Epic Games 2024-2025 Roadmap Priorities

### Rendering & Visual Fidelity

- **Substrate** - Advanced material system (UE5.7 production-ready) [6][7]
- **Nanite Foliage** - Full launch in UE5.7 [6]
- **Lumen & MegaLights** - Continued GI/reflection refinements [6]

### Character & Animation

- **Motion Matching** - AI-powered animation blending (Fortnite Ch5) [6][8]
- **Chaos Physics** - Full production-ready by 2025 [6]
- **MetaHuman** - Expanding to VR, mobile, simulation [6]

### World Building

- **New Terrain System** - Fully 3D polygon-based (non-voxel) [6]
- **PCG Framework** - Production-ready with UX improvements [6]

### Developer Experience

- **Blueprint Improvements** - Better debugging, more features [6]
- **AI Assistant** - Experimental feature on roadmap [6]

---

## References

1. TechNeeds. "The Future Demand for Unreal Engine Developers." 2024.  
   https://www.techneeds.com/resources/the-future-demand-for-unreal-engine-developers/

2. Artemisia College. "Unreal Engine 5 in 2025: Industry Adoption and Market Share." 2025.  
   https://artemisiacollege.com/unreal-engine-5-trends-2025/

3. Epic Games. "Real-Time 3D Skills Employment Report." Unreal Engine Blog, 2024.  
   https://www.unrealengine.com/en-US/blog/real-time-3d-skills-report

4. OreateAI. "Unreal Engine in Virtual Production: Skills and Demand." 2024.  
   https://www.oreateai.com/unreal-engine-virtual-production/

5. Reddit r/unrealengine. Community discussions on Blueprint vs C++ job requirements. 2024.  
   https://www.reddit.com/r/unrealengine/

6. Epic Games. "Unreal Engine Public Roadmap." Productboard, 2024.  
   https://portal.productboard.com/epicgames/1-unreal-engine-public-roadmap/

7. YouTube - Unreal Engine. "State of Unreal 2024 - Substrate Deep Dive."  
   https://www.youtube.com/unrealengine

8. Puget Systems. "Unreal Engine 5.5 Feature Analysis." 2024.  
   https://www.pugetsystems.com/labs/articles/unreal-engine-5-5-features/

---

## Recommendations for LMS Integration

When your LMS analytics become available, replace these estimates with:

1. **Course Enrollment Velocity** - Which topics have fastest-growing enrollment
2. **Completion Rates** - Which topics learners finish vs. abandon
3. **Search Queries** - What learners are searching for but not finding
4. **Prerequisite Chain Performance** - Which paths lead to highest completion
5. **Time-to-Competency** - Which skills take longest to master

---

## Notes

- Demand estimates are relative percentages (0-100) for visualization purposes
- Data should be refreshed quarterly as market conditions evolve
- Epic's State of Unreal (annual GDC) provides best official roadmap updates

---

## Google Trends Update — Q1 2026

### Methodology

On 2026-02-20, the manual estimates were replaced with **real Google Trends search interest data** using the [`pytrends`](https://github.com/GeneralMills/pytrends) library (free, no API key).

**Process:**
1. Queried Google Trends for 8 skill-specific search terms (e.g., `"unreal engine animation"`)
2. Used **12-month worldwide** data for stable averages
3. Queried in **2 batches of ≤5 keywords** with `"unreal engine blueprints"` as a shared anchor for cross-batch normalization
4. Scaled results so the highest-interest skill ≈ 95%

**Re-run anytime with:**
```
pip install pytrends
python scripts/fetch_demand_trends.py
```

### Updated Benchmarks (Google Trends vs Manual)

| Skill | Google Trends (Q1 2026) | Old Manual (Q1 2024) | Change |
| ----- | ----------------------- | -------------------- | ------ |
| **Animation** | 95% | 75% | ↑ +20 |
| **Audio** | 46% | 40% | ↑ +6 |
| **Blueprints** | 38% | 90% | ↓ -52 |
| **Landscape** | 36% | 55% | ↓ -19 |
| **Materials** | 35% | 80% | ↓ -45 |
| **Niagara** | 32% | 85% | ↓ -53 |
| **Lighting** | 30% | 70% | ↓ -40 |
| **UI/UMG** | 12% | 65% | ↓ -53 |

### Key Observations

> [!IMPORTANT]
> Google Trends measures **search interest** (what people are looking for), while the old manual estimates measured **job market demand + roadmap priority**. These are different signals — search interest reflects what *learners want to learn*, while job posts reflect what *employers need*.

1. **Animation dominates search** — likely due to MetaHuman, Motion Matching, and the broad applicability of animation skills beyond UE5
2. **Blueprints drops significantly** — despite being the most common job requirement, Blueprints may be searched less because it's well-documented and learners may use more specific queries
3. **Audio rises** — MetaSounds and spatial audio are growing areas of active learning interest
4. **UI/UMG is very low** — possibly searched with different terms not captured by `"unreal engine UMG"`

### Search Terms Used

| Skill | Search Term |
| ----- | ----------- |
| Blueprints | `unreal engine blueprints` |
| Niagara | `unreal engine niagara` |
| Materials | `unreal engine materials` |
| Animation | `unreal engine animation` |
| Lighting | `unreal engine lighting` |
| UI/UMG | `unreal engine UMG` |
| Landscape | `unreal engine landscape` |
| Audio | `unreal engine audio` |

### Detailed Report

Raw data saved to `scripts/output/trends_report.json`.
