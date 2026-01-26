# Tagging Methodology

> The formula for determining what gets tagged and why.

---

## 1. Tag Discovery Formula

### TF-IDF (Term Frequency-Inverse Document Frequency)

```
TF-IDF(term) = TF(term) × log(N / DF(term))

Where:
- TF  = Frequency of term in document
- N   = Total documents in corpus
- DF  = Documents containing the term
```

| TF-IDF Score | Interpretation | Action |
|--------------|----------------|--------|
| High (>0.5) | Specific, discriminating | ✅ Tag candidate |
| Medium (0.2-0.5) | General category | Consider as parent tag |
| Low (<0.2) | Too common | ❌ Reject |

---

## 2. Tag Thresholds

### Minimum Viability

| Threshold | Value | Rationale |
|-----------|-------|-----------|
| Min frequency | ≥2 sources | Must appear in multiple videos/docs |
| Min content items | ≥3 items | A tag with 1 result isn't useful |
| Max content items | <500 items | Too broad, needs splitting |
| Confidence score | ≥0.7 | Pattern or keyword match quality |

### Tag Limits

| Scope | Limit |
|-------|-------|
| Total canonical tags | 100-150 max |
| Tags per category | 10-15 max |
| Pending candidates | 20 max |
| Synonyms per tag | 5-10 |

---

## 3. Pattern Matching (Highest Priority)

Exact error signatures → Direct tag assignment:

| Pattern | Tag |
|---------|-----|
| `ExitCode=25` | `build.exitcode_25` |
| `0xC0000005` | `crash.access_violation` |
| `0x887A0006` | `crash.d3d_device_lost` |
| `LNK\d{4}` | `scripting.cpp` |
| `Accessed None` | `scripting.blueprint` |

---

## 4. Keyword Matching (High Priority)

UE5 system terms → Canonical tags:

| Keyword | Tag |
|---------|-----|
| nanite | `rendering.nanite` |
| lumen | `rendering.lumen` |
| packaging, cooking | `build.packaging` |
| replication | `multiplayer.replication` |

---

## 5. Granularity Rules

From NISO Z39.19:

> "A tag that returns 10,000 results is useless.  
> A tag that returns 1 result is rarely worth maintaining."

### The Goldilocks Zone

```
Ideal tag: 20-500 content items
```

### When to Split

If a tag has >500 items:

- Split into narrower terms
- Example: `rendering` → `rendering.lumen`, `rendering.nanite`

### When to Merge

If two tags have <5 items each and overlap:

- Merge into one tag with synonyms
- Example: `lag` + `jitter` → `multiplayer.latency`

---

## 6. Governance Cycle

### Monthly Audit (Merge/Purge/Split)

| Action | Trigger |
|--------|---------|
| **Merge** | Similar tags, <5 items each |
| **Purge** | 0 items for 6 months |
| **Split** | >500 items, low precision |

### Approval Workflow

```
Candidate → Review → Approve/Reject → Add to tags.json
```

All tags must go through human approval before becoming canonical.

---

## 7. Synonym Ring Strategy

One canonical tag, multiple search terms:

```json
{
  "tag_id": "scripting.blueprint",
  "synonyms": ["BP", "visual scripting", "node graph"],
  "aliases": [{"type": "legacy", "value": "Kismet"}]
}
```

User searches "BP" → System maps to `scripting.blueprint`

---

## Summary

1. **Discover** via TF-IDF + pattern matching
2. **Filter** by frequency (≥2) and confidence (≥0.7)
3. **Limit** total tags (100-150)
4. **Approve** manually before adding
5. **Audit** monthly (merge/purge/split)

---

## 8. Building Courses from Existing Content

**The Core Use Case**: Tags enable assembling learning paths from existing YouTube videos, docs, and forum posts.

### The Flow

```
User Query → Extract Tags → Find Content → Build Sequence → Learning Path

Example:
"UE5 packaging fails with ExitCode=25"
    ↓
Tags: [build.packaging, build.exitcode_25, build.cooking]
    ↓
Find: 5 videos, 3 docs, 2 forum threads
    ↓
Sequence: Foundations → Diagnostics → Resolution → Prevention
    ↓
Learning Path with 4 steps
```

### Content Matching Formula

```
Match Score = Σ(tag_weight × content_relevance) / total_tags

Where:
- tag_weight = Tag's global_weight from schema
- content_relevance = How well content covers the tag (0-1)
```

### Prerequisite Chains

Tags define what you need to know first:

```json
{
  "tag_id": "build.exitcode_25",
  "prerequisites": ["build.packaging", "build.cooking"],
  "leads_to": ["build.troubleshooting"]
}
```

### Content Assembly Rules

| Step | Content Type | Purpose |
|------|--------------|---------|
| 1. Foundations | Docs, Tutorials | Build base knowledge |
| 2. Diagnostics | Forum, Video | Identify the problem |
| 3. Resolution | Video, Docs | Apply the fix |
| 4. Prevention | Video, Forum | Avoid future issues |

### No New Content Created

We DON'T create content - we **curate** existing content:

- YouTube tutorials (via API)
- Epic documentation
- Forum solutions
- Community guides

Tags are the glue that connects existing content into structured paths.
