"""extract_courses.py — Extract missing Epic Learning courses via DOM scraping.

The /post.json API only works for tutorials, talks, and knowledge_base.
Courses (194 missing) need to be scraped from the rendered page.

CRITICAL: Catalog URLs use /course/ (singular) but the correct URL is /courses/ (plural).
The singular URL redirects to the landing page and produces garbage.

CSS Selectors (discovered via browser inspection):
  - Title: h1.content-item-header-title
  - Description: text-expander.content-item-header-description div.text-block
  - Lesson links: a.course-steps-link
  - Content body: .content-item-content section.col-lg-9

Usage:
  python scripts/extract_courses.py [--limit N]
"""
import asyncio
import json
import random
import sys
import time
from pathlib import Path

CATALOG_FILE = Path("content/epic_learning/catalog.json")
OUTPUT_DIR = Path("content/epic_learning/extracted")
JITTER_MIN = 3.0
JITTER_MAX = 5.0

# JavaScript to extract course content from rendered Angular page
JS_EXTRACT = """
() => {
    const result = { title: '', description: '', lessons: [], bodyText: '' };
    
    // Course title
    const titleEl = document.querySelector('h1.content-item-header-title') || document.querySelector('h1');
    result.title = titleEl ? titleEl.textContent.trim() : '';
    
    // Course description
    const descEl = document.querySelector('text-expander.content-item-header-description div.text-block')
        || document.querySelector('.content-item-header-description');
    result.description = descEl ? descEl.textContent.trim() : '';
    
    // Lesson list from sidebar
    const lessonLinks = document.querySelectorAll('a.course-steps-link');
    lessonLinks.forEach(el => {
        const text = el.textContent.trim();
        const href = el.getAttribute('href') || '';
        if (text && text.length < 300) {
            result.lessons.push({ title: text, href: href });
        }
    });
    
    // Main content body (the lesson content area)
    const contentArea = document.querySelector('.content-item-content section.col-lg-9')
        || document.querySelector('.content-item-content')
        || document.querySelector('main');
    
    if (contentArea) {
        const elements = contentArea.querySelectorAll('h1, h2, h3, h4, h5, p, li, pre, blockquote, .text-block');
        const parts = [];
        elements.forEach(el => {
            const tag = el.tagName.toLowerCase();
            const text = el.textContent.trim();
            if (!text || text.length < 3) return;
            // Skip navigation/UI elements
            if (el.closest('nav, header, footer, .sidebar, .course-steps')) return;
            
            if (tag === 'h1') parts.push('\\n# ' + text + '\\n');
            else if (tag === 'h2') parts.push('\\n## ' + text + '\\n');
            else if (tag.startsWith('h')) parts.push('\\n### ' + text + '\\n');
            else if (tag === 'li') parts.push('- ' + text);
            else if (tag === 'pre') parts.push('\\n```\\n' + text + '\\n```\\n');
            else if (tag === 'blockquote') parts.push('> ' + text + '\\n');
            else parts.push(text + '\\n');
        });
        result.bodyText = parts.join('\\n');
    }
    
    return result;
}
"""


async def extract_courses():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: pip install playwright && python -m playwright install chromium")
        sys.exit(1)

    limit = None
    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    with open(CATALOG_FILE, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    
    md_files = set(f.stem for f in OUTPUT_DIR.glob("*.md"))
    pending = [c for c in catalog if c["hash_id"] not in md_files and c.get("content_type") == "course"]
    
    if limit:
        pending = pending[:limit]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f" Epic Learning Course Extractor v2 (fixed URL + selectors)")
    print(f" {len(pending)} missing courses to extract")
    print("=" * 60)

    if not pending:
        print("\n  Nothing to extract!")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        success = 0
        failed = 0

        for i, item in enumerate(pending):
            hash_id = item["hash_id"]
            title = item.get("title", "")[:55]
            url = item.get("url", "")
            md_path = OUTPUT_DIR / f"{hash_id}.md"
            meta_path = OUTPUT_DIR / f"{hash_id}.meta.json"

            if md_path.exists():
                success += 1
                continue

            if not url:
                print(f"  [{i+1}/{len(pending)}] ✗ {title}... — no URL")
                failed += 1
                continue

            # FIX: Replace /course/ (singular) with /courses/ (plural)
            url = url.replace("/learning/course/", "/learning/courses/")

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                # Wait for Angular to render — 8s for first page, 5s for subsequent
                wait_time = 8000 if i == 0 else 5000
                await page.wait_for_timeout(wait_time)

                content = await page.evaluate(JS_EXTRACT)

                page_title = content.get("title", "") or title
                description = content.get("description", "")
                lessons = content.get("lessons", [])
                body = content.get("bodyText", "")

                # Build markdown
                md_parts = [f"# {page_title}\n"]
                if description:
                    md_parts.append(f"*{description}*\n")
                
                if body.strip():
                    md_parts.append(body)
                
                if lessons:
                    md_parts.append(f"\n## Course Lessons ({len(lessons)} total)\n")
                    seen = set()
                    for l in lessons:
                        t = l["title"]
                        if t not in seen:
                            seen.add(t)
                            md_parts.append(f"- {t}")

                markdown = "\n".join(md_parts).strip()

                if len(markdown) < 100:
                    print(f"  [{i+1}/{len(pending)}] ✗ {title}... — too little content ({len(markdown)} chars)")
                    failed += 1
                    continue

                # Save
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(markdown)

                meta = {
                    "hash_id": hash_id,
                    "title": page_title,
                    "description": description,
                    "url": url,
                    "content_type": "course",
                    "lesson_count": len(set(l["title"] for l in lessons)),
                    "word_count": len(markdown.split()),
                    "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "extraction_method": "dom_scrape_v2",
                }
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2, ensure_ascii=False)

                success += 1
                lesson_count = len(set(l["title"] for l in lessons))
                print(f"  [{i+1}/{len(pending)}] ✓ {title}... ({len(markdown)} chars, {lesson_count} lessons)")

            except Exception as e:
                print(f"  [{i+1}/{len(pending)}] ✗ {title}... — {e}")
                failed += 1

            # Checkpoint catalog every 25 items
            if (i + 1) % 25 == 0:
                _update_catalog(catalog, OUTPUT_DIR)
                print(f"  [checkpoint] {success} ok, {failed} failed")

            await asyncio.sleep(random.uniform(JITTER_MIN, JITTER_MAX))

        await browser.close()

    _update_catalog(catalog, OUTPUT_DIR)

    print(f"\n{'=' * 60}")
    print(f"  ✓ Extracted: {success}")
    print(f"  ✗ Failed:    {failed}")
    print(f"  → Output:    {OUTPUT_DIR}")
    print(f"{'=' * 60}")


def _update_catalog(catalog, output_dir):
    """Update catalog statuses based on which MD files exist."""
    md_files = set(f.stem for f in output_dir.glob("*.md"))
    for item in catalog:
        if item["hash_id"] in md_files and item.get("status") != "processed":
            item["status"] = "processed"
    catalog.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    with open(CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    start = time.time()
    asyncio.run(extract_courses())
    print(f"\nTotal time: {time.time() - start:.1f}s")
