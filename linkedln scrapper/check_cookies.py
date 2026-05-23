import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    project_root = Path(__file__).resolve().parent
    storage_state_path = project_root / "data" / "linkedin_storage_state.json"
    screenshot_path = project_root / "data" / "linkedin_check.png"
    
    print("Launching Chromium in headless mode to capture screenshot...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # Load the cookies
        kwargs = {"viewport": {"width": 1440, "height": 1000}}
        if storage_state_path.exists():
            kwargs["storage_state"] = str(storage_state_path)
            print("Loaded storage state successfully.")
        else:
            print("Warning: No storage state found!")
            
        context = await browser.new_context(**kwargs)
        page = await context.new_page()
        
        print("Navigating to LinkedIn Search...")
        await page.goto("https://www.linkedin.com/jobs/search/?keywords=backend%20engineer%20python&f_TPR=r86400")
        
        # Wait a moment for dynamic content
        await asyncio.sleep(8)
        
        # Capture screenshot
        screenshot_path.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(screenshot_path))
        print(f"Screenshot successfully captured and saved to: {screenshot_path}")
        
        # Print URL we ended up on
        print(f"Final URL: {page.url}")
        
        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
