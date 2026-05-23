import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    project_root = Path(__file__).resolve().parent
    storage_state_path = project_root / "data" / "linkedin_storage_state.json"
    
    test_url = "https://www.linkedin.com/jobs/view/4417456535/"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        kwargs = {"viewport": {"width": 1440, "height": 1000}}
        if storage_state_path.exists():
            kwargs["storage_state"] = str(storage_state_path)
            
        context = await browser.new_context(**kwargs)
        page = await context.new_page()
        
        await page.goto(test_url)
        await asyncio.sleep(8)
        
        # Let's inspect if there are any JSON-LD script tags on the page
        json_ld_info = await page.evaluate(
            """() => {
                let scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                return scripts.map(s => {
                    try {
                        return JSON.parse(s.textContent.trim());
                    } catch (e) {
                        return { error: e.message, raw: s.textContent.substring(0, 200) };
                    }
                });
            }"""
        )
        print("=== JSON-LD Schema Info ===")
        import json
        print(json.dumps(json_ld_info, indent=2))

        # Let's locate the element containing location
        location_info = await page.evaluate(
            """() => {
                let els = Array.from(document.querySelectorAll('*'));
                // Location text on page is usually 'India' or similar
                let locEl = els.find(el => el.children.length === 0 && el.textContent.trim().startsWith('India'));
                if (!locEl) {
                    locEl = els.find(el => el.textContent.trim().includes('India') && (el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'LI'));
                }
                return locEl ? {
                    tagName: locEl.tagName,
                    className: locEl.className,
                    id: locEl.id,
                    outerHTML: locEl.outerHTML,
                    parentTagName: locEl.parentElement ? locEl.parentElement.tagName : null,
                    parentClassName: locEl.parentElement ? locEl.parentElement.className : null
                } : null;
            }"""
        )
        print("\n=== Location Element Info ===")
        print(location_info)

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
