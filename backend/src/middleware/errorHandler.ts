import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  status?: number;
  details?: any;
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = error.status || 500;
  const message = error.message || "Internal Server Error";

  console.error(`[${new Date().toISOString()}] Error:`, {
    status,
    message,
    details: error.details,
    path: req.originalUrl,
  });

  res.status(status).json({
    success: false,
    error: message,
    details: error.details,
    timestamp: new Date(),
  });
};
