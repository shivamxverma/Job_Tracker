import { chromium } from "playwright";

async function main() {
  console.log("=== LIVE CHROME SELECTOR DIAGNOSIS (ALL CONTEXTS) ===");
  try {
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();
    console.log(`Found ${contexts.length} active contexts.`);
    
    let targetPage: any = null;

    for (let cIdx = 0; cIdx < contexts.length; cIdx++) {
      const context = contexts[cIdx];
      const pages = context.pages();
      console.log(`Context ${cIdx} has ${pages.length} pages.`);
      for (const p of pages) {
        console.log(` - Page: ${p.url()}`);
        if (p.url().includes("linkedin.com/in/")) {
          targetPage = p;
        }
      }
    }

    if (!targetPage) {
      console.log("No active LinkedIn profile page found open.");
      return;
    }

    console.log("\nFOUND TARGET LINKEDIN PAGE:", targetPage.url());
    
    // Check elements
    const messageBtn = targetPage.locator('button:has-text("Message"), a:has-text("Message")').first();
    const msgVisible = await messageBtn.isVisible();
    console.log("\n1. Message button visible:", msgVisible);
    if (msgVisible) {
      console.log("   - InnerText:", await messageBtn.innerText());
      console.log("   - OuterHTML:", await messageBtn.evaluate((el: any) => el.outerHTML));
    }

    // Connect button check
    const connectBtn = targetPage.locator('button:has-text("Connect")').first();
    const connVisible = await connectBtn.isVisible();
    console.log("\n2. Connect button visible:", connVisible);
    if (connVisible) {
      console.log("   - InnerText:", await connectBtn.innerText());
    }

    // More button check
    const moreBtn = targetPage.locator('button:has-text("More"), button[aria-label*="more actions"]').first();
    const moreVisible = await moreBtn.isVisible();
    console.log("\n3. More button visible:", moreVisible);
    if (moreVisible) {
      console.log("   - InnerText:", await moreBtn.innerText());
    }

  } catch (err) {
    console.error("CDP Debug failed:", err);
  }
}

main();
