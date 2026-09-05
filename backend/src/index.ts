import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";

import authRoutes from "./routes/auth";
import parcelRoutes from "./routes/parcels";
import transactionRoutes from "./routes/transactions";
import adminRoutes from "./routes/admin";
import geoRoutes from "./routes/geo";
import blockchainRoutes from "./routes/blockchain";
import userRoutes from "./routes/users";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
const configuredOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8443,http://127.0.0.1:8443,http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        configuredOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
        callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Request Logging Middleware
app.use(requestLogger);

// Health Check Endpoint
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};
app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

// API Routes (all under /api/v1 namespace)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/parcels", parcelRoutes);
app.use("/api/v1/transfers", transactionRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/geo", geoRoutes);
app.use("/api/v1/blockchain", blockchainRoutes);
app.use("/api/v1/users", userRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(
    `🚀 Land Registry Backend Server running on http://localhost:${PORT}`
  );
  console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
