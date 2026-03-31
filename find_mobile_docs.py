import json
import os

def find_mobile_docs():
    file_path = r'c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\docs\data\doc_links.json'
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    keywords = ['mobile', 'android', 'ios', 'xr', 'vr', 'ar', 'quest', 'handheld']
    results = []

    for key, info in data.items():
        label = info.get('label', '').lower()
        description = info.get('description', '').lower()
        tags = [t.lower() for t in info.get('tags', [])]
        
        matches = any(k in label or k in description or k in tags for k in keywords)
        
        if matches:
            results.append({
                'label': info.get('label'),
                'url': info.get('url'),
                'description': info.get('description'),
                'key': key
            })

    # Sort results by label
    results.sort(key=lambda x: x['label'] or '')

    with open('mobile_docs_list.md', 'w', encoding='utf-8') as out_f:
        out_f.write('# Unreal Engine 5 Mobile Documentation\n\n')
        for res in results:
            out_f.write(f"- **[{res['label']}]({res['url']})** - {res['description']}\n")

if __name__ == "__main__":
    find_mobile_docs()
