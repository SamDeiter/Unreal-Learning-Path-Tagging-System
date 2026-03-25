
import os

hook_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\hooks\useDemandIntelligence.js"

if os.path.exists(hook_path):
    with open(hook_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove !abortRef.current guard from setLoading(false) in finally block
    # 2. Add more robust error logging
    # 3. Ensure report is never null if generate succeeds
    
    # Target: if (!abortRef.current) setLoading(false);
    # Replacement: setLoading(false); // Always clear loading state
    
    new_content = content.replace(
        "if (!abortRef.current) setLoading(false);",
        "setLoading(false);"
    ).replace(
        'if (!abortRef.current) console.log("[useDemandIntelligence] setLoading(false)");',
        'console.log("[useDemandIntelligence] setLoading(false) - abortRef:", abortRef.current);'
    )
    
    # Fix the stats derivation to be more robust
    # Current: const stats = report ? { ... } : null;
    # Let's ensure it doesn't crash if report is unexpectedly structured
    
    with open(hook_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed useDemandIntelligence.js loading logic.")
else:
    print(f"File not found: {hook_path}")
