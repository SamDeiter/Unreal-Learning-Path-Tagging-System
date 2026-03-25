
import os

plan_path = r"C:\Users\Sam Deiter\.gemini\antigravity\brain\77edf1f8-8d6c-40bd-ba4c-d5dcf139961a\implementation_plan.md"
task_path = r"C:\Users\Sam Deiter\.gemini\antigravity\brain\77edf1f8-8d6c-40bd-ba4c-d5dcf139961a\task.md"

# Update Plan
if os.path.exists(plan_path):
    with open(plan_path, 'r', encoding='utf-8') as f:
        plan = f.read()

    new_work_item = """
---

## Work Item 6: Dashboard Loading Regression Debugging

Investigate why the dashboard remains in "Scanning" state despite successful report generation logs.

### Diagnostics & Fixes

#### [MODIFY] [DemandDashboard.jsx](file:///c:/Users/Sam%20Deiter/Documents/GitHub/Unreal-Learning-Path-Tagging-System/path-builder/src/components/DemandDashboard/DemandDashboard.jsx)
- Add comprehensive `console.log` trace for `report`, `loading`, and `error` transitions.
- Verify `industryFilter` and `subVerticalFilter` initial states.
- Add guard for `filteredSuggestions` being undefined.

#### [MODIFY] [useDemandIntelligence.js](file:///c:/Users/Sam%20Deiter/Documents/GitHub/Unreal-Learning-Path-Tagging-System/path-builder/src/hooks/useDemandIntelligence.js)
- Add `console.trace` on `setLoading` and `setReport` calls.
- Log the `result` immediately before `setReport(result)`.
- Verify `abortRef` logic isn't prematurely blocking state updates on mount.

#### [MODIFY] [demandIntelligenceService.js](file:///c:/Users/Sam%20Deiter/Documents/GitHub/Unreal-Learning-Path-Tagging-System/path-builder/src/services/demandIntelligenceService.js)
- Ensure total error catch-all for `generateDemandReport` to prevent unhandled promise hangs.
"""

    if "Work Item 6: Dashboard Loading Regression Debugging" not in plan:
        plan = plan.strip() + "\n" + new_work_item

    with open(plan_path, 'w', encoding='utf-8') as f:
        f.write(plan)

# Update Task
if os.path.exists(task_path):
    with open(task_path, 'r', encoding='utf-8') as f:
        task = f.readlines()

    # Mark taxonomy as partially complete and add debugging item
    new_task_lines = []
    for line in task:
        if "## 4. Multi-Industry Taxonomy (Phase 3.1)" in line:
            new_task_lines.append(line)
            continue
        if "Expand `industryVerticals` in `demand_benchmarks.json`" in line:
             new_task_lines.append("- [x] Expand `industryVerticals` in `demand_benchmarks.json` (Migrated schema)\n")
             continue
        if "## 6. Final" in line:
            new_task_lines.append("## 6. Dashboard Loading Regression ⚠️\n")
            new_task_lines.append("- [/] Add diagnostic logging to trace loading hang\n")
            new_task_lines.append("- [ ] Verify state transitions in `useDemandIntelligence` hook\n")
            new_task_lines.append("- [ ] Fix UI hang and verify dashboard rendering\n\n")
            new_task_lines.append(line)
            continue
        new_task_lines.append(line)

    with open(task_path, 'w', encoding='utf-8') as f:
        f.writelines(new_task_lines)

print("Artifacts updated successfully with UTF-8 encoding.")
