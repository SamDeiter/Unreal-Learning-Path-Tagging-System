# Tag Governance Rules

> Prevent schema rot, duplication, and maintain tag quality over time.

---

## 1. Canonical Tag Principles

### One Tag, One Concept

- Each concept has exactly ONE canonical tag
- All variants go in `synonyms` and `aliases`
- Never create `blueprint` AND `blueprints` as separate tags

### Naming Convention

- **Format**: `domain.subdomain.specific` (lowercase, dot-separated)
- **Examples**: `build.exitcode_25`, `rendering.lumen`, `crash.d3d_device_lost`
- **Forbidden**: spaces, capitals, special chars except underscore and dot

### Tag Types (v0.1 - Strict Enum)

Only these types are allowed:

- `system` - Engine systems (Lumen, Nanite, Niagara)
- `workflow` - User workflows (Packaging, Retargeting)
- `symptom` - Observable problems (Black Screen, Noise)
- `error_code` - Specific errors (ExitCode=25, 0xC0000005)
- `tool` - Tools (UBT, UAT, Visual Studio)
- `platform` - Platforms (Android, iOS, Quest)
- `concept` - Abstract concepts (Replication, GC)
- `ui_surface` - UI locations (Project Settings, Post Process Volume)

---

## 2. Synonym Ring Rules

### Required Synonyms

Every tag MUST include:

- Plural/singular variants
- Common abbreviations
- Typos if frequently searched

### Legacy Terms

When UE versions change terminology:

1. Keep the OLD term in `aliases` with `type: "legacy"`
2. Example: PhysX → Chaos, Matinee → Sequencer

---

## 3. Deprecation Process

### When to Deprecate

- Concept removed from engine
- Tag was duplicate (merge into canonical)
- Terminology officially changed

### How to Deprecate

1. Set `governance.status = "deprecated"`
2. Add `replaces` edge in `edges.json` pointing to replacement
3. Never delete - keep for historical matching

---

## 4. Error Code Standards

### Exact Syntax Preservation

Error signatures MUST match user copy/paste exactly:

- ✅ `ExitCode=25` (as it appears in logs)
- ✅ `0xC0000005` (hex format preserved)
- ✅ `DXGI_ERROR_DEVICE_REMOVED` (full constant name)

### Multiple Formats

Include all common formats in `signals.error_signatures`:

```json
"error_signatures": ["ExitCode=25", "exit code 25", "Error: 25"]
```

---

## 5. Engine Version Tracking

### Version Constraints

- Use `constraints.engine_versions.min` for features introduced in specific version
- Use `constraints.engine_versions.max` for deprecated features
- Omit `max` if still current

### Version Drift

When features change between versions:

1. Update tag description
2. Adjust `relevance.freshness_bias_days`
3. Add version-specific notes if needed

---

## 6. Review Process

### Adding New Tags

1. Check if concept already exists (search synonyms!)
2. Verify tag_type is appropriate
3. Add at least 3 synonyms
4. Link related_tags
5. Set initial relevance scores conservatively

### Modifying Tags

1. Update `governance.updated_utc`
2. Document reason in commit message
3. Check for broken edges in `edges.json`

### Automated Checks (via GitHub Actions)

- No duplicate tag_ids
- All related_tags reference valid tag_ids
- All edges reference valid tag_ids
- Schema validation passes

---

## 7. Quality Metrics

### Relevance Score Guidelines

| Score | Meaning |
|-------|---------|
| 0.9-1.0 | Core UE5 feature, very common |
| 0.7-0.9 | Frequently used feature |
| 0.5-0.7 | Moderate usage |
| 0.3-0.5 | Niche or advanced |
| 0.0-0.3 | Rare or deprecated |

### Freshness Bias

- `30 days` - Errors and crashes (change often)
- `90 days` - Active features (Lumen, Nanite)
- `180 days` - Stable features (Blueprints, Materials)
- `365 days` - Foundational concepts

---

## 8. Forbidden Actions

❌ Never hardcode API keys in tag files  
❌ Never create overlapping synonyms across different tags  
❌ Never delete tags - only deprecate  
❌ Never use `status: experimental` in production paths  
❌ Never merge tags without updating all edges  

---

*Last Updated: 2026-01-26*
