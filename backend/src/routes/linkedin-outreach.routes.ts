import { Router, Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { requireAuth, requireSendAuth } from "./auth.middleware.js";
import { GeminiService } from "../services/gemini.service.js";
import { 
  hasLinkedinSession, 
  validateLinkedinSession, 
  saveLinkedinSession, 
  getLinkedinSessionPath 
} from "../connectors/linkedin/session.js";
import { launchStealthBrowser } from "../services/stealth-browser.js";
import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";

export const linkedinOutreachRouter = Router();
linkedinOutreachRouter.use(requireAuth);

const geminiService = new GeminiService();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 1. Check LinkedIn Session Status
 * GET /outreach/linkedin/status
 */
linkedinOutreachRouter.get("/outreach/linkedin/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionFileExists = hasLinkedinSession();
    if (!sessionFileExists) {
      res.status(200).json({ authenticated: false });
      return;
    }

    const isValid = await validateLinkedinSession();
    res.status(200).json({ authenticated: isValid });
  } catch (error) {
    console.error("[LinkedIn Outreach] Status check failed:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 2. Connect LinkedIn Account (Headless session saver)
 * GET /outreach/linkedin/connect
 */
linkedinOutreachRouter.get("/outreach/linkedin/connect", async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[LinkedIn Outreach] Starting headed login browser session...");
    
    // Immediate response as connection launches headed window on server/local host
    res.write("Launching headed browser for manual login...");
    await saveLinkedinSession();
    
    res.end("\nConnection process complete. Session saved.");
  } catch (error) {
    console.error("[LinkedIn Outreach] Connection failed:", error);
    if (!res.headersSent) {
      res.status(500).send(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * 2.5. Import LinkedIn cookies directly via JSON
 * POST /outreach/linkedin/import-cookies
 */
linkedinOutreachRouter.post("/outreach/linkedin/import-cookies", async (req: Request, res: Response): Promise<void> => {
  try {
    const { cookies } = req.body;
    if (!cookies || !Array.isArray(cookies)) {
      res.status(400).json({ success: false, message: "Missing or invalid cookies array." });
      return;
    }

    const mapSameSite = (value: string | undefined): "Strict" | "Lax" | "None" => {
      const normalized = value?.toLowerCase();
      if (normalized === "strict") return "Strict";
      if (normalized === "none" || normalized === "no_restriction") return "None";
      return "Lax";
    };

    const mappedCookies = cookies
      .filter((cookie: any) => cookie.domain?.includes("linkedin.com"))
      .map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path ?? "/",
        expires: cookie.expirationDate ?? cookie.expires ?? Math.floor(Date.now() / 1000) + 86400 * 30,
        httpOnly: cookie.httpOnly ?? false,
        secure: cookie.secure ?? true,
        sameSite: mapSameSite(cookie.sameSite),
      }));

    if (mappedCookies.length === 0) {
      res.status(400).json({ success: false, message: "No valid linkedin.com cookies found in the payload." });
      return;
    }

    const outputPath = getLinkedinSessionPath();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ cookies: mappedCookies, origins: [] }, null, 2), "utf-8");

    console.log(`[LinkedIn Session] Successfully imported ${mappedCookies.length} cookies directly via API.`);

    res.status(200).json({
      success: true,
      message: `Successfully imported ${mappedCookies.length} LinkedIn session cookies.`
    });
  } catch (error) {
    console.error("[LinkedIn Session] Cookie import failed:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 3. Generate personalized LinkedIn DM draft
 * POST /outreach/linkedin/generate
 */
linkedinOutreachRouter.post("/outreach/linkedin/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId, resumeId, templateId } = req.body;
    if (!profileId || !resumeId || !templateId) {
      res.status(400).json({ success: false, message: "Missing profileId, resumeId, or templateId." });
      return;
    }

    // Load contexts
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    const template = await prisma.template.findUnique({ where: { id: templateId } });

    if (!profile || !resume || !template) {
      res.status(404).json({ success: false, message: "Recruiter profile, resume, or template not found." });
      return;
    }

    console.log(`[LinkedIn Outreach] Generating cold note note for profile: ${profile.name}...`);
    
    // Append strict length limit in instructions for LinkedIn connection requests (300 character constraint)
    const lengthInstructions = `${template.prompt}\n\nSTRICT REQUIREMENT: The generated message MUST be extremely concise and direct. It MUST fit within a strict 300 character count limit (including spaces and punctuation) so it can be sent inside a connection request note. Maximum 2-3 sentences.`;

    const generated = await geminiService.generateOutreachMessage(
      {
        name: profile.name,
        role: profile.role,
        company: profile.company,
        notes: profile.notes
      },
      {
        parsedText: resume.parsedText,
        skills: resume.skills,
        experience: resume.experience,
        projects: resume.projects
      },
      null, // No attached job posting metadata needed for cold DMs
      lengthInstructions,
      "LINKEDIN_CONNECTION_NOTE"
    );

    // Save as draft OutboundMessage
    const draft = await prisma.outboundMessage.create({
      data: {
        profileId,
        channel: "LINKEDIN",
        subject: generated.subject || "Connection Request Note",
        content: generated.body,
        status: "DRAFT"
      }
    });

    res.status(201).json({
      success: true,
      message: "Successfully generated LinkedIn cold outreach note draft.",
      data: draft
    });
  } catch (error) {
    console.error("[LinkedIn Outreach] Draft generation failed:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 3.5. Extract recruiter/prospect profile details from PDF or Image file
 * POST /outreach/linkedin/extract-file
 */
linkedinOutreachRouter.post("/outreach/linkedin/extract-file", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileData, mimeType } = req.body;

    if (!fileData || !mimeType) {
      res.status(400).json({ success: false, message: "Missing base64 fileData or mimeType." });
      return;
    }

    // Clean base64 string if it contains prefix data:...;base64,
    let base64Data = fileData;
    if (fileData.includes("base64,")) {
      base64Data = fileData.split("base64,")[1];
    }

    console.log("[LinkedIn Outreach] Calling Gemini to extract profile details from file...");
    const extracted = await geminiService.extractProfileFromFile(base64Data, mimeType);

    res.status(200).json({
      success: true,
      message: "Successfully extracted profile details from file.",
      data: extracted
    });
  } catch (error) {
    console.error("[LinkedIn Outreach] File extraction failed:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 4. Send Approved DMs/Notes sequentially with randomized 5-10s delays
 * POST /outreach/linkedin/send
 */
linkedinOutreachRouter.post("/outreach/linkedin/send", requireSendAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      res.status(400).json({ success: false, message: "Missing or invalid messageIds array." });
      return;
    }

    const messages = await prisma.outboundMessage.findMany({
      where: {
        id: { in: messageIds },
        channel: "LINKEDIN"
      },
      include: {
        profile: true
      }
    });

    if (messages.length === 0) {
      res.status(404).json({ success: false, message: "No valid pending LinkedIn messages found." });
      return;
    }

    // Acknowledge processing immediately to unblock frontend HTTP timeouts
    res.status(202).json({
      success: true,
      message: `Sequentially dispatching ${messages.length} LinkedIn DMs in the background.`
    });

    // Background Playwright DM Dispatcher
    (async () => {
      const sessionPath = getLinkedinSessionPath();
      const sessionFileExists = hasLinkedinSession();

      if (!sessionFileExists) {
        console.warn("[LinkedIn Outreach] Missing cached browser session cookies. Aborting dispatch.");
        for (const msg of messages) {
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "FAILED" }
          });
        }
        return;
      }

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        try {
          // Check profile url is active
          if (!msg.profile.linkedinUrl) {
            throw new Error("Recruiter target has no LinkedIn profile URL registered.");
          }

          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "SENDING" }
          });

          console.log(`[LinkedIn Outreach] Starting Playwright stealth browser to send DM to ${msg.profile.name}...`);
          
          let browser: any;
          let context: any;
          let isCDP = false;

          try {
            console.log("[LinkedIn Outreach] Attempting to connect to your active Chrome browser via CDP (port 9222)...");
            browser = await chromium.connectOverCDP("http://localhost:9222");
            const contexts = browser.contexts();
            context = contexts[0] || browser;
            isCDP = true;
            console.log("[LinkedIn Outreach] Connected successfully to your active Chrome browser!");
          } catch (cdpErr) {
            console.log("[LinkedIn Outreach] Active Chrome remote debugging port 9222 not available. Spawning dedicated headed stealth browser...");
            const stealth = await launchStealthBrowser({
              headless: false,
              sessionStatePath: sessionPath
            });
            browser = stealth.browser;
            context = stealth.context;
          }

          const page = await context.newPage();
          try {
            console.log(`[LinkedIn Outreach] Navigating to: ${msg.profile.linkedinUrl}`);
            await page.goto(msg.profile.linkedinUrl, {
              waitUntil: "domcontentloaded",
              timeout: 45000
            });

            // Settle dynamic SPA content (wait for profile main container skeleton or card to render)
            try {
              await page.waitForSelector('main, .scaffold-layout__main, .pv-profile-card, .ph5', { timeout: 15000 });
              console.log("[LinkedIn Outreach] Profile page mounted successfully. Allowing assets to settle...");
              await page.waitForTimeout(3000);
            } catch (e) {
              console.warn("[LinkedIn Outreach] Profile scaffold layout timed out. Using basic settle fallback.");
              await page.waitForTimeout(5000);
            }

            const currentUrl = page.url();
            if (!currentUrl.includes("linkedin.com/in/")) {
              throw new Error("Failed to load profile. Blocked or redirect detected.");
            }

            let messaged = false;

            // Flow A: Direct Message Button (if already connected or open profile)
            const messageBtn = page.locator('button.pvs-profile-actions__action:has-text("Message"), button:has-text("Message"), a:has-text("Message")').first();
            if (await messageBtn.isVisible()) {
              console.log("[LinkedIn Outreach] Direct Message button visible. Initiating chat window...");
              await messageBtn.click();
              await page.waitForTimeout(2500);

              // Check if a Premium InMail paywall dialog or promotional modal appeared
              const inmailModal = page.locator('div[role="dialog"]:has-text("InMail"), .premium-upsell-link, button:has-text("InMail")').first();
              const isPremiumLocked = await inmailModal.isVisible();

              if (isPremiumLocked) {
                console.log("[LinkedIn Outreach] Premium InMail paywall detected. Dismissing and pivoting to Connection invitation note...");
                // Dismiss the dialog using standard close actions
                const dismissBtn = page.locator('button[aria-label="Dismiss"], button[aria-label="Close"], button.artdeco-modal__dismiss').first();
                if (await dismissBtn.isVisible()) {
                  await dismissBtn.click();
                  await page.waitForTimeout(1500);
                }
              } else {
                const chatInput = page.locator('div.msg-form__contenteditable[contenteditable="true"], div[role="textbox"], .msg-form__placeholder').first();
                if (await chatInput.isVisible()) {
                  await chatInput.focus();
                  await page.waitForTimeout(500);
                  // Type with realistic human pacing
                  await chatInput.type(msg.content, { delay: 30 + Math.random() * 20 });
                  await page.waitForTimeout(1000);

                  const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]:has-text("Send")').first();
                  await sendBtn.click();
                  await page.waitForTimeout(2500);
                  messaged = true;
                  console.log("[LinkedIn Outreach] Direct message dispatched successfully!");
                }
              }
            }

            // Flow B: Connect Button Invitation Note (standard networking path)
            if (!messaged) {
              console.log("[LinkedIn Outreach] Direct Message not possible. Attempting Connection Invitation note...");
              
              let connectBtn = page.locator('button.pvs-profile-actions__action:has-text("Connect"), button:has-text("Connect")').first();
              if (!(await connectBtn.isVisible())) {
                const moreBtn = page.locator('button[aria-label*="more actions"], button:has-text("More"), button.artdeco-dropdown__trigger').first();
                if (await moreBtn.isVisible()) {
                  await moreBtn.click();
                  await page.waitForTimeout(1500);
                  connectBtn = page.locator('span:has-text("Connect"), div[role="button"]:has-text("Connect"), button:has-text("Connect"), button[aria-label*="Connect"]').first();
                }
              }

              if (await connectBtn.isVisible()) {
                await connectBtn.click();
                await page.waitForTimeout(2500);

                // Handle standard prompt: "Customize your invitation"
                const addNoteBtn = page.locator('button[aria-label="Add a note"], button:has-text("Add a note"), button.artdeco-button--secondary:has-text("note")').first();
                if (await addNoteBtn.isVisible()) {
                  await addNoteBtn.click();
                  await page.waitForTimeout(1500);

                  const noteArea = page.locator('textarea[name="message"], textarea#custom-message, textarea').first();
                  if (await noteArea.isVisible()) {
                    await noteArea.focus();
                    await page.waitForTimeout(500);
                    // Type with realistic human pacing
                    await noteArea.type(msg.content, { delay: 35 + Math.random() * 25 });
                    await page.waitForTimeout(1000);

                    const sendInvitationBtn = page.locator('button[aria-label="Send now"], button:has-text("Send"), button.artdeco-button--primary:has-text("Send")').first();
                    await sendInvitationBtn.click();
                    await page.waitForTimeout(2500);
                    messaged = true;
                    console.log("[LinkedIn Outreach] Connection request invitation sent with personalized note!");
                  }
                } else {
                  // Direct connection send without note (if restricted)
                  console.log("[LinkedIn Outreach] Add a note restricted. Sending direct invitation...");
                  const sendInvitationBtn = page.locator('button[aria-label="Send now"], button:has-text("Send now"), button:has-text("Send")').first();
                  if (await sendInvitationBtn.isVisible()) {
                    await sendInvitationBtn.click();
                    await page.waitForTimeout(2500);
                    messaged = true;
                  }
                }
              }
            }

            if (messaged) {
              await prisma.outboundMessage.update({
                where: { id: msg.id },
                data: {
                  status: "SENT",
                  sentAt: new Date()
                }
              });

              await prisma.conversationTracker.upsert({
                where: { profileId: msg.profileId },
                update: { lastContactedAt: new Date() },
                create: {
                  profileId: msg.profileId,
                  status: "ACTIVE",
                  lastContactedAt: new Date()
                }
              });
            } else {
              throw new Error("Unable to locate direct Message or Connect action buttons on target profile.");
            }
          } finally {
            if (page && !page.isClosed()) {
              await page.close();
            }
            if (isCDP) {
              if (browser) {
                await browser.close(); // Disconnects session safely
              }
            } else {
              if (context) await context.close();
              if (browser) await browser.close();
            }
          }
        } catch (err) {
          console.error(`[LinkedIn Outreach] Send failed for recruiter ${msg.profile.name}:`, err);
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "FAILED" }
          });
        }

        // Apply a randomized 5-10 second human-like delay between consecutive DM dispatches
        if (i < messages.length - 1) {
          const delay = 5000 + Math.random() * 5000;
          console.log(`[LinkedIn Outreach] Applying human simulation delay: ${Math.round(delay)}ms before next DM...`);
          await sleep(delay);
        }
      }
      console.log("[LinkedIn Outreach] Sequential background DM outreach campaign completed.");
    })().catch((err) => console.error("Outbox background executor error:", err));

  } catch (error) {
    console.error("[LinkedIn Outreach] Send setup failed:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});
