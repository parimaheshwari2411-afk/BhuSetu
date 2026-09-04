// User Types
export enum UserRole {
  CITIZEN = "CITIZEN",
  SURVEYOR = "SURVEYOR",
  REGISTRAR = "REGISTRAR",
}

export interface IUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  eKycVerified: boolean;
  eKycDocumentHash: string | null;
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

// Land Parcel Types
export interface ILandParcel {
  id: string;
  ulpin: string; // Unique Land Parcel Identification Number
  ownerId: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  areaInSqMeters: number;
  totalValue: string; // in Wei
  location: {
    state: string;
    district: string;
    taluka: string;
    village: string;
  };
  documentIpfsCid: string | null;
  blockchainHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction Types
export enum TransactionStatus {
  PENDING = "PENDING",
  LOCKED_IN_ESCROW = "LOCKED_IN_ESCROW",
  BUYER_APPROVED = "BUYER_APPROVED",
  SELLER_APPROVED = "SELLER_APPROVED",
  REGISTRAR_APPROVED = "REGISTRAR_APPROVED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export interface ITransaction {
  id: string;
  parcelId: string;
  buyerId: string;
  sellerId: string;
  status: TransactionStatus;
  deedIpfsCid: string;
  multiSigContractAddress: string;
  multiSigTxHash: string | null;
  buyerApprovedAt: Date | null;
  sellerApprovedAt: Date | null;
  registrarApprovedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Spatial Validation Types
export interface ISpatialValidationResult {
  isValid: boolean;
  topologyValid: boolean;
  areaInSqMeters: number;
  intersectingParcels: string[];
  errors: string[];
}

export interface IGeometryInput {
  type: "Polygon";
  coordinates: number[][][];
}

// IPFS Upload Types
export interface IIpfsUploadResult {
  success: boolean;
  cid: string;
  gateway: string;
  pinned: boolean;
  timestamp: Date;
}

// Blockchain Types
export interface IMultiSigApproval {
  transactionId: string;
  role: UserRole;
  signature: string;
  timestamp: Date;
}

export interface ISmartContractState {
  parcelId: string;
  status: TransactionStatus;
  seller: string;
  buyer: string;
  registrar: string;
  sellerApproved: boolean;
  buyerApproved: boolean;
  registrarApproved: boolean;
}

// API Response Types
export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  timestamp: Date;
}
