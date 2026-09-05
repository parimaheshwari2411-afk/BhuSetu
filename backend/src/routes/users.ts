import { Router, Response } from "express";
import { queryDatabase } from "../utils/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { isDatabaseUnavailable, SAMPLE_USERS } from "../data/sampleStore";

const router = Router();

router.get(
  "/",
  authMiddleware,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await queryDatabase(
        `SELECT id, full_name, email, role, e_kyc_verified, wallet_address
         FROM users
         ORDER BY full_name`
      );

      res.json({
        success: true,
        data: result.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          fullName: row.full_name,
          email: row.email,
          role: row.role,
          eKycVerified: row.e_kyc_verified,
          walletAddress: row.wallet_address,
        })),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("List users error:", error);
      if (isDatabaseUnavailable(error)) {
        return res.json({
          success: true,
          data: SAMPLE_USERS,
          message: "PostgreSQL unavailable — bundled sample users",
          timestamp: new Date(),
        });
      }
      res.status(500).json({
        success: false,
        error: "Failed to list users",
        timestamp: new Date(),
      });
    }
  }
);

export default router;
