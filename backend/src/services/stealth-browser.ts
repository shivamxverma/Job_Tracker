import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as fs from "fs";
import type { BrowserContext, Browser, Page } from "playwright";

// ──────────────────────────────────────────────
// Register the Stealth plugin (patches 10+ detection vectors)
// ──────────────────────────────────────────────
chromium.use(StealthPlugin());

// ──────────────────────────────────────────────
// User-Agent Rotation Pool — real, current Chrome UAs
// ──────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Returns a slightly randomized viewport to avoid fingerprinting
 * via uniform viewport dimensions.
 */
function getRandomViewport(): { width: number; height: number } {
  const width = 1350 + Math.floor(Math.random() * 31); // 1350–1380
  const height = 880 + Math.floor(Math.random() * 41); // 880–920
  return { width, height };
}

/**
 * Anti-detection scripts injected into every new page.
 * These patch JS-level fingerprinting checks that LinkedIn and others use.
 */
async function injectAntiDetectionScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 1. Override navigator.webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });

    // 2. Mock window.chrome object (Headless Chromium doesn't have this)
    if (!(window as any).chrome) {
      (window as any).chrome = {
        runtime: {
          onMessage: { addListener: () => {}, removeListener: () => {} },
          sendMessage: () => {},
          connect: () => {},
        },
        app: { isInstalled: false },
        csi: () => {},
        loadTimes: () => {},
      };
    }

    // 3. Mock navigator.plugins (headless has empty array)
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
        { name: "Native Client", filename: "internal-nacl-plugin" },
      ],
    });

    // 4. Mock navigator.languages to look natural
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    // 5. Prevent Permissions API from leaking headless status
    const originalQuery = window.navigator.permissions.query.bind(
      window.navigator.permissions
    );
    (window.navigator.permissions as any).query = (parameters: any) => {
      if (parameters.name === "notifications") {
        return Promise.resolve({ state: Notification.permission } as PermissionStatus);
      }
      return originalQuery(parameters);
    };

    // 6. Override WebGL renderer to look like a real GPU
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (param: GLenum) {
      // UNMASKED_VENDOR_WEBGL
      if (param === 37445) return "Google Inc. (Apple)";
      // UNMASKED_RENDERER_WEBGL
      if (param === 37446) return "ANGLE (Apple, Apple M1, OpenGL 4.1)";
      return getParameter.call(this, param);
    };
  });
}

// ──────────────────────────────────────────────
// Exported launcher options
// ──────────────────────────────────────────────
export interface StealthLaunchOptions {
  headless?: boolean;
  sessionStatePath?: string;
  proxyUrl?: string;
}

/**
 * Launches a stealth-patched browser context with anti-detection measures.
 * Returns both the browser and context for proper cleanup.
 */
export async function launchStealthBrowser(
  options: StealthLaunchOptions = {}
): Promise<{ browser: Browser; context: BrowserContext }> {
  const { headless = true, sessionStatePath, proxyUrl } = options;
  const userAgent = getRandomUserAgent();
  const viewport = getRandomViewport();

  console.log(`[Stealth Browser] Launching (headless=${headless}, viewport=${viewport.width}x${viewport.height})`);
  console.log(`[Stealth Browser] User-Agent: ${userAgent.slice(0, 60)}...`);

  const launchArgs = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
  ];

  const proxyConfig = proxyUrl || process.env.PROXY_URL;
  if (proxyConfig) {
    console.log(`[Stealth Browser] Using proxy: ${proxyConfig.replace(/:[^:@]+@/, ":***@")}`);
  }

  const browser = await chromium.launch({
    headless,
    args: launchArgs,
    ignoreDefaultArgs: ["--enable-automation"],
    ...(proxyConfig ? { proxy: { server: proxyConfig } } : {}),
  });

  const contextOptions: any = {
    viewport,
    userAgent,
    locale: "en-US",
    timezoneId: "America/New_York",
    // Realistic device properties
    deviceScaleFactor: 2,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
  };

  if (sessionStatePath && fs.existsSync(sessionStatePath)) {
    console.log(`[Stealth Browser] Loading session state from: ${sessionStatePath}`);
    contextOptions.storageState = sessionStatePath;
  }

  const context = await browser.newContext(contextOptions);

  // Inject anti-detection scripts into every page opened in this context
  context.on("page", async (page: Page) => {
    await injectAntiDetectionScripts(page);
  });

  // Also inject into the first page that gets created
  const existingPages = context.pages();
  for (const page of existingPages) {
    await injectAntiDetectionScripts(page);
  }

  return { browser, context };
}

/**
 * Captures a screenshot for debugging when a page gets blocked.
 * Saved to `storage/screenshots/` with a timestamp.
 */
export async function captureDebugScreenshot(
  page: Page,
  label: string
): Promise<string | null> {
  try {
    const screenshotDir = "storage/screenshots";
    fs.mkdirSync(screenshotDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = `${screenshotDir}/${label}-${timestamp}.png`;
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`[Stealth Browser] Debug screenshot saved: ${filePath}`);
    return filePath;
  } catch {
    console.warn("[Stealth Browser] Could not capture debug screenshot.");
    return null;
  }
}

/**
 * Checks if the current page indicates a block, challenge, or auth wall.
 */
export function isBlockedPage(url: string): boolean {
  const blockedPatterns = [
    "/checkpoint",
    "/challenge",
    "/authwall",
    "/login",
    "/signup",
    "/uas/login",
    "/security/verify",
  ];
  return blockedPatterns.some((pattern) => url.includes(pattern));
}
