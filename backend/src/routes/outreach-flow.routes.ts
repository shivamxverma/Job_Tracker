import { Router, Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { requireAuth, requireSendAuth } from "./auth.middleware.js";
import { outreachQueue } from "../queues/queue.js";
import { EmailService } from "../services/email.service.js";
import { GeminiService } from "../services/gemini.service.js";
// @ts-ignore
import { PDFParse } from "pdf-parse";

export const outreachFlowRouter = Router();
outreachFlowRouter.use(requireAuth);

const emailService = new EmailService();
const geminiService = new GeminiService();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Seed Default Templates if empty
async function seedDefaultTemplates() {
  const count = await prisma.template.count();
  if (count === 0) {
    console.log("[OutreachFlow API] Seeding default templates...");
    await prisma.template.createMany({
      data: [
        {
          name: "Direct Referral Request",
          type: "REFERRAL",
          prompt: "Write a polite, warm, and highly personalized referral request. State the role you are applying to, map your exact matching technical skills and B.Tech CSE background to the job description, and explain why you'd be a great fit. Make it easy for the employee to say yes and refer you.",
          active: true,
        },
        {
          name: "Informational Networking",
          type: "NETWORKING",
          prompt: "Write a friendly, professional networking request. Express curiosity about their career trajectory, ask for high-level technical guidance or industry advice, and seek to schedule a brief informational discussion. Avoid asking for a referral directly.",
          active: true,
        },
        {
          name: "Profile & Resume Feedback",
          type: "FEEDBACK",
          prompt: "Write a humble, specific message requesting feedback on your projects or resume profile. Briefly reference a shared technical area or project, explain that you are seeking to optimize your skills, and politely ask if they could review your profile.",
          active: true,
        },
        {
          name: "Startup Founder & CTO Outreach",
          type: "FOUNDER",
          prompt: "Write a high-signal startup-focused outreach message to a founder or CTO. Reference the company's mission and engineering challenges, highlight a matching high-impact project you have built, and express a strong desire to discuss potential opportunities.",
          active: true,
        },
      ],
    });
  }
}
seedDefaultTemplates().catch((err) => console.error("Failed to seed templates:", err));

// ==================== 1. RESUME ROUTES ====================

// List Resumes
outreachFlowRouter.get("/outreach-flow/resumes", async (req: Request, res: Response) => {
  try {
    const resumes = await prisma.resume.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: resumes });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Upload and Parse Resume
outreachFlowRouter.post("/outreach-flow/resumes", async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, pdfBase64 } = req.body;
    if (!title || !pdfBase64) {
      res.status(400).json({ success: false, message: "Missing title or pdfBase64 data." });
      return;
    }

    console.log(`[OutreachFlow API] Parsing uploaded PDF resume: ${title}...`);
    // Convert base64 to buffer
    const base64Data = pdfBase64.includes("base64,") ? pdfBase64.split("base64,")[1] : pdfBase64;
    const buffer = Buffer.from(base64Data, "base64");

    // Parse plain text from PDF
    const pdfParser = new PDFParse({ data: buffer });
    const parsedTextResult = await pdfParser.getText();
    const parsedText = parsedTextResult.text || "";

    if (!parsedText.trim()) {
      res.status(400).json({ success: false, message: "Failed to extract text from PDF resume." });
      return;
    }

    // Call Gemini to dynamically extract lists of skills
    console.log(`[OutreachFlow API] Extracting structural skills from resume text...`);
    const skillsPrompt = `Analyze the following candidate resume text.
Extract a clean JSON array of the technical skills, frameworks, programming languages, and tools mentioned.
Format your output as a single, valid JSON array of strings:
[
  "TypeScript",
  "React",
  "Node.js"
]
Do NOT return markdown blocks. Output only the JSON.

Resume:
${parsedText}`;

    const extractRes = await geminiService.generateOutreachMessage(
      { name: "Parser", role: "Extractor", company: "System" },
      { parsedText: parsedText, skills: [] },
      null,
      skillsPrompt,
      "FEEDBACK"
    );

    let skills: string[] = [];
    try {
      skills = JSON.parse(extractRes.body);
    } catch (e) {
      // Fallback: simple text parsing
      skills = parsedText.match(/[A-Za-z+#.0-9]+/g)?.slice(0, 15) || [];
    }

    // Create entry in DB
    const resume = await prisma.resume.create({
      data: {
        title,
        parsedText,
        skills: Array.isArray(skills) ? skills : [],
      },
    });

    res.status(201).json({ success: true, message: "Resume uploaded and parsed successfully.", data: resume });
  } catch (error) {
    console.error("[OutreachFlow API] Resume upload fail:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Delete Resume
outreachFlowRouter.delete("/outreach-flow/resumes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.resume.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Resume deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});


// ==================== 2. PROFILE ROUTES ====================

// List Profiles
outreachFlowRouter.get("/outreach-flow/profiles", async (req: Request, res: Response) => {
  try {
    const profiles = await prisma.profile.findMany({
      include: {
        outboundMessages: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: profiles });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Create Single or Bulk Profiles
outreachFlowRouter.post("/outreach-flow/profiles", async (req: Request, res: Response): Promise<void> => {
  try {
    const { profiles } = req.body;
    if (!profiles) {
      res.status(400).json({ success: false, message: "Missing profiles payload." });
      return;
    }

    const profilesList = Array.isArray(profiles) ? profiles : [profiles];
    const created = [];

    for (const p of profilesList) {
      const { name, role, company, linkedinUrl, email, notes, tags } = p;
      if (!name || !role || !company) {
        continue;
      }

      const tagsArray = Array.isArray(tags) 
        ? tags 
        : typeof tags === "string" 
          ? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : [];

      const profile = await prisma.profile.create({
        data: {
          name: name.trim(),
          role: role.trim(),
          company: company.trim(),
          linkedinUrl: linkedinUrl ? linkedinUrl.trim() : null,
          email: email ? email.trim().toLowerCase() : null,
          notes: notes ? notes.trim() : null,
          tags: tagsArray,
          source: profilesList.length > 1 ? "BULK_IMPORT" : "MANUAL",
        },
      });
      created.push(profile);
    }

    res.status(201).json({
      success: true,
      message: `Successfully imported ${created.length} profile(s).`,
      data: created,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Delete Profile
outreachFlowRouter.delete("/outreach-flow/profiles/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.profile.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Profile deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});


// ==================== 3. MANUAL JOB ROUTES ====================

// List Manual Jobs
outreachFlowRouter.get("/outreach-flow/jobs", async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        platform: "MANUAL_ENTRY",
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Create Manual Job
outreachFlowRouter.post("/outreach-flow/jobs", async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, company, description, link, jobId } = req.body;
    if (!title || !company) {
      res.status(400).json({ success: false, message: "Title and Company are required." });
      return;
    }

    const job = await prisma.job.create({
      data: {
        source: "manual",
        externalId: `manual-${Date.now()}`,
        title,
        company,
        location: "Remote",
        applyUrl: link || null,
        description: description || null,
        platform: "MANUAL_ENTRY", // Identifies manually added jobs
        status: "Manual",
      },
    });

    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Delete Manual Job
outreachFlowRouter.delete("/outreach-flow/jobs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.job.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Job deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});


// ==================== 4. TEMPLATE ROUTES ====================

// List Templates
outreachFlowRouter.get("/outreach-flow/templates", async (req: Request, res: Response) => {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Create/Update Template
outreachFlowRouter.post("/outreach-flow/templates", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, type, prompt, active } = req.body;
    if (!name || !type || !prompt) {
      res.status(400).json({ success: false, message: "Missing template name, type, or prompt." });
      return;
    }

    let template;
    if (id) {
      template = await prisma.template.update({
        where: { id },
        data: { name, type, prompt, active: active ?? true },
      });
    } else {
      template = await prisma.template.create({
        data: { name, type, prompt, active: active ?? true },
      });
    }

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});


// ==================== 5. GENERATION QUEUE ROUTES ====================

// Get Recent Generation Jobs
outreachFlowRouter.get("/outreach-flow/queue/status", async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.generationJob.findMany({
      include: {
        profile: true,
        template: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Dispatch BullMQ bulk generations
outreachFlowRouter.post("/outreach-flow/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileIds, resumeId, templateId, jobId } = req.body;
    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0 || !resumeId || !templateId) {
      res.status(400).json({ success: false, message: "Missing profileIds, resumeId, or templateId." });
      return;
    }

    console.log(`[OutreachFlow API] Dispatched BullMQ bulk outreach message generation for ${profileIds.length} profiles...`);

    const createdGenJobs = [];

    for (const profileId of profileIds) {
      // 1. Create a GenerationJob in database
      const genJob = await prisma.generationJob.create({
        data: {
          profileId,
          resumeId,
          templateId,
          jobId: jobId || null,
          status: "PENDING",
        },
      });

      // 2. Add BullMQ task to Redis
      await outreachQueue.add(
        "outreach-generation-task",
        { generationJobId: genJob.id },
        {
          attempts: 2,
          removeOnComplete: true,
        }
      );

      createdGenJobs.push(genJob);
    }

    res.status(202).json({
      success: true,
      message: `Enqueued ${createdGenJobs.length} outreach message generation jobs into BullMQ.`,
      data: createdGenJobs,
    });
  } catch (error) {
    console.error("[OutreachFlow API] Failed to queue bulk generations:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});


// ==================== 6. MANUAL APPROVAL & EDIT QUEUE ====================

// Fetch drafts in Approval Queue
outreachFlowRouter.get("/outreach-flow/approval", async (req: Request, res: Response) => {
  try {
    const drafts = await prisma.outboundMessage.findMany({
      where: { status: "DRAFT" },
      include: {
        profile: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: drafts });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Edit Draft message
outreachFlowRouter.patch("/outreach-flow/approval/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { subject, content } = req.body;
    if (!subject || !content) {
      res.status(400).json({ success: false, message: "Subject and content are required." });
      return;
    }

    const updated = await prisma.outboundMessage.update({
      where: { id },
      data: {
        subject,
        content,
        status: "EDTIED", // Maintain state mapping
      },
    });

    res.status(200).json({ success: true, message: "Draft message updated successfully.", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Approve Draft message (marks it as APPROVED so it can be dispatched)
outreachFlowRouter.post("/outreach-flow/approval/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const updated = await prisma.outboundMessage.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    res.status(200).json({ success: true, message: "Message approved and ready to send.", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Reject Draft message
outreachFlowRouter.post("/outreach-flow/approval/:id/reject", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const updated = await prisma.outboundMessage.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    res.status(200).json({ success: true, message: "Message rejected.", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// List Outbox Messages (Logs of all sent/pending/failed messages)
outreachFlowRouter.get("/outreach-flow/messages", async (req: Request, res: Response) => {
  try {
    const messages = await prisma.outboundMessage.findMany({
      include: {
        profile: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Send Approved emails sequentially with SMTP rate limits
outreachFlowRouter.post("/outreach-flow/outbox/send", requireSendAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = await prisma.outboundMessage.findMany({
      where: {
        status: { in: ["APPROVED", "PENDING", "EDTIED"] },
      },
      include: {
        profile: true,
      },
    });

    let activeList = messages.filter((m) => m.profile.email);

    if (activeList.length === 0) {
      res.status(200).json({ success: true, message: "No approved messages with email addresses found in outbox." });
      return;
    }

    // 1. Safe Daily Limit Check to protect domain reputation
    const maxDailyEmails = process.env.MAX_DAILY_EMAILS ? parseInt(process.env.MAX_DAILY_EMAILS, 10) : 50;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const emailsSentToday = await prisma.outboundMessage.count({
      where: {
        status: "SENT",
        sentAt: {
          gte: startOfToday,
        },
      },
    });

    const allowedToday = Math.max(0, maxDailyEmails - emailsSentToday);

    let infoMsg = "";
    if (activeList.length > allowedToday) {
      const skippedCount = activeList.length - allowedToday;
      console.warn(`[OutreachFlow API] Daily sending cap of ${maxDailyEmails} reached! Truncating from ${activeList.length} to ${allowedToday} emails (skipping ${skippedCount} to protect reputation).`);
      activeList = activeList.slice(0, allowedToday);
      infoMsg = ` Daily limit reached. Truncating outbox send list to ${allowedToday} emails to protect reputation (skipped ${skippedCount}).`;
      
      if (allowedToday === 0) {
        res.status(429).json({
          success: false,
          message: `Daily sending limit of ${maxDailyEmails} reached. No more emails can be sent today.`,
        });
        return;
      }
    }

    console.log(`[OutreachFlow API] Outbox dispatch triggered for ${activeList.length} approved emails...`);

    // Immediate acknowledgment 202 to client, send emails sequentially in the background
    res.status(202).json({
      success: true,
      message: `Sequentially sending ${activeList.length} approved emails with safe 1-3 min delays.${infoMsg}`,
    });

    // Run background sequential SMTP sender
    (async () => {
      for (let i = 0; i < activeList.length; i++) {
        const msg = activeList[i];
        try {
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "SENDING" },
          });

          // Dispatch email
          await emailService.sendEmail(msg.profile.email!, msg.subject, msg.content);

          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
            },
          });

          // Initialize conversation tracker upon successful dispatch
          await prisma.conversationTracker.upsert({
            where: { profileId: msg.profileId },
            update: { lastContactedAt: new Date() },
            create: {
              profileId: msg.profileId,
              status: "ACTIVE",
              lastContactedAt: new Date(),
            },
          });

        } catch (err) {
          console.error(`[OutreachFlow API] Outbox send failed for profile ${msg.profile.name}:`, err);
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "FAILED" },
          });
        }

        // Safe spacing delay (1 to 3 minutes) to protect domain and SMTP reputation
        if (i < activeList.length - 1) {
          const delay = 60000 + Math.random() * 120000;
          console.log(`[OutreachFlow API] Safe spacing active: pausing for ${(delay / 60000).toFixed(2)} minutes before the next email...`);
          await sleep(delay);
        }
      }
      console.log("[OutreachFlow API] Outbox dispatch complete.");
    })().catch((err) => console.error("Outbox background executor error:", err));

  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});


// ==================== 7. ANALYTICS DASHBOARD ====================

outreachFlowRouter.get("/outreach-flow/analytics", async (req: Request, res: Response) => {
  try {
    const totalProfiles = await prisma.profile.count();
    
    // Status counts
    const totalGenerated = await prisma.outboundMessage.count();
    const approvedCount = await prisma.outboundMessage.count({
      where: { status: { in: ["APPROVED", "SENT", "PENDING"] } },
    });
    const sentCount = await prisma.outboundMessage.count({
      where: { status: "SENT" },
    });
    const failedCount = await prisma.outboundMessage.count({
      where: { status: "FAILED" },
    });

    const conversationStats = await prisma.conversationTracker.findMany();
    const repliesCount = conversationStats.filter((c) => c.replyReceived).length;
    const positiveReplies = conversationStats.filter((c) => c.positiveResponse).length;

    // Rates
    const replyRate = sentCount > 0 ? Math.round((repliesCount / sentCount) * 100) : 0;
    const positiveReplyRate = repliesCount > 0 ? Math.round((positiveReplies / repliesCount) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalProfiles,
        totalGenerated,
        approvedCount,
        sentCount,
        failedCount,
        repliesCount,
        positiveReplies,
        replyRate,
        positiveReplyRate,
        referralsReceived: Math.round(positiveReplies * 0.7), // Demo conversion mapping
        interviewsScheduled: Math.round(positiveReplies * 0.4), // Demo conversion mapping
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
