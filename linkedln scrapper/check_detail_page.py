import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    project_root = Path(__file__).resolve().parent
    storage_state_path = project_root / "data" / "linkedin_storage_state.json"
    screenshot_path = project_root / "data" / "linkedin_detail_check.png"
    
    # Let's test one of the direct job URLs that timed out
    test_url = "https://www.linkedin.com/jobs/view/4417456535/"
    
    print(f"Launching Chromium in headless mode to inspect: {test_url} ...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        kwargs = {"viewport": {"width": 1440, "height": 1000}}
        if storage_state_path.exists():
            kwargs["storage_state"] = str(storage_state_path)
            
        context = await browser.new_context(**kwargs)
        page = await context.new_page()
        
        await page.goto(test_url)
        print("Page loaded, waiting 10 seconds...")
        await asyncio.sleep(10)
        
        # Save screenshot
        await page.screenshot(path=str(screenshot_path))
        print(f"Detail page screenshot saved to: {screenshot_path}")
        print(f"Final URL ended on: {page.url}")
        
        # Find potential selectors
        selectors = [
            ".jobs-description-content__text",
            "#job-details",
            ".jobs-description__container",
            ".show-more-less-html__markup",
            "div.jobs-box__html-content",
            "[data-testid='expandable-text-box']",
            "article",
            "main"
        ]
        
        print("\nDetail Page Selector Matches:")
        for s in selectors:
            count = await page.locator(s).count()
            print(f"- '{s}': {count} elements")
            
        # Now let's test the actual parser on the page HTML
        from linkedln_scrapper.scraping.linkedin.selectors import SelectorRegistry
        from linkedln_scrapper.scraping.linkedin.parser import LinkedInParser
        
        selectors_registry = SelectorRegistry.from_yaml(project_root / "config" / "selectors" / "linkedin_jobs.yaml")
        parser = LinkedInParser(selectors_registry)
        
        html = await page.content()
        parsed_job = parser.parse_detail_html(html, test_url)
        
        print("\n=== Parser Results ===")
        print(f"URL: {parsed_job.job_url}")
        print(f"Title: {parsed_job.title}")
        print(f"Company: {parsed_job.company}")
        print(f"Location: {parsed_job.location}")
        print(f"Description (first 150 chars): {parsed_job.description[:150] if parsed_job.description else 'None'}")
        
        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
