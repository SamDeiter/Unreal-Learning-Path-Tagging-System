# v8.0 Roadmap — Data-Driven Demand Intelligence

> Based on the [UE5 Tutorial Demand Research Plan](research/UE5%20Tutorial%20Demand%20Research%20Plan.txt)

---

## Phase 1: Enhanced Data Sources

### 1.1 YouTube Data API Integration
- Scrape top 500-1000 UE5 tutorial videos via `videos.list` and `search.list`
- Collect: view count, engagement ratio (likes+comments/views), duration, publish date
- Detect "Breakout" outlier videos (10x channel average) — signals unmet demand
- Store metrics to Firestore `demand_intel/youtube_metrics`

### 1.2 Google Trends Integration
- Use `pytrends` or Google Trends API (alpha) for relative search interest
- Track "Interest Over Time" for key UE5 categories (PCG, Lumen, Nanite, etc.)
- Identify seasonal spikes and "Breakout" topics
- Feed into the Demand Index scoring formula

### 1.3 Reddit Deep Sentiment (PRAW)
- Replace or augment current public JSON API with authenticated PRAW
- Deeper comment sentiment analysis beyond upvote counts
- Topic modeling on "Tutorial Request" threads
- Pain point extraction with confidence scoring

---

## Phase 2: Advanced Scoring & Decay Detection

### 2.1 Demand Index Formula
Implement the multi-signal scoring from the research plan:

```
D_i = α × (V_i / max(V)) + β × (S_i / max(S)) + γ × (E_i / max(E))
```

- V = YouTube view count, S = Search volume, E = Engagement ratio
- α, β, γ weights configurable per analysis goal
- Visualize as a sortable dashboard column

### 2.2 Information Decay Detector
- Cross-reference tutorial publish dates with UE5 version releases
- Flag tutorials outdated by breaking changes (Enhanced Input, World Partition, MegaLights)
- Surface "decay risk" score on each suggestion card
- Priority signal: high search volume + outdated top results = massive opportunity

---

## Phase 3: Industry Vertical Expansion

### 3.1 Multi-Industry Taxonomy
Extend the current 17-category taxonomy with industry verticals:
- **Gaming**: Indie, AA, AAA, Mobile, Console
- **AEC/ArchViz**: Architecture, Interior Design, Urban Planning
- **Virtual Production**: ICVFX, LED volumes, MetaHuman Animator
- **Enterprise**: Automotive, Product Design, Healthcare Simulation

### 3.2 Industry-Specific Content Gap Analysis
- Show demand gaps per industry (e.g., "UE5 ArchViz Optimization for VR")
- Industry filter on the Demand Dashboard
- Tag suggestions with target industry audiences

---

## Phase 4: SEO Intelligence (Optional)

### 4.1 Keyword Gap Analysis
- Integrate SEMrush or Ahrefs API (requires subscription)
- Monthly search volume (MSV) and keyword difficulty (KD) scores
- Identify "blue ocean" keywords: high demand, low competition
- Alternative: manual CSV import from free tools (Google Keyword Planner)

---

## Implementation Priority

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| 1.1 YouTube API | Medium | High | 🔴 P1 |
| 1.2 Google Trends | Low | Medium | 🟡 P2 |
| 1.3 Reddit PRAW | Medium | Medium | 🟡 P2 |
| 2.1 Demand Index | Low | High | 🔴 P1 |
| 2.2 Decay Detector | Medium | High | 🔴 P1 |
| 3.1 Industry Taxonomy | Low | Medium | 🟡 P2 |
| 3.2 Industry Gaps | Medium | Medium | 🟢 P3 |
| 4.1 SEO Intelligence | High | Medium | 🟢 P3 |
