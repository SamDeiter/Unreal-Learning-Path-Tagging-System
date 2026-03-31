"""Test CMS video subtitle extraction from Epic's Electra player."""
import re
import urllib.request
import json

# Test 1: Check embed API for VTT/MPD references
entry_id = "1_f0az0tm7"
url = f"https://dev.epicgames.com/community/api/cms/videos/{entry_id}/embed.html"
print(f"Testing embed API: {url}")

req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    html = resp.read().decode("utf-8")
    print(f"  HTML length: {len(html)}")
    
    # Look for VTT subtitle URLs
    vtts = re.findall(r'https?://[^\s"\']+\.vtt', html)
    print(f"  VTT URLs found: {len(vtts)}")
    for v in vtts[:5]:
        print(f"    {v}")
    
    # Look for MPD manifest URLs
    mpds = re.findall(r'https?://[^\s"\']+\.mpd', html)
    print(f"  MPD URLs found: {len(mpds)}")
    for m in mpds[:3]:
        print(f"    {m}")
    
    # Look for any qstv references
    qstvs = re.findall(r'https?://[^\s"\']*qstv[^\s"\']*', html)
    print(f"  QSTV URLs found: {len(qstvs)}")
    for q in qstvs[:5]:
        print(f"    {q}")
    
    # Check for config/JSON data
    configs = re.findall(r'config\s*=\s*(\{[^}]+\})', html)
    print(f"  Config objects found: {len(configs)}")
    
    # Show first 500 chars
    print(f"\n  Preview:\n{html[:500]}")
    
except Exception as e:
    print(f"  Error: {e}")

# Test 2: Check post.json API for video metadata
print(f"\n\nTesting post API...")
post_url = "https://dev.epicgames.com/community/api/learning/post.json?hash_id=04"
req2 = urllib.request.Request(post_url, headers={"User-Agent": "Mozilla/5.0"})
try:
    resp2 = urllib.request.urlopen(req2, timeout=10)
    data = json.loads(resp2.read().decode("utf-8"))
    # Look for video-related fields
    print(f"  Keys: {list(data.keys())[:10]}")
    if "blocks" in data:
        for b in data["blocks"]:
            if "video" in str(b.get("type", "")).lower():
                print(f"  Video block: {json.dumps(b, indent=2)[:500]}")
except Exception as e:
    print(f"  Error: {e}")
