# Changelog

All notable changes to the Unreal Learning Path Tagging System.

## [1.0.0] - 2027-01-27

### Added

#### Scoring Engine (`ingestion/scored_matcher.py`)

- **Deterministic scoring formula**: `TagScore = Σ(SignalTypeMultiplier × RuleWeight × TagGlobalWeight)`
- **Signal type multipliers**: `exact_signature` (1.0) > `regex` (0.8) > `contains` (0.6) > `synonym` (0.4)
- **Negative pattern blocking**: Rules can define patterns that block a tag from matching
- **Version-aware matching**: Tags can be filtered by UE engine version constraints
- **Full trace output**: Every match produces a traceable JSON showing exactly why each tag matched
- **Deterministic tie-breakers**: Score → Priority → Specificity → Alphabetical

#### Path Composer (`ingestion/path_composer.py`)

- **Atom-based composition**: Learning paths built from atomic steps in `steps/atoms/`
- **Edge expansion**: `symptom_of` and `prerequisite` edges expand tag sets automatically
- **Step ordering**: Foundation → Diagnostic → Remediation → Verification
- **Template fallback**: Falls back to golden templates when atoms don't cover all step types

#### Atomic Steps (`steps/atoms/`)

- New directory for atomic learning steps
- Each atom includes: `why`, `evidence`, `verification`, `tags`, `prerequisites`
- Example atoms for build/packaging workflow

#### Test Suite (`tests/`)

- `test_scored_matcher.py`: Tests for scoring precedence, negative blocking, tie-breakers, version constraints
- `test_path_composer.py`: Tests for edge expansion, atom selection, ordering, determinism
- `conftest.py`: Shared fixtures for sample queries and data loading

#### CI/CD (`.github/workflows/ci.yml`)

- Automated test runs on push/PR to main
- JSON schema validation for all JSON files
- Coverage reporting via Codecov

### Changed

#### `match_rules.json` Schema Updates

- Added `rule_weight` field (0.0-1.0) to each rule
- Added `signal_type` field to each pattern
- Added `negative_patterns` array to rules

### Breaking Changes

> [!CAUTION]
> The following changes may require updates to downstream consumers.

1. **Scores are now numeric**: Tags return `score` as a float (0.0-1.0+) instead of just presence/absence
2. **Match results are objects**: `ScoredTag` objects replace simple tag ID strings
3. **Rule order matters less**: Scoring replaces priority-only ordering

### Migration Guide

If you were using the previous tag matching logic:

```python
# Before (v0.x)
tags = match_query("my error")  # Returns list of tag_id strings

# After (v1.0)
from ingestion.scored_matcher import ScoredMatcher
matcher = ScoredMatcher()
results = matcher.match_query("my error")  # Returns list of ScoredTag objects
tag_ids = [t.tag_id for t in results]      # Extract IDs if needed
```

---

## [0.1.0] - 2027-01-15

### Added

- Initial tag database (`tags/tags.json`)
- Edge relationships (`tags/edges.json`)
- Match rules (`ingestion/match_rules.json`)
- Learning path templates (`learning_paths/templates/`)
- Sample queries (`user_queries/examples/`)
