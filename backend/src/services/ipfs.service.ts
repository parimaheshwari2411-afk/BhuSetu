import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { IIpfsUploadResult } from "../types";

class IpfsService {
  private pinataApiKey: string;
  private pinataApiSecret: string;
  private pinataGateway: string;
  private localIpfsUrl: string;
  private pinataPinRequest: AxiosInstance;
  private localIpfsRequest: AxiosInstance;

  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY || "";
    this.pinataApiSecret = process.env.PINATA_API_SECRET || "";
    this.pinataGateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
    this.localIpfsUrl = process.env.LOCAL_IPFS_URL || "http://127.0.0.1:5001";

    this.pinataPinRequest = axios.create({
      baseURL: "https://api.pinata.cloud",
      headers: {
        pinata_api_key: this.pinataApiKey,
        pinata_secret_api_key: this.pinataApiSecret,
      },
    });

    this.localIpfsRequest = axios.create({
      baseURL: this.localIpfsUrl,
      timeout: 30000,
    });
  }

  /**
   * Upload file to IPFS with Pinata primary, local fallback
   */
  async uploadFile(
    filePath: string,
    fileName: string
  ): Promise<IIpfsUploadResult> {
    try {
      // Try Pinata first
      if (this.pinataApiKey && this.pinataApiSecret) {
        try {
          const result = await this.uploadToPinata(filePath, fileName);
          if (result) return result;
        } catch (pinataError) {
          console.warn("Pinata upload failed, falling back to local IPFS:", pinataError);
        }
      }

      // Fallback to local IPFS
      const result = await this.uploadToLocalIpfs(filePath, fileName);
      return result;
    } catch (error) {
      console.error("IPFS upload failed:", error);
      throw new Error("Failed to upload file to IPFS");
    }
  }

  /**
   * Upload to Pinata Cloud (Primary)
   */
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
      {
        headers: form.getHeaders(),
      }
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

  /**
   * Upload to Local IPFS Node (Fallback)
   */
  private async uploadToLocalIpfs(
    filePath: string,
    fileName: string
  ): Promise<IIpfsUploadResult> {
    const fileStream = fs.createReadStream(filePath);
    const form = new FormData();
    form.append("file", fileStream, fileName);

    const response = await this.localIpfsRequest.post(
      "/api/v0/add?wrap-with-directory=true",
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const lastEntry = response.data.trim().split("\n").pop();
    const parsedEntry = JSON.parse(lastEntry);
    const cid = parsedEntry.Hash;

    return {
      success: true,
      cid,
      gateway: `${this.localIpfsUrl}/ipfs/${cid}`,
      pinned: false,
      timestamp: new Date(),
    };
  }

  /**
   * Retrieve file from IPFS
   */
  async retrieveFile(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(
        `${this.pinataGateway}/ipfs/${cid}`,
        {
          responseType: "arraybuffer",
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("IPFS retrieval failed:", error);
      throw new Error("Failed to retrieve file from IPFS");
    }
  }

  /**
   * Pin a CID to local node
   */
  async pinCid(cid: string): Promise<boolean> {
    try {
      await this.localIpfsRequest.post(
        `/api/v0/pin/add?arg=${cid}`
      );
      return true;
    } catch (error) {
      console.error("Failed to pin CID:", error);
      return false;
    }
  }

  /**
   * Get file metadata from IPFS
   */
  async getFileMetadata(cid: string): Promise<any> {
    try {
      const response = await this.localIpfsRequest.post(
        `/api/v0/object/stat?arg=${cid}`
      );
      return response.data;
    } catch (error) {
      console.error("Failed to get file metadata:", error);
      return null;
    }
  }
}

export const ipfsService = new IpfsService();
