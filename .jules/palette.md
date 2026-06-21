## 2025-05-15 - [Nested Button Accessibility Pattern]
**Learning:** To avoid nested button violations (illegal HTML) when adding internal actions (like a delete button) to an interactive card, refactor the card to a `div` with `role="button"` and `tabIndex={0}` while implementing manual keyboard handlers (`Enter`/`Space`).
**Action:** Use the `div role="button"` pattern for interactive cards that require internal sub-actions.

## 2025-05-15 - [Lockfile Bloat Mitigation]
**Learning:** Running `pnpm install` in a sandbox can trigger massive lockfile churn and unrelated dependency upgrades.
**Action:** Always use `restore_file` on `path-builder/pnpm-lock.yaml` after installing necessary testing dependencies to keep PRs focused and under the 50-line limit.
