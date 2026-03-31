"""Test the known video page DB1x with anti-detection."""
import asyncio
from playwright.async_api import async_playwright

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0.0.0 Safari/537.36")

async def test():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 720},
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = await context.new_page()

        # This is the URL from the meta.json (note: tutorial singular)
        url = "https://dev.epicgames.com/community/learning/tutorial/DB1x/unreal-engine-gameplay"
        print(f"Visiting: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)

        # Wait for iframe/video to appear
        try:
            await page.wait_for_selector("iframe, electra-player, block-video", timeout=10000)
            await page.wait_for_timeout(2000)
        except Exception:
            await page.wait_for_timeout(3000)

        count = await page.evaluate("document.querySelectorAll('*').length")
        print(f"DOM elements: {count}")

        iframes = await page.query_selector_all("iframe")
        print(f"iframes: {len(iframes)}")
        for iframe in iframes:
            src = await iframe.get_attribute("src")
            print(f"  src: {src}")

        text = await page.evaluate("document.body.innerText.substring(0, 200)")
        print(f"Body: {text[:150]}")
        print(f"URL after load: {page.url}")

        await browser.close()

asyncio.run(test())
