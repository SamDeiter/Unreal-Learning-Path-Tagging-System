"""
quantize_embeddings.py — Compress embedding vectors from float64 JSON to base64 float16.
Reduces file size by ~4x with negligible impact on cosine similarity.
"""
import json
import struct
import base64
from pathlib import Path

INPUT = Path("path-builder/src/data/segment_embeddings.json")

print(f"Loading {INPUT}...")
data = json.load(open(INPUT))
segs = data["segments"]
print(f"  {len(segs)} segments loaded")

original_size = INPUT.stat().st_size / (1024 * 1024)
print(f"  Original size: {original_size:.1f} MB")

# Quantize: float64 JSON → base64 float16
for sid, seg in segs.items():
    emb = seg["embedding"]
    packed = struct.pack(f"{len(emb)}e", *emb)
    seg["embedding"] = base64.b64encode(packed).decode("ascii")

# Save with compact JSON (no spaces)
with open(INPUT, "w") as f:
    json.dump(data, f, separators=(",", ":"))

new_size = INPUT.stat().st_size / (1024 * 1024)
print(f"  Quantized size: {new_size:.1f} MB")
print(f"  Reduction: {(1 - new_size/original_size)*100:.0f}%")

# Verify round-trip
sample_b64 = list(segs.values())[0]["embedding"]
restored = struct.unpack(f"{768}e", base64.b64decode(sample_b64))
print(f"  Round-trip check: {len(restored)} dims, first 3 values: {restored[:3]}")
print("Done!")
