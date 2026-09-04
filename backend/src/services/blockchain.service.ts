import { ethers, Contract, Signer, Wallet } from "ethers";
import LandTitleEscrowABI from "../contracts/LandTitleEscrow.json";
import { ISmartContractState, TransactionStatus } from "../types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private signer: Signer | null = null;
  private escrowContract: Contract | null = null;
  private escrowAddress: string;
  private demoMode = false;

  constructor() {
    const rpcUrl = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.escrowAddress = process.env.LAND_TITLE_ESCROW_ADDRESS || ZERO_ADDRESS;
    void this.initialize();
  }

  private isConfigured(): boolean {
    return Boolean(
      this.escrowContract &&
        this.signer &&
        this.escrowAddress &&
        this.escrowAddress !== ZERO_ADDRESS
    );
  }

  private async initialize(): Promise<void> {
    try {
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        this.demoMode = true;
        console.warn("Blockchain: PRIVATE_KEY missing — using demo mode");
        return;
      }

      this.signer = new Wallet(privateKey, this.provider);

      if (this.escrowAddress === ZERO_ADDRESS) {
        this.demoMode = true;
        console.warn("Blockchain: escrow address not set — using demo mode");
        return;
      }

      this.escrowContract = new ethers.Contract(
        this.escrowAddress,
        LandTitleEscrowABI,
        this.signer
      );

      await this.provider.getBlockNumber();
      this.demoMode = false;
      console.log(`Blockchain: connected to ${this.escrowAddress}`);
    } catch (error) {
      this.demoMode = true;
      console.warn("Blockchain: RPC unavailable — using demo mode", error);
    }
  }

  async createEscrow(
    transactionId: string,
    sellerAddress: string,
    buyerAddress: string,
    registrarAddress: string,
    parcelId: string,
    amount: string,
    ipfsDocumentCid: string
  ): Promise<string> {
    if (this.demoMode || !this.isConfigured()) {
      return `0xdemo_create_${transactionId.replace(/-/g, "").slice(0, 24)}`;
    }

    const parsedAmount = this.parseAmount(amount);
    const tx = await this.escrowContract!.createEscrow(
      transactionId,
      sellerAddress,
      buyerAddress,
      registrarAddress,
      parcelId,
      parsedAmount,
      ipfsDocumentCid
    );
    const receipt = await tx.wait();
    return receipt?.hash || receipt?.transactionHash || "";
  }

  async approveEscrow(transactionId: string, approverRole: string): Promise<string> {
    if (this.demoMode || !this.isConfigured()) {
      return `0xdemo_approve_${approverRole.toLowerCase()}_${transactionId.replace(/-/g, "").slice(0, 16)}`;
    }

    const tx = await this.escrowContract!.approveTransferByBackend(
      transactionId,
      approverRole
    );
    const receipt = await tx.wait();
    return receipt?.hash || receipt?.transactionHash || "";
  }

  async completeEscrow(transactionId: string): Promise<string> {
    if (this.demoMode || !this.isConfigured()) {
      return `0xdemo_complete_${transactionId.replace(/-/g, "").slice(0, 24)}`;
    }

    const tx = await this.escrowContract!.completeTransfer(transactionId);
    const receipt = await tx.wait();
    return receipt?.hash || receipt?.transactionHash || "";
  }

  async rejectEscrow(transactionId: string, reason: string): Promise<string> {
    if (this.demoMode || !this.isConfigured()) {
      return `0xdemo_reject_${transactionId.replace(/-/g, "").slice(0, 24)}`;
    }

    const tx = await this.escrowContract!.rejectTransfer(transactionId, reason);
    const receipt = await tx.wait();
    return receipt?.hash || receipt?.transactionHash || "";
  }

  async getEscrowState(transactionId: string): Promise<ISmartContractState> {
    if (this.demoMode || !this.isConfigured()) {
      return {
        parcelId: "",
        status: TransactionStatus.LOCKED_IN_ESCROW,
        seller: ZERO_ADDRESS,
        buyer: ZERO_ADDRESS,
        registrar: ZERO_ADDRESS,
        sellerApproved: false,
        buyerApproved: false,
        registrarApproved: false,
      };
    }

    const state = await this.escrowContract!.getEscrowState(transactionId);
    return {
      parcelId: state.parcelId,
      status: this.mapContractStatusToEnum(Number(state.status)),
      seller: state.seller,
      buyer: state.buyer,
      registrar: state.registrar,
      sellerApproved: state.sellerApproved,
      buyerApproved: state.buyerApproved,
      registrarApproved: state.registrarApproved,
    };
  }

  async generateSignature(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not initialized");
    }
    return this.signer.signMessage(message);
  }

  async verifySignature(
    message: string,
    signature: string,
    address: string
  ): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch {
      return false;
    }
  }

  async getGasPrice(): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice?.toString() || "0";
    } catch {
      return "0";
    }
  }

  getContractAddress(): string {
    return this.escrowAddress;
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  private parseAmount(amount: string): bigint {
    try {
      if (!amount || amount === "0") return 0n;
      if (amount.includes(".")) return ethers.parseEther(amount);
      return BigInt(amount);
    } catch {
      return 0n;
    }
  }

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
}

export const blockchainService = new BlockchainService();
