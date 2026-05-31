import nodemailer from "nodemailer";

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      console.warn(
        "[Email Service] WARNING: EMAIL_USER or EMAIL_PASS environment variables are not set. Emails will fail to send."
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    });
  }

  /**
   * Sends a plain-text email using Nodemailer via Gmail
   * @param to The recipient email address
   * @param subject The email subject line
   * @param body The email body content (plain text or markdown)
   */
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        "Email transporter is not configured. Please ensure EMAIL_USER and EMAIL_PASS are set in .env."
      );
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: body,
    };

    console.log(`[Email Service] Sending email to "${to}" with subject: "${subject}"...`);
    await this.transporter.sendMail(mailOptions);
    console.log(`[Email Service] Email successfully sent to "${to}".`);
  }
}
