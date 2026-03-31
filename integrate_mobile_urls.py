import json
import urllib.request
import re
from pathlib import Path

def main():
    urls_file = Path("mobile_docs_urls.txt")
    doc_links_file = Path("docs/data/doc_links.json")
    
    if not urls_file.exists():
        print("mobile_docs_urls.txt not found!")
        return

    with open(urls_file, "r", encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip()]

    if doc_links_file.exists():
        with open(doc_links_file, "r", encoding="utf-8") as f:
            doc_links = json.load(f)
    else:
        doc_links = {}

    print(f"Loaded {len(urls)} URLs to integrate.")
    
    added_count = 0
    updated_count = 0

    for url in urls:
        # Extract slug
        slug = url.split("/")[-1]
        
        # Determine a practical key (removing -in-unreal-engine for consistency if desired, or just use slug)
        # Let's use the slug as the key directly, or standard fallback
        key = slug
        if key in doc_links:
            # We already have it, maybe add mobile tag if missing
            if 'mobile' not in [t.lower() for t in doc_links[key].get('tags', [])]:
                doc_links[key]['tags'].append('Mobile')
                updated_count += 1
            continue
            
        print(f"Fetching metadata for new link: {url}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode("utf-8", errors="replace")
                
            title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
            title = title_match.group(1).split(" | ")[0].strip() if title_match else slug.replace('-', ' ').title()
            
            desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
            desc = desc_match.group(1).strip() if desc_match else ""
            
            doc_links[key] = {
                "label": title,
                "url": url,
                "description": desc,
                "tags": ["Mobile"],
                "type": "Documentation",
                "parent": "",
                "version": "5.5",
                "sections": [],
                "keySteps": [],
                "seeAlso": [],
                "readTimeMinutes": 5,
                "sourcePath": "."
            }
            added_count += 1
        except Exception as e:
            print(f"Error fetching {url}: {e}")

    # Save back
    with open(doc_links_file, "w", encoding="utf-8") as f:
        json.dump(doc_links, f, indent=2)

    print(f"Done! Added {added_count} new links, updated {updated_count} existing links.")

if __name__ == "__main__":
    main()
