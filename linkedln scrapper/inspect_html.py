import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    project_root = Path(__file__).resolve().parent
    storage_state_path = project_root / "data" / "linkedin_storage_state.json"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        kwargs = {"viewport": {"width": 1440, "height": 1000}}
        if storage_state_path.exists():
            kwargs["storage_state"] = str(storage_state_path)
            
        context = await browser.new_context(**kwargs)
        page = await context.new_page()
        
        await page.goto("https://www.linkedin.com/jobs/search/?keywords=backend%20engineer%20python&f_TPR=r86400")
        await asyncio.sleep(5)
        
        # Check matching elements for selectors
        selectors = [
            "li[data-occludable-job-id]",
            ".jobs-search-results__list-item",
            "div[data-job-id]",
            "li.scaffold-layout__list-item",
            "li[data-job-id]",
            "a[href*='/jobs/view/']"
        ]
        
        print("Selector Match Counts:")
        for s in selectors:
            count = await page.locator(s).count()
            print(f"- '{s}': {count} elements")
            
        # Get some sample HTML of the list items if any
        list_items = await page.locator("li").all()
        print(f"\nTotal list items (li) found: {len(list_items)}")
        
        # Let's print attributes of the first few list items
        for i, item in enumerate(list_items[:15]):
            html_class = await item.get_attribute("class") or ""
            data_id = await item.get_attribute("data-occludable-job-id") or ""
            job_id = await item.get_attribute("data-job-id") or ""
            print(f"  [{i}] class='{html_class}' data-occludable-job-id='{data_id}' data-job-id='{job_id}'")

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
