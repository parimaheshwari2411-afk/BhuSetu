import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { queryDatabase } from "../utils/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { blockchainService } from "../services/blockchain.service";
import { ipfsService } from "../services/ipfs.service";
import { IApiResponse, TransactionStatus, ITransaction } from "../types";
import { isDatabaseUnavailable, SAMPLE_TRANSFERS } from "../data/sampleStore";
import multer from "multer";
import fs from "fs";

const router = Router();
const ZERO = "0x0000000000000000000000000000000000000000";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["application/pdf", "image/jpeg", "image/png"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Upload PDF, JPEG, or PNG."));
    }
  },
});

function mapTransaction(row: Record<string, unknown>): ITransaction {
  return {
    id: row.id as string,
    parcelId: row.parcel_id as string,
    buyerId: row.buyer_id as string,
    sellerId: row.seller_id as string,
    status: row.status as TransactionStatus,
    deedIpfsCid: row.deed_ipfs_cid as string,
    multiSigContractAddress: (row.multi_sig_contract_address as string) || "",
    multiSigTxHash: (row.multi_sig_tx_hash as string) || null,
    buyerApprovedAt: (row.buyer_approved_at as Date) || null,
    sellerApprovedAt: (row.seller_approved_at as Date) || null,
    registrarApprovedAt: (row.registrar_approved_at as Date) || null,
    completedAt: (row.completed_at as Date) || null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

async function walletForUser(userId: string): Promise<string> {
  const result = await queryDatabase(
    "SELECT wallet_address FROM users WHERE id = $1",
    [userId]
  );
  return (result.rows[0]?.wallet_address as string) || ZERO;
}

router.post(
  "/",
  authMiddleware,
  upload.single("deed"),
  async (req: AuthenticatedRequest, res: Response) => {
    let uploadedPath: string | undefined;
    try {
      const { parcelId, buyerId, registrarAddress } = req.body;
      const sellerId = req.user?.id;

      if (!parcelId || !buyerId || !sellerId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: parcelId, buyerId",
          timestamp: new Date(),
        });
      }

      if (parcelId === buyerId || sellerId === buyerId) {
        return res.status(400).json({
          success: false,
          error: "Buyer must be a different user than the seller",
          timestamp: new Date(),
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Deed document required",
          timestamp: new Date(),
        });
      }

      uploadedPath = req.file.path;

      const ipfsResult = await ipfsService.uploadFile(
        req.file.path,
        req.file.originalname
      );

      const parcelResult = await queryDatabase(
        "SELECT * FROM land_parcels WHERE id = $1 AND owner_id = $2",
        [parcelId, sellerId]
      );

      if (parcelResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Parcel not found or you are not the owner",
          timestamp: new Date(),
        });
      }

      const parcel = parcelResult.rows[0];
      const transactionId = uuidv4();

      const txResult = await queryDatabase(
        `INSERT INTO transactions
         (id, parcel_id, buyer_id, seller_id, status, deed_ipfs_cid, multi_sig_contract_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          transactionId,
          parcelId,
          buyerId,
          sellerId,
          TransactionStatus.PENDING,
          ipfsResult.cid,
          blockchainService.getContractAddress(),
        ]
      );

      const sellerWallet = await walletForUser(sellerId);
      const buyerWallet = await walletForUser(buyerId);
      const registrarWallet =
        registrarAddress ||
        process.env.REGISTRAR_ADDRESS ||
        ZERO;

      try {
        const txHash = await blockchainService.createEscrow(
          transactionId,
          sellerWallet,
          buyerWallet,
          registrarWallet,
          parcelId,
          parcel.total_value || "0",
          ipfsResult.cid
        );

        await queryDatabase(
          `UPDATE transactions SET multi_sig_tx_hash = $1, status = $2 WHERE id = $3`,
          [txHash, TransactionStatus.LOCKED_IN_ESCROW, transactionId]
        );

        txResult.rows[0].multi_sig_tx_hash = txHash;
        txResult.rows[0].status = TransactionStatus.LOCKED_IN_ESCROW;
      } catch (blockchainError) {
        console.error("Blockchain error:", blockchainError);
        await queryDatabase(
          `UPDATE transactions SET status = $1 WHERE id = $2`,
          [TransactionStatus.LOCKED_IN_ESCROW, transactionId]
        );
        txResult.rows[0].status = TransactionStatus.LOCKED_IN_ESCROW;
      }

      await queryDatabase(
        `INSERT INTO audit_log (transaction_id, action, actor_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          transactionId,
          "TRANSFER_INITIATED",
          sellerId,
          JSON.stringify({ deedIpfsCid: ipfsResult.cid }),
        ]
      );

      const response: IApiResponse<ITransaction> = {
        success: true,
        data: mapTransaction(txResult.rows[0]),
        message: "Transfer initiated and locked in escrow",
        timestamp: new Date(),
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Create transfer error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to initiate transfer",
        timestamp: new Date(),
      });
    } finally {
      if (uploadedPath) {
        fs.unlink(uploadedPath, () => undefined);
      }
    }
  }
);

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await queryDatabase(
      "SELECT * FROM transactions WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transfer not found",
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      data: mapTransaction(result.rows[0]),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Get transfer error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve transfer",
      timestamp: new Date(),
    });
  }
});

router.post(
  "/:id/approve",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const txResult = await queryDatabase(
        "SELECT * FROM transactions WHERE id = $1",
        [id]
      );

      if (txResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Transfer not found",
          timestamp: new Date(),
        });
      }

      const tx = txResult.rows[0];
      let approverRole: "SELLER" | "BUYER";
      let updateField: "seller_approved_at" | "buyer_approved_at";
      let nextStatus: TransactionStatus;

      if (userId === tx.seller_id) {
        approverRole = "SELLER";
        updateField = "seller_approved_at";
        nextStatus = tx.buyer_approved_at
          ? TransactionStatus.BUYER_APPROVED
          : TransactionStatus.SELLER_APPROVED;
      } else if (userId === tx.buyer_id) {
        approverRole = "BUYER";
        updateField = "buyer_approved_at";
        nextStatus = tx.seller_approved_at
          ? TransactionStatus.BUYER_APPROVED
          : TransactionStatus.BUYER_APPROVED;
      } else {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to approve this transfer",
          timestamp: new Date(),
        });
      }

      const blockchainTxHash = await blockchainService.approveEscrow(
        id,
        approverRole
      );

      await queryDatabase(
        `UPDATE transactions SET ${updateField} = NOW(), status = $1 WHERE id = $2`,
        [nextStatus, id]
      );

      await queryDatabase(
        `INSERT INTO audit_log (transaction_id, action, actor_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          id,
          `${approverRole}_APPROVED`,
          userId,
          JSON.stringify({ blockchainTxHash }),
        ]
      );

      res.status(200).json({
        success: true,
        data: {
          transactionId: id,
          approver: approverRole,
          blockchainTxHash,
          status: nextStatus,
        },
        message: `${approverRole} approval recorded`,
        timestamp: new Date(),
      });
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

router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const buyerId = req.query.buyerId as string | undefined;
    const sellerId = req.query.sellerId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    const filters: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }
    if (buyerId) {
      params.push(buyerId);
      filters.push(`buyer_id = $${params.length}`);
    }
    if (sellerId) {
      params.push(sellerId);
      filters.push(`seller_id = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countResult = await queryDatabase(
      `SELECT COUNT(*) as total FROM transactions ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    params.push(pageSize, offset);
    const result = await queryDatabase(
      `SELECT * FROM transactions ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.status(200).json({
      success: true,
      data: result.rows.map(mapTransaction),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("List transfers error:", error);
    if (isDatabaseUnavailable(error)) {
      return res.status(200).json({
        success: true,
        data: SAMPLE_TRANSFERS,
        pagination: { total: SAMPLE_TRANSFERS.length, page: 1, pageSize: 50, totalPages: 1 },
        message: "PostgreSQL unavailable — bundled sample escrow",
        timestamp: new Date(),
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to retrieve transfers",
      timestamp: new Date(),
    });
  }
});

export default router;
