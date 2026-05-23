import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    project_root = Path(__file__).resolve().parent
    user_data_dir = project_root / "data" / "playwright-linkedin-profile"
    storage_state_path = project_root / "data" / "linkedin_storage_state.json"
    
    user_data_dir.mkdir(parents=True, exist_ok=True)
    
    print("Launching Chromium in headed mode...")
    print(f"Session data will be saved to: {user_data_dir}")
    print(f"Storage state will be saved to: {storage_state_path}")
    
    async with async_playwright() as p:
        # Launch persistent context so it saves cookies, local storage, etc.
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=False,
            viewport={"width": 1440, "height": 1000},
            slow_mo=50,
        )
        
        page = await context.new_page()
        print("\n--> Opening LinkedIn. Please log in, complete any verification, and make sure you see your feed.")
        await page.goto("https://www.linkedin.com/login")
        
        print("\n--> KEEP THIS WINDOW OPEN. When you are fully logged in and ready, close the Chromium browser window manually to save your session.")
        
        # Wait until the browser window is closed by the user
        while len(context.pages) > 0:
            try:
                await asyncio.sleep(1)
            except Exception:
                break
                
        # Save storage state json as a secondary backup
        await context.storage_state(path=str(storage_state_path))
        print("\nSession saved successfully! You can now run the scraper headlessly.")

if __name__ == "__main__":
    asyncio.run(main())
