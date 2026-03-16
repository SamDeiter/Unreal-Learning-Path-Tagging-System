---
description: Checklist for keeping project documentation up to date after significant changes
---

# Documentation Maintenance Workflow

Run this workflow after any significant feature addition, refactor, or architectural change.

## Steps

1. **Review `CHANGES.md`** — Add a dated entry summarizing what changed and why.
2. **Review `ARCHITECTURE.md`** — Update if any new services, components, hooks, or data flows were added.
3. **Review `README.md`** — Update feature list, setup instructions, or screenshots if applicable.
4. **Review `THIRD_PARTY_NOTICES.md`** — Update if new dependencies were added.
5. **Check inline code comments** — Ensure modified files have accurate JSDoc/header comments.
// turbo
6. **Commit documentation updates** — `git add` and `git commit -m "docs: update project documentation"`
// turbo
7. **Push** — `git push origin master`
