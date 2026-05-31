import { prisma } from "./prisma.js";

interface GmailSendResult {
  threadId: string;
  gmailMessageId: string;
}

export class GmailService {
  private clientId = process.env.GOOGLE_CLIENT_ID;
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  constructor() {
    if (!this.clientId || !this.clientSecret) {
      console.warn(
        "[Gmail Service] WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables are not set. Gmail OAuth will fail."
      );
    }
  }

  /**
   * Generates Google OAuth redirect authorization URL
   */
  getAuthUrl(redirectUri: string): string {
    const scopes = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email"
    ];
    return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${
      this.clientId
    }&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(
      scopes.join(" ")
    )}&access_type=offline&prompt=consent`;
  }

  /**
   * Exchanges authorization code for Access & Refresh tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId || "",
        client_secret: this.clientSecret || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${data.error_description || data.error || "Unknown error"}`);
    }

    const expiryDate = new Date(Date.now() + data.expires_in * 1000);

    // Save tokens in database singleton
    return await prisma.googleToken.upsert({
      where: { id: "singleton" },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || undefined, // Refresh token might not be returned on subsequent logins
        expiryDate,
      },
      create: {
        id: "singleton",
        accessToken: data.access_token,
        refreshToken: data.refresh_token || "",
        expiryDate,
      },
    });
  }

  /**
   * Refreshes the Google access token if it is expired
   */
  async getValidAccessToken(): Promise<string> {
    const tokenRecord = await prisma.googleToken.findUnique({
      where: { id: "singleton" },
    });

    if (!tokenRecord) {
      throw new Error("Google account is not authenticated. Please log in with Google first.");
    }

    const isExpired = new Date() >= new Date(tokenRecord.expiryDate);
    if (!isExpired) {
      return tokenRecord.accessToken;
    }

    if (!tokenRecord.refreshToken) {
      throw new Error("Refresh token missing. Please sign in with Google again.");
    }

    console.log("[Gmail Service] Google access token expired. Refreshing access token...");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId || "",
        client_secret: this.clientSecret || "",
        refresh_token: tokenRecord.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error || "Unknown error"}`);
    }

    const expiryDate = new Date(Date.now() + data.expires_in * 1000);

    // Save refreshed access token
    await prisma.googleToken.update({
      where: { id: "singleton" },
      data: {
        accessToken: data.access_token,
        expiryDate,
      },
    });

    console.log("[Gmail Service] Access token successfully refreshed.");
    return data.access_token;
  }

  /**
   * Fetches the email address of the authenticated Google user
   */
  async getAuthenticatedUserEmail(accessToken: string): Promise<string> {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch user email: ${data.error?.message || "Unknown error"}`);
    }

    return data.email;
  }

  /**
   * Compiles an RFC 822 formatted raw MIME message
   */
  private compileMimeMessage(
    to: string,
    from: string,
    subject: string,
    body: string,
    inReplyTo?: string,
    references?: string
  ): string {
    const headers: string[] = [
      `From: <${from}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "MIME-Version: 1.0",
    ];

    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
    }
    if (references) {
      headers.push(`References: ${references}`);
    }

    const mime = headers.join("\r\n") + "\r\n\r\n" + body;
    return Buffer.from(mime, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""); // base64url encoding
  }

  /**
   * Sends a cold email or threaded follow-up reply via the official Gmail API
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    threadId?: string,
    parentMessageId?: string
  ): Promise<GmailSendResult> {
    const accessToken = await this.getValidAccessToken();
    const fromEmail = await this.getAuthenticatedUserEmail(accessToken);

    // Build raw MIME email string
    const rawMime = this.compileMimeMessage(
      to.trim(),
      fromEmail,
      subject,
      body,
      parentMessageId,
      parentMessageId
    );

    const payload: any = {
      raw: rawMime,
    };

    if (threadId) {
      payload.threadId = threadId;
    }

    console.log(`[Gmail Service] Dispatching email to "${to}" via Gmail API...`);

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Gmail Service] Gmail dispatch failed:", data);
      throw new Error(`Gmail API sending failed: ${data.error?.message || "Unknown error"}`);
    }

    console.log(`[Gmail Service] Email successfully sent. Thread ID: ${data.threadId}, Message ID: ${data.id}`);

    return {
      threadId: data.threadId,
      gmailMessageId: data.id,
    };
  }
}
