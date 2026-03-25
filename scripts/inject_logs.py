
import os

dashboard_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\components\DemandDashboard\DemandDashboard.jsx"
hook_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\hooks\useDemandIntelligence.js"

def inject_logging(file_path, search_marker, log_statement, after=True):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    found = False
    for line in lines:
        new_lines.append(line)
        if search_marker in line and log_statement not in "".join(new_lines[-2:]):
            indent = line[:line.find(search_marker)]
            if after:
                new_lines.append(f"{indent}{log_statement}\n")
            else:
                # Insert before the line
                new_lines.insert(-1, f"{indent}{log_statement}\n")
            found = True
    
    if found:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Injected log into {os.path.basename(file_path)}")
    else:
        print(f"Marker not found in {os.path.basename(file_path)}: {search_marker}")

# Dashboard injection
inject_logging(dashboard_path, "} = useDemandIntelligence();", 'console.log("[DemandDashboard] Render - loading:", loading, "hasReport:", !!report, "error:", error);')

# Hook injections
inject_logging(hook_path, "setLoading(true);", 'console.log("[useDemandIntelligence] setLoading(true)");')
inject_logging(hook_path, "setLoading(false);", 'console.log("[useDemandIntelligence] setLoading(false)");')
inject_logging(hook_path, "setReport(result);", 'console.log("[useDemandIntelligence] setReport calling with:", result?.suggestions?.length, "suggestions");')
