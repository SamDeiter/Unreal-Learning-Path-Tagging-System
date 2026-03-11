"""Quick test of the Gemini embedding API key using the google-generativeai SDK."""
import os
import google.generativeai as genai

key = os.environ.get("GOOGLE_API_KEY", "")
print(f"Key: {key[:8]}...{key[-4:]}" if len(key) > 12 else f"Key: '{key}'")

genai.configure(api_key=key)

try:
    result = genai.embed_content(
        model="models/text-embedding-004",
        content="test embedding for UE5 lighting",
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=768,
    )
    dims = len(result.get("embedding", []))
    print(f"SUCCESS with text-embedding-004 - got {dims} dimensions")
except Exception as e:
    print(f"FAILED text-embedding-004: {e}")

# Also try gemini-embedding-001
try:
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content="test embedding for UE5 lighting",
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=768,
    )
    dims = len(result.get("embedding", []))
    print(f"SUCCESS with gemini-embedding-001 - got {dims} dimensions")
except Exception as e:
    print(f"FAILED gemini-embedding-001: {e}")
