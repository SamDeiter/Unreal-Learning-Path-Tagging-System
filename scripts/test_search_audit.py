import json
import os
import sys
import urllib.request
import urllib.error
import math

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

MODEL = "gemini-embedding-001"
DIMENSION = 768
TASK_TYPE = "RETRIEVAL_QUERY"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:embedContent"


def get_api_key():
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("ERROR: Set GOOGLE_API_KEY or GEMINI_API_KEY env var.")
        sys.exit(1)
    return key


def embed_query(text, api_key):
    url = f"{API_URL}?key={api_key}"
    payload = {
        "content": {"parts": [{"text": text}]},
        "taskType": TASK_TYPE,
        "outputDimensionality": DIMENSION,
    }
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        return result.get("embedding", {}).get("values", [])

def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0
    return dot / (mag_a * mag_b)

def main():
    queries = ["Nanite", "Lumen", "Tessellation"]
    if len(sys.argv) > 1:
        queries = [sys.argv[1]]
        
    api_key = get_api_key()
    
    print("Loading embeddings...")
    try:
        with open("path-builder/src/data/epic_learning_embeddings.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            chunks = data.get("chunks", {})
            print(f"Loaded {len(chunks)} embedded chunks.\n")
    except Exception as e:
        print(f"Error loading embeddings: {e}")
        return

    for query in queries:
        print(f"--- QUERY: '{query}' ---")
        try:
            q_vec = embed_query(query, api_key)
        except Exception as e:
            print(f"Error embedding query: {e}")
            continue
            
        results = []
        for chunk_id, chunk_data in chunks.items():
            sim = cosine_similarity(q_vec, chunk_data["embedding"])
            results.append((sim, chunk_data))
            
        # Top 5
        results.sort(key=lambda x: x[0], reverse=True)
        top_n = results[:5]
        
        for i, (sim, cinfo) in enumerate(top_n):
            print(f"{i+1}. [Score: {sim:.3f}] {cinfo['title']} - Hash: {cinfo['hash_id']}")
        print("\n")

if __name__ == '__main__':
    main()
