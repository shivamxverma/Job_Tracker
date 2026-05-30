import { Worker, Job as BullJob } from "bullmq";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../services/prisma.js";
import { redisConnectionOptions } from "./queue.js";
import { LinkedinApplyAdapter } from "../connectors/adapters/linkedin-apply.adapter.js";
import { WellfoundApplyAdapter } from "../connectors/adapters/wellfound-apply.adapter.js";
import { ApplicationAdapter } from "../connectors/adapters/adapter.interface.js";
import {
  launchStealthBrowser,
  captureDebugScreenshot,
  isBlockedPage,
} from "../services/stealth-browser.js";
import { randomDelay, humanPause } from "../services/human-like.js";
import { validateLinkedinSession } from "../connectors/linkedin/session.js";
import { chromium } from "playwright";

interface ApplyJobData {
  applicationId: string;
}

// ──────────────────────────────────────────────
// Rate Limiting & Daily Cap
// ──────────────────────────────────────────────

const MAX_DAILY_APPLICATIONS = parseInt(process.env.MAX_DAILY_APPLICATIONS || "15", 10);
const MIN_APPLY_DELAY_MS = parseInt(process.env.MIN_APPLY_DELAY_MS || "180000", 10); // 3 minutes
const MAX_APPLY_DELAY_MS = parseInt(process.env.MAX_APPLY_DELAY_MS || "480000", 10); // 8 minutes

/**
 * Checks how many applications were submitted today and enforces the daily cap.
 * Returns true if we can proceed, false if the cap has been reached.
 */
async function checkDailyCap(): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await prisma.application.count({
    where: {
      status: "APPLIED",
      appliedAt: {
        gte: todayStart,
      },
    },
  });

  console.log(`[Apply Worker] Daily applications so far: ${todayCount}/${MAX_DAILY_APPLICATIONS}`);

  if (todayCount >= MAX_DAILY_APPLICATIONS) {
    console.warn(
      `[Apply Worker] Daily application cap reached (${MAX_DAILY_APPLICATIONS}). ` +
      `Skipping further applications until tomorrow.`
    );
    return false;
  }

  return true;
}

/**
 * Applies a random rate-limiting delay between applications.
 */
async function rateLimitDelay(): Promise<void> {
  const delay = randomDelay(MIN_APPLY_DELAY_MS, MAX_APPLY_DELAY_MS);
  const delayMinutes = (delay / 60000).toFixed(1);
  console.log(`[Apply Worker] Rate limiting: waiting ${delayMinutes} minutes before next application...`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Validates the session for the given platform before applying.
 */
async function validateSession(source: string): Promise<void> {
  if (source === "linkedin") {
    console.log("[Apply Worker] Validating LinkedIn session before applying...");
    const isValid = await validateLinkedinSession();
    if (!isValid) {
      throw new Error(
        "LinkedIn session is expired or invalid. Please re-run 'pnpm save-session:linkedin' " +
        "to refresh your session cookies before applying."
      );
    }
    console.log("[Apply Worker] LinkedIn session validated successfully.");
  }
  // Wellfound and other platforms can have their own validation here
}

export const applyWorker = new Worker(
  "auto-apply",
  async (bullJob: BullJob<ApplyJobData>) => {
    const { applicationId } = bullJob.data;
    console.log(`[Apply Worker] Starting automated application for Application ID: ${applicationId}`);

    // ── Rate Limiting: delay between consecutive applications ──
    await rateLimitDelay();

    // ── Daily Cap Check ──
    const canProceed = await checkDailyCap();
    if (!canProceed) {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "FAILED",
          errorMessage: `Daily application cap of ${MAX_DAILY_APPLICATIONS} reached. Will retry tomorrow.`,
        },
      });
      return;
    }

    // 1. Fetch application, job, and generated resume details from DB
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        resumeVersion: true,
      },
    });

    if (!application) {
      throw new Error(`Application with ID ${applicationId} not found in database.`);
    }

    if (!application.resumeVersion) {
      throw new Error(`No optimized resume version is linked to this application.`);
    }

    const { job, resumeVersion } = application;

    if (!job.applyUrl) {
      throw new Error(`Job posting is missing an application URL (applyUrl).`);
    }

    // 2. Locate authenticated session cookies for the platform
    let sessionPath = "";
    if (job.source === "linkedin") {
      sessionPath = path.resolve(process.cwd(), "authentication", "linkedin-session.json");
    } else if (job.source === "wellfound") {
      sessionPath = path.resolve(process.cwd(), "session.json"); // wellfound saves cookies here
    }

    // If session file doesn't exist, throw a helpful user-facing error
    if (sessionPath && !fs.existsSync(sessionPath)) {
      throw new Error(
        `Authentication session cookies for platform "${job.source}" are missing. Please run the login utility in terminal first: ` +
        (job.source === "linkedin" ? "'pnpm run save-session:linkedin'" : "'pnpm save-session'")
      );
    }

    // ── Session Validation ──
    await validateSession(job.source);

    // 3. Update Application status to APPLYING
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "APPLYING" },
    });

    // 4. Launch browser with anti-detection measures
    const usePersistentChrome = process.env.USE_PERSISTENT_CHROME === "true";
    const isHeadless = process.env.HEADLESS_APPLY === "true";
    let context: any;
    let browser: any;

    try {
      if (usePersistentChrome) {
        // ── Persistent Chrome Mode ──
        // Uses your actual Chrome profile with existing login sessions.
        // Requires Chrome to be closed before launching.
        console.log("[Apply Worker] Launching using your actual Google Chrome session (persistent mode)...");
        const userDataDir = process.env.CHROME_USER_DATA_DIR || "/Users/shivamverma/Library/Application Support/Google/Chrome";
        const profileDir = process.env.CHROME_PROFILE || "Default";
        
        try {
          context = await chromium.launchPersistentContext(userDataDir, {
            headless: isHeadless,
            channel: "chrome",
            args: [
              `--profile-directory=${profileDir}`,
              "--disable-blink-features=AutomationControlled",
              "--disable-features=AutomationControlled",
              "--no-first-run",
              "--no-default-browser-check",
            ],
            ignoreDefaultArgs: ["--enable-automation"],
            viewport: {
              width: 1350 + Math.floor(Math.random() * 31),
              height: 880 + Math.floor(Math.random() * 41),
            },
          });
        } catch (err) {
          console.error("[Apply Worker] Failed to launch persistent Chrome context:", err);
          throw new Error(
            "Could not launch using your actual Google Chrome session because Google Chrome is currently open. " +
            "Please CLOSE Google Chrome completely (Quit Chrome) and click 'Retry Application' again!"
          );
        }
      } else {
        // ── Stealth Playwright Mode (Recommended) ──
        // Uses playwright-extra with stealth plugin for maximum anti-detection.
        console.log("[Apply Worker] Launching stealth browser with anti-detection measures...");
        const stealthResult = await launchStealthBrowser({
          headless: isHeadless,
          sessionStatePath: sessionPath || undefined,
        });
        browser = stealthResult.browser;
        context = stealthResult.context;
      }

      const page = await context.newPage();

      // 5. Select the appropriate adapter based on URL & platform
      const adapters: ApplicationAdapter[] = [
        new LinkedinApplyAdapter(),
        new WellfoundApplyAdapter(),
      ];

      const activeAdapter = adapters.find((a) => a.canHandle(job.applyUrl!, job.source));
      if (!activeAdapter) {
        throw new Error(
          `No automation adapter found to handle job source: "${job.source}" and URL: "${job.applyUrl}".`
        );
      }

      // 6. Run the adapter apply flow
      await activeAdapter.apply({
        page,
        applicationId,
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.company,
        applyUrl: job.applyUrl,
        resumePdfPath: resumeVersion.pdfPath,
      });

      // 7. Success! Update Application & Job tracking states
      console.log(`[Apply Worker] Application completed successfully. Writing status to DB...`);
      
      const now = new Date();
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "APPLIED",
          appliedAt: now,
        },
      });

      // Update the Job object to also mirror this applied state in the explorer dashboard
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "Applied",
          appliedAt: now,
          platform: job.source,
          notes: `Automatically applied using tailored resume compiled by AI. Resume ID: ${resumeVersion.id}`,
        },
      });

      console.log(`[Apply Worker] Application finished! Application ID: ${applicationId}`);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Apply Worker] Application failed for Application ID ${applicationId}:`, error);

      // ── Capture debug screenshot on failure ──
      try {
        const pages = context?.pages?.() || [];
        if (pages.length > 0) {
          const currentPage = pages[pages.length - 1];
          const currentUrl = currentPage.url();

          // Log the URL where we got blocked
          if (isBlockedPage(currentUrl)) {
            console.error(`[Apply Worker] BLOCKED! Page redirected to: ${currentUrl}`);
          }

          await captureDebugScreenshot(currentPage, `apply-failure-${applicationId}`);
        }
      } catch (screenshotErr) {
        console.warn("[Apply Worker] Could not capture failure screenshot:", screenshotErr);
      }

      // Record failure inside application record
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "FAILED",
          errorMessage: errMsg,
        },
      });

      throw error;
    } finally {
      // Clean up and close Playwright
      await context?.close();
      if (browser) {
        await browser.close();
      }
      console.log("[Apply Worker] Playwright browser closed cleanly.");
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 1, // Only launch one Playwright instance at a time to prevent CPU spikes and anti-bot blocks
  }
);

applyWorker.on("completed", (job) => {
  console.log(`[Apply Worker] Job ${job?.id} completed successfully.`);
});

applyWorker.on("failed", (job, err) => {
  console.error(`[Apply Worker] Job ${job?.id} failed:`, err);
});
