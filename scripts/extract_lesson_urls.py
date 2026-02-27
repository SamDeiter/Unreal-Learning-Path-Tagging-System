"""extract_lesson_urls.py — Discover all lesson URLs from course pages.

Visits each course page and extracts the lesson links (hash IDs + titles).
These are needed to later visit each lesson page and capture its CMS video.

Usage:
    python scripts/extract_lesson_urls.py              # All courses
    python scripts/extract_lesson_urls.py --limit 5    # Test with 5

Output: content/epic_learning/lesson_urls.json
"""

import asyncio
import json
import sys
import time
from pathlib import Path

CATALOG_FILE = Path("content/epic_learning/catalog.json")
OUTPUT_PATH = Path("content/epic_learning/lesson_urls.json")
EXTRACTED_DIR = Path("content/epic_learning/extracted")

# JavaScript to extract lesson links from course page
JS_EXTRACT_LESSONS = """
() => {
    const lessons = [];
    
    // Lesson links are in the sidebar or lesson list
    // Pattern: /learning/courses/{courseHash}/{slug}/{lessonHash}/{lessonSlug}
    const links = document.querySelectorAll('a[href*="/learning/courses/"]');
    
    for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent.trim();
        
        // Parse: /learning/courses/XXXXX/slug/YYYYY/lesson-slug
        // The lesson hash is the 2nd path segment after the course hash
        const match = href.match(/\\/learning\\/courses\\/([^/]+)\\/[^/]+\\/([^/]+)\\/([^/]+)/);
        if (match) {
            lessons.push({
                courseHash: match[1],
                lessonHash: match[2],
                lessonSlug: match[3],
                title: text,
                href: href,
            });
        }
    }
    
    // Deduplicate by lessonHash
    const seen = new Set();
    const unique = [];
    for (const l of lessons) {
        if (!seen.has(l.lessonHash)) {
            seen.add(l.lessonHash);
            unique.push(l);
        }
    }
    
    return unique;
}
"""


async def main():
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

    # Only process courses
    courses = [c for c in catalog if c.get("content_type") == "course"]
    
    # Load existing results (resume support)
    existing = {}
    if OUTPUT_PATH.exists():
        existing = json.load(open(OUTPUT_PATH, "r", encoding="utf-8"))
    
    # Only process courses not yet scraped
    pending = [c for c in courses if c["hash_id"] not in existing]
    
    if limit:
        pending = pending[:limit]

    print("=" * 60)
    print(f" Lesson URL Discovery")
    print(f" {len(courses)} total courses, {len(existing)} already scraped, {len(pending)} pending")
    print("=" * 60)

    if not pending:
        print("\n  All courses already scraped!")
        # Print stats
        total_lessons = sum(len(v) for v in existing.values())
        print(f"  Total lessons: {total_lessons}")
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
        total_lessons = sum(len(v) for v in existing.values())

        for i, item in enumerate(pending):
            hash_id = item["hash_id"]
            title = item.get("title", "")[:55]
            url = item.get("url", "")

            if not url:
                print(f"  [{i+1}/{len(pending)}] ✗ {title}... — no URL")
                failed += 1
                continue

            # Fix singular /course/ → /courses/
            url = url.replace("/learning/course/", "/learning/courses/")

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                wait_time = 8000 if i == 0 else 5000
                await page.wait_for_timeout(wait_time)

                lessons = await page.evaluate(JS_EXTRACT_LESSONS)

                if lessons:
                    existing[hash_id] = lessons
                    total_lessons += len(lessons)
                    success += 1
                    print(f"  [{i+1}/{len(pending)}] ✓ {len(lessons)} lessons  {title}")
                else:
                    # Some courses may not have lesson links visible
                    existing[hash_id] = []
                    success += 1
                    print(f"  [{i+1}/{len(pending)}] ○ 0 lessons   {title}")

            except Exception as e:
                print(f"  [{i+1}/{len(pending)}] ✗ {title}... — {e}")
                failed += 1

            # Checkpoint every 25 courses
            if (i + 1) % 25 == 0:
                with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
                    json.dump(existing, f, indent=2, ensure_ascii=False)
                print(f"  [checkpoint] {success} ok, {failed} failed, {total_lessons} total lessons")

            # Polite delay
            await asyncio.sleep(2)

        await browser.close()

    # Final save
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f" Done! {success} courses scraped, {failed} failed")
    print(f" Total lessons discovered: {total_lessons}")
    print(f" Output: {OUTPUT_PATH}")


if __name__ == "__main__":
    start = time.time()
    asyncio.run(main())
    print(f"\nTotal time: {time.time() - start:.1f}s")
