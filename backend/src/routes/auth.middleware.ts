import { Request, Response, NextFunction } from "express";

/**
 * Express middleware to enforce API Key verification.
 * Supports checking the 'X-API-Key' header or standard 'Authorization: Bearer <key>' header.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"];
  const expectedKey = process.env.OUTREACH_API_KEY;

  if (!expectedKey) {
    console.warn("[Auth Middleware] Warning: OUTREACH_API_KEY is not defined in backend environment! Access is open.");
    return next();
  }

  // Parse header value
  let parsedKey = "";
  if (typeof apiKey === "string") {
    if (apiKey.startsWith("Bearer ")) {
      parsedKey = apiKey.substring(7).trim();
    } else {
      parsedKey = apiKey.trim();
    }
  }

  if (parsedKey !== expectedKey) {
    res.status(401).json({
      success: false,
      message: "Unauthorized access: Invalid or missing API passcode. Please authenticate.",
    });
    return;
  }

  next();
};
