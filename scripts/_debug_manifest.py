"""Debug: visit one article page, log ALL CDN manifest URLs to see format."""
import asyncio
import base64
import json
import re
from playwright.async_api import async_playwright

URL = "https://dev.epicgames.com/community/learning/talks-and-demos/5J9b/unreal-engine-accelerating-your-in-editor-workflows-with-editor-utilities-gdc-2024"
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False,
            args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 720})
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = await context.new_page()

        manifests = []
        all_qstv = []

        async def on_response(response):
            url = response.url
            try:
                if "qstv" in url or "kaltura" in url:
                    all_qstv.append({"url": url[:200], "status": response.status,
                                    "ct": response.headers.get("content-type", "")})
                if "cdn.qstv.on.epicgames.com" in url and response.status == 200:
                    ct = response.headers.get("content-type", "")
                    if "json" in ct:
                        body = await response.text()
                        data = json.loads(body)
                        playlist_b64 = data.get("playlist", "")
                        playlist_type = data.get("playlistType", "")
                        manifests.append({
                            "url": url[:200],
                            "has_playlist": bool(playlist_b64),
                            "playlist_type": playlist_type,
                            "keys": list(data.keys())[:10],
                        })
            except Exception as e:
                pass

        page.on("response", on_response)

        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)

        # Find iframes
        iframes = await page.query_selector_all("iframe")
        print(f"\nAll iframes ({len(iframes)}):")
        for iframe in iframes:
            src = await iframe.get_attribute("src") or ""
            print(f"  {src[:120]}")

        # Scroll to video iframe
        cms_iframes = await page.query_selector_all("iframe[src*='/cms/videos/']")
        print(f"\nCMS video iframes: {len(cms_iframes)}")
        for iframe in cms_iframes:
            src = await iframe.get_attribute("src") or ""
            print(f"  {src}")
            await iframe.scroll_into_view_if_needed()
            await page.wait_for_timeout(5000)

            # Try clicking play inside iframe
            try:
                frame = await iframe.content_frame()
                if frame:
                    play_btn = await frame.query_selector(".vjs-big-play-button")
                    if play_btn:
                        print("  Clicking play button...")
                        await play_btn.click()
                        await page.wait_for_timeout(5000)
            except Exception as e:
                print(f"  Play click error: {e}")

        print(f"\nQSTV/Kaltura requests ({len(all_qstv)}):")
        for r in all_qstv:
            print(f"  [{r['status']}] {r['ct'][:30]}  {r['url']}")

        print(f"\nManifests captured ({len(manifests)}):")
        for m in manifests:
            print(f"  URL: {m['url']}")
            print(f"  Type: {m['playlist_type']}, HasPlaylist: {m['has_playlist']}")
            print(f"  Keys: {m['keys']}")

        page.remove_listener("response", on_response)
        await page.close()
        await context.close()
        await browser.close()

asyncio.run(main())
