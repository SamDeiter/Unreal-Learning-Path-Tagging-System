import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract CSS (between <style> and </style>)
css_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
if css_match:
    css_content = css_match.group(1).strip()
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css_content)
    print(f'Extracted {len(css_content)} chars to styles.css')

# Extract JS (between <script> and </script>, excluding Chart.js CDN)
js_match = re.search(r'<script>\s*(// Refresh Modal Functions.*?)\s*</script>', content, re.DOTALL)
if js_match:
    js_content = js_match.group(1).strip()
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f'Extracted {len(js_content)} chars to app.js')

# Update index.html to use external files
new_content = re.sub(
    r'<style>.*?</style>',
    '<link rel="stylesheet" href="styles.css">',
    content,
    flags=re.DOTALL
)
new_content = re.sub(
    r'<script>\s*// Refresh Modal Functions.*?</script>',
    '<script src="app.js"></script>',
    new_content,
    flags=re.DOTALL
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Updated index.html to use external files')
print(f'New index.html size: {len(new_content)} chars')
