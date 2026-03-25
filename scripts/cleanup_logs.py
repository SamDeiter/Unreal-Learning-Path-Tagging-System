
import os

dashboard_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\components\DemandDashboard\DemandDashboard.jsx"
hook_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\hooks\useDemandIntelligence.js"

def remove_logs(file_path, log_pattern):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    new_lines = [line for line in lines if log_pattern not in line]
    if len(new_lines) < len(lines):
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Removed logs from {os.path.basename(file_path)}")

# Remove diagnostic logs
remove_logs(dashboard_path, 'console.log("[DemandDashboard] Render')
remove_logs(hook_path, 'console.log("[useDemandIntelligence]')
