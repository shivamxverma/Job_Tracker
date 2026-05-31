import { chromium } from "playwright";
import { launchStealthBrowser, isBlockedPage } from "../../services/stealth-browser.js";
import * as fs from "fs";
import * as path from "path";

const LINKEDIN_SESSION_PATH = "authentication/linkedin-session.json";

export function getLinkedinSessionPath(): string {
  return path.resolve(process.cwd(), LINKEDIN_SESSION_PATH);
}

export function hasLinkedinSession(): boolean {
  return fs.existsSync(getLinkedinSessionPath());
}

export async function saveLinkedinSession(): Promise<void> {
  const sessionPath = getLinkedinSessionPath();
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });

  console.log("[LinkedIn Session] Launching headed browser...");
  const browser = await chromium.launch({
    headless: false,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    // Allow up to 5 minutes for any user interaction during the manual login phase
    page.setDefaultTimeout(300000);

    console.log("[LinkedIn Session] Opening LinkedIn login page.");
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("\n=======================================================");
    console.log("👉 ACTION REQUIRED: Log in manually in the browser window.");
    console.log("👉 Solve any CAPTCHAs, OTPs, or 2FA checks on screen.");
    console.log("=======================================================\n");

    console.log("[LinkedIn Session] Waiting up to 5 minutes for authentication success...");
    
    // Correctly pass options as the third argument in page.waitForFunction
    await page.waitForFunction(() => {
      const url = window.location.href;
      return url.includes("/feed") || url.includes("/jobs") || !!document.querySelector(".global-nav") || !!document.querySelector("#global-nav");
    }, undefined, { timeout: 300000 });

    console.log("[LinkedIn Session] Login detected! Saving session state...");
    // Give it a brief moment to settle cookies
    await page.waitForTimeout(3000);

    await context.storageState({ path: sessionPath });
    console.log(`[LinkedIn Session] Successfully saved authenticated session to: ${sessionPath}`);
  } catch (error) {
    console.error("[LinkedIn Session] Login detection failed or timed out:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Validates whether the saved LinkedIn session cookies are still active.
 * Returns true if session is valid, false if expired/blocked.
 */
export async function validateLinkedinSession(): Promise<boolean> {
  if (!hasLinkedinSession()) {
    console.warn("[LinkedIn Session] No session file found.");
    return false;
  }

  const sessionPath = getLinkedinSessionPath();

  // Check cookie expiry from the session file locally to avoid aggressive headless bot detection triggers
  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
    const cookies = sessionData.cookies || [];
    const nowSeconds = Date.now() / 1000;

    // Check if key LinkedIn cookies (li_at) are expired
    const liAtCookie = cookies.find((c: any) => c.name === "li_at");
    if (liAtCookie) {
      const expires = liAtCookie.expires ?? liAtCookie.expirationDate ?? 0;
      if (expires > 0 && expires < nowSeconds) {
        console.warn("[LinkedIn Session] Session cookie 'li_at' has expired.");
        return false;
      }
    } else {
      console.warn("[LinkedIn Session] Critical cookie 'li_at' not found in session.");
      return false;
    }

    console.log("[LinkedIn Session] Session is valid and active (local verification passed).");
    return true;
  } catch (error) {
    console.error("[LinkedIn Session] Local validation error:", error);
    return false;
  }
}
