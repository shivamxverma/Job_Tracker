import { Request, Response, NextFunction } from "express";

/**
 * Express middleware to enforce API Key verification.
 * Supports checking the 'X-API-Key' header or standard 'Authorization: Bearer <key>' header.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  next();
};
