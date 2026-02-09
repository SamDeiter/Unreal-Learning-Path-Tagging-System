# RAG Upgrade — Test Plan

## Prerequisites
- Dev server running: cd path-builder && npm run dev
- Browser open to http://localhost:5173
- DevTools console open (F12 > Console tab)

---

## Test 1: Embedding Freshness Check (Terminal)

**Run:** 
pm run check:embeddings

**Expected output:**
- All 3 files show FRESH
- Segment: 2,402 chunks
- Docs: 1,887 chunks  
- Course: shows chunk count

**PASS if:** All 3 say 'FRESH' with green checkmarks

---

## Test 2: Basic RAG Pipeline (Browser)

1. Navigate to **Fix a Problem** tab
2. Type: Lumen reflections flickering in indoor scene
3. Click Submit
4. Watch the console

**Expected console output:**
`
[SegmentSearch] Decoded 2402 segment embeddings
[DocsSearch] Decoded 1887 doc embeddings
[RAG] Retrieved 6 transcript + 3 doc passages
Curated solution match: Lumen...
`

**PASS if:** All 4 lines appear with no errors

---

## Test 3: MicroLesson UI Renders (Browser)

After Test 2 completes, look at the results page.

**Expected UI (in order, top to bottom):**
1. Arrow back + 'Ask Another Question' buttons
2. TLDR diagnosis (purple left border, lightbulb icon)
3. **NEW: AI Micro-Lesson card** (dark card with purple border):
   - Header: purple badge 'AI Micro-Lesson'
   - Lightning bolt Quick Fix section (expanded by default)
   - Brain 'Why This Works' section (collapsed)
   - Chain 'Related Situations' section (collapsed)
   - Doc links at bottom (green chips)
4. Video results grid below

**PASS if:** The MicroLesson card renders with at least the Quick Fix section

**FAIL - Common fixes:**
- If card is missing entirely: check console for diagnosisData.microLesson 
  - It might be at a different path like diagnosisData.diagnosis.microLesson
  - Or the CF might return it as micro_lesson (snake_case)
  - Tell me what you see and I will fix the field mapping
- If card renders but sections are empty: the CF may be returning 
  different field names than expected

---

## Test 4: Accordion Interactions (Browser)

1. Click 'Why This Works' — it should expand with slide animation
2. Click 'Quick Fix' — it should collapse
3. Click 'Related Situations' — it should expand showing scenarios
4. Only one section should be open at a time

**PASS if:** Sections toggle correctly with smooth animation

---

## Test 5: Citations & Doc Links (Browser)

1. In the expanded Quick Fix section, look for 'Sources:' row
   - Should show blue/purple citation chips with video names + timestamps
2. At the bottom of the MicroLesson card, look for 'Related Documentation'
   - Should show green chips linking to Epic docs pages
3. Click a doc link — should open Epic docs in new tab

**PASS if:** At least 1 citation chip and 1 doc link are visible and clickable

---

## Test 6: Varied Queries (Browser - run each one)

Submit each query and note if you get a MicroLesson response:

| # | Query | What to check |
|---|-------|---------------|
| 1 | Nanite mesh not rendering at distance | Quick Fix should mention Nanite settings |
| 2 | Blueprint compilation error after reparenting | Should reference BP compilation |
| 3 | Level streaming causing hitches | Should mention level streaming/loading |
| 4 | How to set up a cinematic camera | Should pull from cinematics courses |
| 5 | Material editor nodes not connecting | Should reference material workflow |
| 6 | Metahuman face animation not working | Should pull from MetaHuman content |
| 7 | Multiplayer replication not syncing variables | Should reference networking |
| 8 | Landscape material layers blending wrong | Should reference landscape tools |
| 9 | Sequencer animation not playing in game | Should reference Sequencer |
| 10 | PCG scatter not filling volume | Should reference PCG/procedural |

For each query note:
- Did the MicroLesson card appear? (Y/N)
- Did it have relevant content? (Y/N)
- Did citations reference real courses? (Y/N)
- Any console errors? (note them)

**PASS if:** 8+ out of 10 produce relevant MicroLesson content

---

## Test 7: Performance Check (Browser)

1. Open DevTools > Performance tab
2. Submit a query
3. Note the total time from click to results displayed

**Expected:** < 8 seconds total (embedding decode + API call + render)

**Breakdown:**
- Embedding decode (first load only): ~1-2s
- Network to Cloud Function: ~3-5s
- Render: < 100ms

**PASS if:** Total time < 10 seconds

---

## Test 8: Mobile Responsiveness (Browser)

1. Open DevTools > Toggle device toolbar (Ctrl+Shift+M)
2. Set to iPhone 14 Pro (390x844)
3. Submit a query
4. Check that MicroLesson card:
   - Does not overflow horizontally
   - Accordion buttons are tappable size
   - Citations wrap properly
   - Doc chips wrap properly

**PASS if:** No horizontal scrollbar, all content readable

---

## Results Summary

Fill this in as you test:

| Test | Status | Notes |
|------|--------|-------|
| 1. Freshness Check | | |
| 2. RAG Pipeline | | |
| 3. MicroLesson UI | | |
| 4. Accordion | | |
| 5. Citations/Docs | | |
| 6. Varied Queries | /10 | |
| 7. Performance | s | |
| 8. Mobile | | |

**Overall: __ / 8 tests passed**

When done, share your results and I will fix any issues found.
