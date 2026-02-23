---
description: Checklist for keeping project documentation up to date after significant changes
---

# Documentation Maintenance Checklist

Run through this checklist after any significant feature, refactor, or dependency change.

## 1. CHANGES.md

- Add a new entry under the current version section
- Follow [Keep a Changelog](https://keepachangelog.com/) format: Added / Changed / Fixed / Removed
- If this is a new version bump, create a new `## [x.y.z] - YYYY-MM-DD` heading
- Include the commit hash or PR number for traceability

## 2. README.md

- Update the **Tech Stack** table if new dependencies or services were added
- Update the **Project Structure** tree if new directories or key files were created
- Update the **Application Tabs** table if a new tab was added
- Update the **Enrichment Pipeline** table if a new script was added
- Verify the **Quick Start** instructions still work

## 3. THIRD_PARTY_NOTICES.md

- Regenerate after any `npm install` of new packages:

// turbo
```bash
cd path-builder && python scripts/gen_licenses.py
```

- Verify no new `UNLICENSED` entries appear (other than `path-builder` itself)
- Check for any copyleft licenses (GPL) that may have implications

## 4. Commit the Docs

// turbo
```bash
git add README.md CHANGES.md THIRD_PARTY_NOTICES.md && git commit -m "docs: update project documentation"
```
