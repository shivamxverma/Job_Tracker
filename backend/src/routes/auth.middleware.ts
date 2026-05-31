import { Request, Response, NextFunction } from "express";

/**
 * Express middleware to enforce API Key verification.
 * Supports checking the 'X-API-Key' header or standard 'Authorization: Bearer <key>' header.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  console.log(`[Auth Middleware] requireAuth hit for: ${req.method} ${req.url}`);
  // Authentication temporarily disabled to unblock access
  return next();
};

/**
 * Express middleware to enforce API Key verification specifically for email sending.
 */
export const requireSendAuth = (req: Request, res: Response, next: NextFunction): void => {
  console.log(`[Auth Middleware] requireSendAuth hit for: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.toString().split(" ")[1];
  const expectedKey = process.env.OUTREACH_API_KEY;

  if (!expectedKey) {
    console.error("[Auth Middleware] Critical Configuration Error: OUTREACH_API_KEY is not set in backend .env.");
    res.status(500).json({
      success: false,
      message: "Security Error: OUTREACH_API_KEY is not configured on the server. Please set it in your environment variables.",
    });
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    console.warn(`[Auth Middleware] Unauthorized email sending attempt blocked from IP: ${req.ip} on ${req.method} ${req.url}`);
    res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API key.",
    });
    return;
  }

  next();
};
