import { Router, Request, Response } from "express";
import { queryDatabase } from "../utils/database";
import {
  authMiddleware,
  adminMiddleware,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";
import { blockchainService } from "../services/blockchain.service";
import { TransactionStatus } from "../types";

const router = Router();

/**
 * GET /api/v1/admin/pending-transfers
 * Get all pending land title transfers for registrar approval
 */
router.get(
  "/pending-transfers",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;

      // Get pending and buyer/seller approved transactions
      const countResult = await queryDatabase(
        `SELECT COUNT(*) as total FROM transactions 
         WHERE status IN ($1, $2, $3)`,
        [
          TransactionStatus.LOCKED_IN_ESCROW,
          TransactionStatus.BUYER_APPROVED,
          TransactionStatus.SELLER_APPROVED,
        ]
      );

      const total = parseInt(countResult.rows[0].total);

      const result = await queryDatabase(
        `SELECT t.*, 
                lp.ulpin, lp.area_in_sq_meters, lp.location,
                seller.full_name as seller_name, seller.email as seller_email,
                buyer.full_name as buyer_name, buyer.email as buyer_email
         FROM transactions t
         LEFT JOIN land_parcels lp ON t.parcel_id = lp.id
         LEFT JOIN users seller ON t.seller_id = seller.id
         LEFT JOIN users buyer ON t.buyer_id = buyer.id
         WHERE t.status IN ($1, $2, $3)
         ORDER BY t.created_at DESC
         LIMIT $4 OFFSET $5`,
        [
          TransactionStatus.LOCKED_IN_ESCROW,
          TransactionStatus.BUYER_APPROVED,
          TransactionStatus.SELLER_APPROVED,
          pageSize,
          offset,
        ]
      );

      const transfers = result.rows.map((row: any) => ({
        id: row.id,
        parcelId: row.parcel_id,
        ulpin: row.ulpin,
        area: row.area_in_sq_meters,
        location: row.location,
        seller: {
          id: row.seller_id,
          name: row.seller_name,
          email: row.seller_email,
        },
        buyer: {
          id: row.buyer_id,
          name: row.buyer_name,
          email: row.buyer_email,
        },
        status: row.status,
        deedIpfsCid: row.deed_ipfs_cid,
        sellerApprovedAt: row.seller_approved_at,
        buyerApprovedAt: row.buyer_approved_at,
        createdAt: row.created_at,
      }));

      res.status(200).json({
        success: true,
        data: transfers,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Get pending transfers error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve pending transfers",
        timestamp: new Date(),
      });
    }
  }
);

/**
 * POST /api/v1/admin/approve-transfer
 * Registrar approves land title transfer and completes escrow
 */
router.post(
  "/approve-transfer",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { transactionId } = req.body;
      const registrarId = req.user?.id;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: "Transaction ID required",
          timestamp: new Date(),
        });
      }

      // Get transaction details
      const txResult = await queryDatabase(
        "SELECT * FROM transactions WHERE id = $1",
        [transactionId]
      );

      if (txResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Transfer not found",
          timestamp: new Date(),
        });
      }

      const tx = txResult.rows[0];

      // Verify both seller and buyer have approved
      if (
        !tx.seller_approved_at ||
        !tx.buyer_approved_at
      ) {
        return res.status(400).json({
          success: false,
          error: "Both seller and buyer must approve before registrar approval",
          timestamp: new Date(),
        });
      }

      try {
        // Approve in smart contract as registrar
        const blockchainTxHash = await blockchainService.approveEscrow(
          transactionId,
          "REGISTRAR"
        );

        // Complete the escrow on blockchain
        const completionTxHash = await blockchainService.completeEscrow(
          transactionId
        );

        // Update transaction to completed
        await queryDatabase(
          `UPDATE transactions 
           SET status = $1, registrar_approved_at = NOW(), completed_at = NOW(),
               multi_sig_tx_hash = $2
           WHERE id = $3`,
          [TransactionStatus.COMPLETED, completionTxHash, transactionId]
        );

        // Update land parcel ownership
        await queryDatabase(
          `UPDATE land_parcels 
           SET owner_id = $1, blockchain_hash = $2, updated_at = NOW()
           WHERE id = $3`,
          [tx.buyer_id, completionTxHash, tx.parcel_id]
        );

        // Record in audit log
        await queryDatabase(
          `INSERT INTO audit_log (transaction_id, action, actor_id, details)
           VALUES ($1, $2, $3, $4)`,
          [
            transactionId,
            "TRANSFER_COMPLETED",
            registrarId,
            JSON.stringify({
              sellerApprovedAt: tx.seller_approved_at,
              buyerApprovedAt: tx.buyer_approved_at,
              completedAt: new Date(),
            }),
          ]
        );

        res.status(200).json({
          success: true,
          data: {
            transactionId,
            status: TransactionStatus.COMPLETED,
            blockchainTxHash: completionTxHash,
            message: "Transfer approved and completed",
          },
          timestamp: new Date(),
        });
      } catch (blockchainError) {
        console.error("Blockchain completion error:", blockchainError);
        res.status(500).json({
          success: false,
          error: "Failed to complete transfer on blockchain",
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error("Approve transfer error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to approve transfer",
        timestamp: new Date(),
      });
    }
  }
);

/**
 * GET /api/v1/admin/statistics
 * Get registrar dashboard statistics
 */
router.get(
  "/statistics",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await queryDatabase(
        `SELECT 
          (SELECT COUNT(*) FROM users WHERE role = 'CITIZEN') as total_citizens,
          (SELECT COUNT(*) FROM users WHERE role = 'SURVEYOR') as total_surveyors,
          (SELECT COUNT(*) FROM land_parcels) as total_parcels,
          (SELECT SUM(area_in_sq_meters) FROM land_parcels) as total_area_sq_meters,
          (SELECT COUNT(*) FROM transactions WHERE status = 'PENDING') as pending_transfers,
          (SELECT COUNT(*) FROM transactions WHERE status = 'COMPLETED') as completed_transfers,
          (SELECT COUNT(*) FROM transactions WHERE status = 'LOCKED_IN_ESCROW') as escrow_transfers,
          (SELECT COUNT(*) FROM transactions WHERE status = 'REJECTED' OR status = 'CANCELLED') as failed_transfers`
      );

      const statistics = stats.rows[0];

      res.status(200).json({
        success: true,
        data: {
          users: {
            citizens: parseInt(statistics.total_citizens) || 0,
            surveyors: parseInt(statistics.total_surveyors) || 0,
          },
          parcels: {
            total: parseInt(statistics.total_parcels) || 0,
            totalAreaSqMeters:
              parseFloat(statistics.total_area_sq_meters) || 0,
          },
          transfers: {
            pending: parseInt(statistics.pending_transfers) || 0,
            completed: parseInt(statistics.completed_transfers) || 0,
            inEscrow: parseInt(statistics.escrow_transfers) || 0,
            failed: parseInt(statistics.failed_transfers) || 0,
          },
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Get statistics error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve statistics",
        timestamp: new Date(),
      });
    }
  }
);

/**
 * GET /api/v1/admin/audit-log
 * Get audit log of all transactions
 */
router.get(
  "/audit-log",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const offset = (page - 1) * pageSize;

      const result = await queryDatabase(
        `SELECT al.*, u.full_name as actor_name
         FROM audit_log al
         LEFT JOIN users u ON al.actor_id = u.id
         ORDER BY al.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );

      const countResult = await queryDatabase(
        "SELECT COUNT(*) as total FROM audit_log"
      );

      const total = parseInt(countResult.rows[0].total);

      res.status(200).json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Get audit log error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve audit log",
        timestamp: new Date(),
      });
    }
  }
);

/**
 * POST /api/v1/admin/reject-transfer
 * Registrar rejects a transfer
 */
router.post(
  "/reject-transfer",
  authMiddleware,
  adminMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { transactionId, reason } = req.body;
      const registrarId = req.user?.id;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: "Transaction ID required",
          timestamp: new Date(),
        });
      }

      // Update transaction status
      await queryDatabase(
        `UPDATE transactions 
         SET status = $1, registrar_approved_at = NOW()
         WHERE id = $2`,
        [TransactionStatus.REJECTED, transactionId]
      );

      // Record in audit log
      await queryDatabase(
        `INSERT INTO audit_log (transaction_id, action, actor_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          transactionId,
          "TRANSFER_REJECTED",
          registrarId,
          JSON.stringify({ reason: reason || "No reason provided" }),
        ]
      );

      res.status(200).json({
        success: true,
        data: {
          transactionId,
          status: TransactionStatus.REJECTED,
        },
        message: "Transfer rejected successfully",
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Reject transfer error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reject transfer",
        timestamp: new Date(),
      });
    }
  }
);

export default router;
