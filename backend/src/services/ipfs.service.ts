import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import fs from "fs";
import crypto from "crypto";
import { IIpfsUploadResult } from "../types";

class IpfsService {
  private pinataApiKey: string;
  private pinataApiSecret: string;
  private pinataJwt: string;
  private pinataGateway: string;
  private localIpfsUrl: string;
  private pinataPinRequest: AxiosInstance;
  private localIpfsRequest: AxiosInstance;

  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY || "";
    this.pinataApiSecret = process.env.PINATA_API_SECRET || "";
    this.pinataJwt = process.env.PINATA_JWT || "";
    this.pinataGateway =
      process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
    this.localIpfsUrl = process.env.LOCAL_IPFS_URL || "http://127.0.0.1:5001";

    const pinataHeaders: Record<string, string> = {};
    if (this.pinataJwt) {
      pinataHeaders.Authorization = `Bearer ${this.pinataJwt}`;
    } else {
      pinataHeaders.pinata_api_key = this.pinataApiKey;
      pinataHeaders.pinata_secret_api_key = this.pinataApiSecret;
    }

    this.pinataPinRequest = axios.create({
      baseURL: "https://api.pinata.cloud",
      headers: pinataHeaders,
      timeout: 45000,
    });

    this.localIpfsRequest = axios.create({
      baseURL: this.localIpfsUrl,
      timeout: 30000,
    });
  }

  async uploadFile(filePath: string, fileName: string): Promise<IIpfsUploadResult> {
    if (this.hasPinataCredentials()) {
      try {
        return await this.uploadToPinata(filePath, fileName);
      } catch (pinataError) {
        console.warn(
          "Pinata upload failed, falling back to local IPFS:",
          pinataError
        );
      }
    }

    try {
      return await this.uploadToLocalIpfs(filePath, fileName);
    } catch (localError) {
      console.warn(
        "Local IPFS upload failed, using content-addressed local CID:",
        localError
      );
      return this.uploadToLocalHash(filePath);
    }
  }

  private hasPinataCredentials(): boolean {
    return Boolean(this.pinataJwt || (this.pinataApiKey && this.pinataApiSecret));
  }

  private async uploadToPinata(
    filePath: string,
    fileName: string
  ): Promise<IIpfsUploadResult> {
    const fileStream = fs.createReadStream(filePath);
    const form = new FormData();
    form.append("file", fileStream, fileName);

    const response = await this.pinataPinRequest.post(
      "/pinning/pinFileToIPFS",
      form,
      { headers: form.getHeaders() }
    );

    const { IpfsHash } = response.data;

    return {
      success: true,
      cid: IpfsHash,
      gateway: `${this.pinataGateway}/ipfs/${IpfsHash}`,
      pinned: true,
      timestamp: new Date(),
    };
  }

  private async uploadToLocalIpfs(
    filePath: string,
    fileName: string
  ): Promise<IIpfsUploadResult> {
    const fileStream = fs.createReadStream(filePath);
    const form = new FormData();
    form.append("file", fileStream, fileName);

    const response = await this.localIpfsRequest.post("/api/v0/add", form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      params: { pin: "true" },
    });

    const payload =
      typeof response.data === "string"
        ? JSON.parse(response.data.trim().split("\n").pop() as string)
        : response.data;

    const cid = payload.Hash as string;

    return {
      success: true,
      cid,
      gateway: `http://127.0.0.1:8080/ipfs/${cid}`,
      pinned: true,
      timestamp: new Date(),
    };
  }

  /**
   * Last-resort CID so SIH demos still complete when Pinata and Kubo are down.
   * This is not a network IPFS pin — the hash is SHA-256 of file bytes.
   */
  private uploadToLocalHash(filePath: string): IIpfsUploadResult {
    const bytes = fs.readFileSync(filePath);
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    const cid = `bhu-${digest}`;

    return {
      success: true,
      cid,
      gateway: `local://deeds/${cid}`,
      pinned: false,
      timestamp: new Date(),
    };
  }

  async retrieveFile(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${this.pinataGateway}/ipfs/${cid}`, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      return Buffer.from(response.data);
    } catch {
      const local = await axios.get(`http://127.0.0.1:8080/ipfs/${cid}`, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      return Buffer.from(local.data);
    }
  }

  async pinCid(cid: string): Promise<boolean> {
    try {
      await this.localIpfsRequest.post(`/api/v0/pin/add?arg=${cid}`);
      return true;
    } catch (error) {
      console.error("Failed to pin CID:", error);
      return false;
    }
  }

  async getFileMetadata(cid: string): Promise<unknown> {
    try {
      const response = await this.localIpfsRequest.post(
        `/api/v0/object/stat?arg=${cid}`
      );
      return response.data;
    } catch {
      return null;
    }
  }
}

export const ipfsService = new IpfsService();
