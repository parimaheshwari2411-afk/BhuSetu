import { ethers, Contract, Signer } from "ethers";
import LandTitleEscrowABI from "../contracts/LandTitleEscrow.json";
import { ISmartContractState, TransactionStatus } from "../types";

class BlockchainService {
  private provider: ethers.Provider;
  private signer: Signer | null = null;
  private escrowContract: Contract | null = null;
  private escrowAddress: string;

  constructor() {
    const rpcUrl = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.escrowAddress =
      process.env.LAND_TITLE_ESCROW_ADDRESS ||
      "0x0000000000000000000000000000000000000000";

    this.initialize();
  }

  private async initialize() {
    try {
      const privateKey = process.env.PRIVATE_KEY;
      if (privateKey) {
        this.signer = new ethers.Wallet(privateKey, this.provider);
        this.escrowContract = new ethers.Contract(
          this.escrowAddress,
          LandTitleEscrowABI,
          this.signer
        );
      }
    } catch (error) {
      console.error("Failed to initialize blockchain service:", error);
    }
  }

  /**
   * Deploy Land Title Escrow Smart Contract
   */
  async deployEscrowContract(registrarAddress: string): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not initialized");
    }

    const factory = new ethers.ContractFactory(
      LandTitleEscrowABI,
      process.env.CONTRACT_BYTECODE || "",
      this.signer
    );

    const contract = await factory.deploy(registrarAddress);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("Land Title Escrow deployed to:", address);
    return address;
  }

  /**
   * Create multi-sig escrow for land transfer
   */
  async createEscrow(
    transactionId: string,
    sellerAddress: string,
    buyerAddress: string,
    registrarAddress: string,
    parcelId: string,
    amount: string
  ): Promise<string> {
    if (!this.escrowContract || !this.signer) {
      throw new Error("Contract or signer not initialized");
    }

    try {
      const tx = await this.escrowContract.createEscrow(
        transactionId,
        sellerAddress,
        buyerAddress,
        registrarAddress,
        parcelId,
        ethers.parseEther(amount)
      );

      const receipt = await tx.wait();
      console.log("Escrow created:", receipt?.transactionHash);
      return receipt?.transactionHash || "";
    } catch (error) {
      console.error("Failed to create escrow:", error);
      throw error;
    }
  }

  /**
   * Approve escrow by stakeholder (seller, buyer, or registrar)
   */
  async approveEscrow(
    transactionId: string,
    approverRole: string
  ): Promise<string> {
    if (!this.escrowContract || !this.signer) {
      throw new Error("Contract or signer not initialized");
    }

    try {
      const tx = await this.escrowContract.approveTransfer(
        transactionId,
        approverRole
      );

      const receipt = await tx.wait();
      console.log(`Escrow approved by ${approverRole}:`, receipt?.transactionHash);
      return receipt?.transactionHash || "";
    } catch (error) {
      console.error("Failed to approve escrow:", error);
      throw error;
    }
  }

  /**
   * Complete escrow and transfer ownership
   */
  async completeEscrow(transactionId: string): Promise<string> {
    if (!this.escrowContract || !this.signer) {
      throw new Error("Contract or signer not initialized");
    }

    try {
      const tx = await this.escrowContract.completeTransfer(transactionId);
      const receipt = await tx.wait();
      console.log("Escrow completed:", receipt?.transactionHash);
      return receipt?.transactionHash || "";
    } catch (error) {
      console.error("Failed to complete escrow:", error);
      throw error;
    }
  }

  /**
   * Get escrow state from smart contract
   */
  async getEscrowState(transactionId: string): Promise<ISmartContractState> {
    if (!this.escrowContract) {
      throw new Error("Contract not initialized");
    }

    try {
      const state = await this.escrowContract.getEscrowState(transactionId);

      return {
        parcelId: state.parcelId,
        status: this.mapContractStatusToEnum(state.status),
        seller: state.seller,
        buyer: state.buyer,
        registrar: state.registrar,
        sellerApproved: state.sellerApproved,
        buyerApproved: state.buyerApproved,
        registrarApproved: state.registrarApproved,
      };
    } catch (error) {
      console.error("Failed to get escrow state:", error);
      throw error;
    }
  }

  /**
   * Generate signature for multi-sig approval
   */
  async generateSignature(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not initialized");
    }

    try {
      const messageHash = ethers.hashMessage(message);
      const signature = await this.signer.signMessage(message);
      return signature;
    } catch (error) {
      console.error("Failed to generate signature:", error);
      throw error;
    }
  }

  /**
   * Verify signature
   */
  async verifySignature(
    message: string,
    signature: string,
    address: string
  ): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error("Failed to verify signature:", error);
      return false;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice?.toString() || "0";
    } catch (error) {
      console.error("Failed to get gas price:", error);
      return "0";
    }
  }

  /**
   * Map contract status to enum
   */
  private mapContractStatusToEnum(status: number): TransactionStatus {
    const statusMap: Record<number, TransactionStatus> = {
      0: TransactionStatus.PENDING,
      1: TransactionStatus.LOCKED_IN_ESCROW,
      2: TransactionStatus.SELLER_APPROVED,
      3: TransactionStatus.BUYER_APPROVED,
      4: TransactionStatus.REGISTRAR_APPROVED,
      5: TransactionStatus.COMPLETED,
      6: TransactionStatus.REJECTED,
    };

    return statusMap[status] || TransactionStatus.PENDING;
  }

  /**
   * Watch escrow events
   */
  watchEscrowEvents(
    callback: (event: any) => void
  ): void {
    if (!this.escrowContract) {
      console.error("Contract not initialized");
      return;
    }

    this.escrowContract.on("EscrowCreated", (transactionId, event) => {
      console.log("EscrowCreated event:", transactionId);
      callback({ type: "EscrowCreated", data: { transactionId } });
    });

    this.escrowContract.on("TransferApproved", (transactionId, role, event) => {
      console.log("TransferApproved event:", transactionId, role);
      callback({ type: "TransferApproved", data: { transactionId, role } });
    });

    this.escrowContract.on("TransferCompleted", (transactionId, event) => {
      console.log("TransferCompleted event:", transactionId);
      callback({ type: "TransferCompleted", data: { transactionId } });
    });
  }
}

export const blockchainService = new BlockchainService();
