import { Router, Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { EmailService } from "../services/email.service.js";
import { requireSendAuth } from "./auth.middleware.js";

export const coldMailRouter = Router();
const emailService = new EmailService();

/**
 * Endpoint to send a single cold email and log it to the database.
 * POST /outreach-flow/cold-mail/send
 */
coldMailRouter.post("/outreach-flow/cold-mail/send", requireSendAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, subject, body, name, company } = req.body;

    if (!email || !subject || !body) {
      res.status(400).json({
        success: false,
        message: "Missing email, subject, or body parameters.",
      });
      return;
    }

    const recipientName = name ? name.trim() : "Hiring Manager";
    const companyName = company ? company.trim() : "Target Company";

    console.log(`[Cold Mail API] Initiating cold email to: ${email} (${companyName})`);

    // 1. Check if a lead already exists for this email
    let lead = await prisma.lead.findFirst({
      where: { recipientEmail: email.trim().toLowerCase() },
    });

    if (!lead) {
      // Create new Lead. Note: jobDescription is required in Prisma, so we pass a default string
      lead = await prisma.lead.create({
        data: {
          companyName,
          recipientEmail: email.trim().toLowerCase(),
          jobDescription: `Direct Cold Outreach to ${recipientName} at ${companyName}`,
          status: "SENDING",
        },
      });
    } else {
      // Update existing lead status to SENDING
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "SENDING" },
      });
    }

    // 2. Dispatch email via Nodemailer EmailService
    try {
      await emailService.sendEmail(email.trim().toLowerCase(), subject, body);

      // Update lead status to SENT
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "SENT" },
      });

      // 3. Log Message in DB
      const message = await prisma.message.create({
        data: {
          leadId: lead.id,
          type: "COLD_EMAIL",
          subject,
          body,
          sentAt: new Date(),
        },
      });

      res.status(200).json({
        success: true,
        message: "Cold email sent successfully.",
        data: { lead, message },
      });
    } catch (sendError) {
      console.error(`[Cold Mail API] Nodemailer dispatch failed for ${email}:`, sendError);

      // Update lead status to FAILED
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "FAILED" },
      });

      // Log the message anyway so the user sees the attempt failed
      const message = await prisma.message.create({
        data: {
          leadId: lead.id,
          type: "COLD_EMAIL",
          subject,
          body,
          sentAt: null, // Indicates not sent
        },
      });

      res.status(500).json({
        success: false,
        message: sendError instanceof Error ? sendError.message : "Failed to dispatch email via SMTP server.",
        data: { lead, message },
      });
    }
  } catch (error) {
    console.error("[Cold Mail API] Internal Server Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Endpoint to retrieve all sent/failed cold email logs.
 * GET /outreach-flow/cold-mail/logs
 */
coldMailRouter.get("/outreach-flow/cold-mail/logs", async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await prisma.message.findMany({
      where: {
        type: "COLD_EMAIL",
      },
      include: {
        lead: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("[Cold Mail API] Failed to fetch outbox logs:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
