"""Run RAG eval. Auth via ADC (`gcloud auth application-default login`)."""
import subprocess, os
os.chdir(r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System")

result = subprocess.run(
    ["node", "eval/rag_eval.js", "--retrieval-only", "--k", "10", "--verbose"],
    capture_output=True, text=True
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr)
print("exit:", result.returncode)
