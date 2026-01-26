"""Quick test to verify YouTube API key is working"""
import os
import urllib.request
import urllib.parse
import json

# Load API key from .env file
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

load_env()

api_key = os.environ.get('YOUTUBE_API_KEY')

if not api_key or api_key == 'your_api_key_here':
    print("❌ ERROR: No API key found in .env file")
    print("   Please add your key to .env: YOUTUBE_API_KEY=your_key")
    exit(1)

# Test with a simple search for "Unreal Engine"
print("🔍 Testing YouTube Data API v3...")
print(f"   Key prefix: {api_key[:8]}..." if len(api_key) > 8 else "   Key too short")

try:
    params = urllib.parse.urlencode({
        'part': 'snippet',
        'q': 'Unreal Engine 5',
        'maxResults': 1,
        'type': 'video',
        'key': api_key
    })
    url = f"https://www.googleapis.com/youtube/v3/search?{params}"
    
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
        
    if 'items' in data and len(data['items']) > 0:
        video = data['items'][0]
        title = video['snippet']['title']
        print(f"✅ SUCCESS! API key is working.")
        print(f"   Test result: Found video '{title[:50]}...'")
    else:
        print("⚠️ API responded but no results found")
        
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f"❌ API Error {e.code}: {e.reason}")
    if 'API key not valid' in error_body:
        print("   Your API key appears to be invalid")
    elif 'quota' in error_body.lower():
        print("   Quota exceeded - try again tomorrow")
    else:
        print(f"   Details: {error_body[:200]}")
except Exception as e:
    print(f"❌ Error: {e}")
