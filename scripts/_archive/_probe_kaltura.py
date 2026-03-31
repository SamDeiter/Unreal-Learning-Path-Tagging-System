"""Save the full CDN manifest JSON for offline inspection."""
import asyncio
import json
from pathlib import Path

priority = json.load(open("content/epic_learning/whisper_priority.json"))
first = priority["videos"][0]
article_url = first["article_url"]
print(f"Testing: {first['article_title'][:60]}")
print(f"URL: {article_url}")

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")


async def probe():
    from playwright.async_api import async_playwright
    saved = {}
    
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False,
            args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 720})
        await ctx.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = await ctx.new_page()
        
        async def on_resp(response):
            url = response.url
            try:
                ct = response.headers.get("content-type", "")
                if "cdn.qstv" in url and response.status == 200:
                    body = await response.text()
                    saved["cdn_manifest"] = {"url": url, "ct": ct, "body": body}
                if "qstv" in url and (".mpd" in url or "dash" in ct.lower()):
                    body = await response.text()
                    saved["mpd"] = {"url": url, "ct": ct, "body": body}
            except:
                pass
        
        page.on("response", on_resp)
        await page.goto(article_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(12000)
        page.remove_listener("response", on_resp)
        await page.close()
        await ctx.close()
        await browser.close()
    
    out = Path("logs/cdn_manifest.json")
    out.parent.mkdir(exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(saved, f, indent=2, ensure_ascii=False)
    print(f"\nSaved manifest inspection to: {out}")
    
    if "cdn_manifest" in saved:
        body = saved["cdn_manifest"]["body"]
        print(f"\nCDN manifest length: {len(body)}")
        # Check if it's JSON or XML
        if body.strip().startswith("{"):
            data = json.loads(body)
            print(f"Type: JSON, keys: {list(data.keys())}")
            # Look for nested MPD or URL
            for k, v in data.items():
                if isinstance(v, str) and len(v) > 100:
                    print(f"  {k}: ({len(v)} chars) {v[:200]}")
                elif isinstance(v, str):
                    print(f"  {k}: {v}")
                elif isinstance(v, dict):
                    print(f"  {k}: dict with keys {list(v.keys())}")
                elif isinstance(v, list):
                    print(f"  {k}: list with {len(v)} items")
                else:
                    print(f"  {k}: {v}")
        elif "<MPD" in body or "<mpd" in body.lower():
            print(f"Type: MPD XML")
            print(body[:1000])

asyncio.run(probe())
