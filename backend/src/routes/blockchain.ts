import { Router, Request, Response } from "express";
import { blockchainService } from "../services/blockchain.service";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const gasPrice = await blockchainService.getGasPrice();
    res.json({
      success: true,
      data: {
        demoMode: blockchainService.isDemoMode(),
        contractAddress: blockchainService.getContractAddress(),
        rpcUrl: process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545",
        gasPrice,
        flow: [
          {
            step: 1,
            title: "Lock in escrow",
            detail:
              "Seller uploads the deed to IPFS. The backend calls LandTitleEscrow.createEscrow so the parcel cannot be sold twice (LOCKED_IN_ESCROW).",
          },
          {
            step: 2,
            title: "Three distinct approvals",
            detail:
              "Seller, buyer, and registrar each approve. On-chain this is approveTransfer / approveTransferByBackend. Off-chain JWT proves who you are.",
          },
          {
            step: 3,
            title: "Registrar completes",
            detail:
              "POST /api/v1/admin/approve-transfer calls completeTransfer, then PostgreSQL updates land_parcels.owner_id to the buyer.",
          },
        ],
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Blockchain status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to read blockchain status",
      timestamp: new Date(),
    });
  }
});

export default router;
