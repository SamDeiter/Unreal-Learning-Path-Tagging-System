import re
import urllib.request
import urllib.error
from collections import deque
import time

BASE_URL = "https://dev.epicgames.com/documentation/en-us/unreal-engine"
START_SLUGS = [
    "mobile-development-in-unreal-engine",
    "android-quick-start-for-unreal-engine",
    "ios-quick-start-for-unreal-engine",
    "developing-for-meta-quest-in-unreal-engine"
]

def crawl_mobile_docs(max_pages=200):
    docs_prefix = "/documentation/en-us/unreal-engine/"
    skip_patterns = ["/API/", "/BlueprintAPI/", "/PythonAPI/", "/WebAPI/", "/node-reference"]
    
    visited = set()
    to_visit = deque(START_SLUGS)
    discovered_slugs = []

    print(f"Crawling Epic docs starting from mobile roots (max {max_pages})...")

    while to_visit and len(discovered_slugs) < max_pages:
        slug = to_visit.popleft()
        if slug in visited:
            continue
        visited.add(slug)

        url = f"{BASE_URL}/{slug}"
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (UE5 Learning Path Builder)",
                "Accept": "text/html",
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode("utf-8", errors="replace")

            # Extract internal links
            link_pattern = re.compile(
                r'href="' + re.escape(docs_prefix) + r'([^"#?]+)"'
            )
            for match in link_pattern.finditer(html):
                found_slug = match.group(1).rstrip("/")
                if found_slug and found_slug not in visited:
                    if any(skip in found_slug for skip in skip_patterns):
                        continue
                    
                    # Only pursue paths that seem relevant to mobile/VR/XR to keep it fast
                    if any(k in found_slug.lower() for k in ["mobile", "android", "ios", "quest", "xr", "vr", "gearvr", "oculus", "apple"]):
                        to_visit.append(found_slug)

            if slug not in discovered_slugs:
                discovered_slugs.append(slug)

            print(f"[{len(discovered_slugs)}] Found: {url}")
            time.sleep(0.5)  # be polite

        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"  HTTP {e.code}: {url}")
        except Exception as e:
            print(f"  Error: {url} - {e}")

    return discovered_slugs

def main():
    slugs = crawl_mobile_docs()
    
    output_path = 'mobile_docs_urls.txt'
    with open(output_path, 'w', encoding='utf-8') as f:
        for s in slugs:
            if s:
                f.write(f"{BASE_URL}/{s}\\n")
                
    print(f"\\nSaved {len(slugs)} URLs to {output_path}")

if __name__ == "__main__":
    main()
