import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { queryDatabase } from "../utils/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { blockchainService } from "../services/blockchain.service";
import { ipfsService } from "../services/ipfs.service";
import { IApiResponse, TransactionStatus, ITransaction } from "../types";
import multer from "multer";
import path from "path";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["application/pdf", "image/jpeg", "image/png"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

/**
 * POST /api/v1/transfers
 * Initiate land transfer request with deed document
 */
router.post(
  "/",
  authMiddleware,
  upload.single("deed"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { parcelId, buyerId, registrarAddress } = req.body;
      const sellerId = req.user?.id;

      if (!parcelId || !buyerId || !registrarAddress || !sellerId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
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

      // Upload deed to IPFS
      const ipfsResult = await ipfsService.uploadFile(
        req.file.path,
        req.file.originalname
      );

      // Get parcel details
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

      // Create transaction in database
      const transactionId = uuidv4();

      const txResult = await queryDatabase(
        `INSERT INTO transactions 
         (id, parcel_id, buyer_id, seller_id, status, deed_ipfs_cid)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          transactionId,
          parcelId,
          buyerId,
          sellerId,
          TransactionStatus.PENDING,
          ipfsResult.cid,
        ]
      );

      const transaction = txResult.rows[0];

      // Create smart contract escrow
      try {
        const txHash = await blockchainService.createEscrow(
          transactionId,
          sellerId,
          buyerId,
          registrarAddress,
          parcelId,
          parcel.total_value || "0"
        );

        // Update transaction with contract hash
        await queryDatabase(
          `UPDATE transactions SET multi_sig_tx_hash = $1, status = $2 WHERE id = $3`,
          [txHash, TransactionStatus.LOCKED_IN_ESCROW, transactionId]
        );
      } catch (blockchainError) {
        console.error("Blockchain error:", blockchainError);
        // Continue with transaction even if blockchain fails for now
      }

      const response: IApiResponse<ITransaction> = {
        success: true,
        data: {
          id: transaction.id,
          parcelId: transaction.parcel_id,
          buyerId: transaction.buyer_id,
          sellerId: transaction.seller_id,
          status: TransactionStatus.PENDING,
          deedIpfsCid: ipfsResult.cid,
          multiSigContractAddress: "",
          multiSigTxHash: transaction.multi_sig_tx_hash,
          buyerApprovedAt: null,
          sellerApprovedAt: null,
          registrarApprovedAt: null,
          completedAt: null,
          createdAt: transaction.created_at,
          updatedAt: transaction.updated_at,
        },
        message: "Transfer initiated successfully",
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
    }
  }
);

/**
 * GET /api/v1/transfers/:id
 * Get transfer details
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryDatabase(
      `SELECT * FROM transactions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transfer not found",
        timestamp: new Date(),
      });
    }

    const tx = result.rows[0];

    const response: IApiResponse<ITransaction> = {
      success: true,
      data: {
        id: tx.id,
        parcelId: tx.parcel_id,
        buyerId: tx.buyer_id,
        sellerId: tx.seller_id,
        status: tx.status,
        deedIpfsCid: tx.deed_ipfs_cid,
        multiSigContractAddress: tx.multi_sig_contract_address,
        multiSigTxHash: tx.multi_sig_tx_hash,
        buyerApprovedAt: tx.buyer_approved_at,
        sellerApprovedAt: tx.seller_approved_at,
        registrarApprovedAt: tx.registrar_approved_at,
        completedAt: tx.completed_at,
        createdAt: tx.created_at,
        updatedAt: tx.updated_at,
      },
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Get transfer error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve transfer",
      timestamp: new Date(),
    });
  }
});

/**
 * POST /api/v1/transfers/:id/approve
 * Approve transfer by buyer or seller
 */
router.post(
  "/:id/approve",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { signature } = req.body;
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

      // Determine approver role
      let approverRole: string;
      let updateField: string;

      if (userId === tx.seller_id) {
        approverRole = "SELLER";
        updateField = "seller_approved_at";
      } else if (userId === tx.buyer_id) {
        approverRole = "BUYER";
        updateField = "buyer_approved_at";
      } else {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to approve this transfer",
          timestamp: new Date(),
        });
      }

      // Approve in smart contract
      try {
        const blockchainTxHash = await blockchainService.approveEscrow(
          id,
          approverRole
        );

        // Update transaction approval
        await queryDatabase(
          `UPDATE transactions SET ${updateField} = NOW() WHERE id = $1`,
          [id]
        );

        const response: IApiResponse = {
          success: true,
          data: {
            transactionId: id,
            approver: approverRole,
            blockchainTxHash,
          },
          message: `${approverRole} approval recorded`,
          timestamp: new Date(),
        };

        res.status(200).json(response);
      } catch (blockchainError) {
        console.error("Blockchain approval error:", blockchainError);
        res.status(500).json({
          success: false,
          error: "Failed to record approval on blockchain",
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
 * GET /api/v1/transfers
 * Get all transfers (with optional filtering)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const buyerId = req.query.buyerId as string;
    const sellerId = req.query.sellerId as string;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    let query = "SELECT * FROM transactions WHERE 1=1";
    const params: any[] = [];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    if (buyerId) {
      query += ` AND buyer_id = $${params.length + 1}`;
      params.push(buyerId);
    }
    if (sellerId) {
      query += ` AND seller_id = $${params.length + 1}`;
      params.push(sellerId);
    }

    // Get total count
    const countResult = await queryDatabase(
      `SELECT COUNT(*) as total FROM transactions WHERE 1=1 ${
        status ? `AND status = $1` : ""
      } ${buyerId ? `AND buyer_id = $${status ? 2 : 1}` : ""} ${
        sellerId ? `AND seller_id = $${buyerId && status ? 3 : buyerId ? 2 : 1}` : ""
      }`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await queryDatabase(
      `${query} ORDER BY created_at DESC LIMIT $${
        params.length + 1
      } OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    const transfers: ITransaction[] = result.rows.map((row: any) => ({
      id: row.id,
      parcelId: row.parcel_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      status: row.status,
      deedIpfsCid: row.deed_ipfs_cid,
      multiSigContractAddress: row.multi_sig_contract_address,
      multiSigTxHash: row.multi_sig_tx_hash,
      buyerApprovedAt: row.buyer_approved_at,
      sellerApprovedAt: row.seller_approved_at,
      registrarApprovedAt: row.registrar_approved_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const response: any = {
      success: true,
      data: transfers,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("List transfers error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve transfers",
      timestamp: new Date(),
    });
  }
});

export default router;
