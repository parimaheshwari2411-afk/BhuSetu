# Land Registry Platform - Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [API Specification](#api-specification)
5. [Smart Contracts](#smart-contracts)
6. [Deployment Guide](#deployment-guide)
7. [IPFS Integration](#ipfs-integration)
8. [Security Considerations](#security-considerations)

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                     │
│                      (Leaflet/Mapbox for GIS)                       │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Express.js API Gateway (TypeScript)              │
│                        /api/v1 Namespace                            │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌──────────────────┐ ┌────────────────────┐    │
│ │ Auth Service    │ │ Parcel Service   │ │ Transaction Svc    │    │
│ │ (JWT/Bcrypt)    │ │ (PostGIS)        │ │ (Multi-Sig Escrow) │    │
│ └─────────────────┘ └──────────────────┘ └────────────────────┘    │
│ ┌─────────────────┐ ┌──────────────────┐ ┌────────────────────┐    │
│ │ IPFS Service    │ │ Blockchain Svc   │ │ Admin Dashboard    │    │
│ │ (Pinata+Local)  │ │ (Ethers.js)      │ │ (Registrar Panel)  │    │
│ └─────────────────┘ └──────────────────┘ └────────────────────┘    │
└────────┬─────────────┬──────────────────┬──────────┬───────────────┘
         │             │                  │          │
         ▼             ▼                  ▼          ▼
    ┌────────┐   ┌──────────────┐   ┌─────────┐ ┌──────────┐
    │ IPFS   │   │ PostgreSQL   │   │ Anvil   │ │JWT Token │
    │ (P2P)  │   │ + PostGIS    │   │(Local)  │ │Storage   │
    │        │   │              │   │         │ │          │
    └────────┘   └──────────────┘   └─────────┘ └──────────┘
```

### Workflow: Land Transfer Process

```
Citizen Registers Land Parcel
        │
        ▼
PostGIS Spatial Validation
├─ ST_IsValid() - Check polygon topology
├─ ST_Intersects() - Prevent overlap with existing parcels
└─ ST_Area() - Calculate parcel area
        │
        ▼ (Valid)
Upload Deed Document to IPFS
├─ Try: Pinata Cloud API (Primary)
└─ Fallback: Local IPFS Node
        │
        ▼
Create Land Parcel Record (DB)
        │
        ▼
Seller Initiates Transfer
├─ Upload deed to IPFS
├─ Create transaction record
└─ Deploy multi-sig escrow on blockchain
        │
        ▼
Multi-Signature Approval Phase
├─ Seller approves (signs transaction)
├─ Buyer approves (signs transaction)
└─ Registrar approves & completes transfer
        │
        ▼ (All 3 approvals)
Ownership Transfer Complete
├─ Land parcel ownership updates
├─ Blockchain records transaction
└─ Audit log entry created
```

---

## Technology Stack

### Backend Services
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20+
- **Database**: PostgreSQL 15 + PostGIS 3.3
- **Authentication**: JWT + Bcryptjs
- **File Storage**: IPFS (Pinata + Local Node)
- **Blockchain**: Ethers.js v6 + Hardhat/Anvil

### Smart Contracts
- **Language**: Solidity 0.8.0+
- **Network**: Anvil (Local EVM)
- **Contracts**: LandTitleEscrow.sol (Multi-sig Escrow)

### Spatial Data
- **Database Extension**: PostGIS 3.3
- **Geometry Type**: GEOMETRY(Polygon, 4326) - WGS84
- **Indexing**: GIST Spatial Index

---

## Database Schema

### 1. Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    password_hash VARCHAR(255),
    role ENUM('CITIZEN', 'SURVEYOR', 'REGISTRAR'),
    e_kyc_verified BOOLEAN DEFAULT false,
    e_kyc_document_hash VARCHAR(255),
    wallet_address VARCHAR(42),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Indexes:**
- `idx_users_email` - For authentication
- `idx_users_wallet` - For blockchain operations

### 2. Land Parcels Table (PostGIS)
```sql
CREATE TABLE land_parcels (
    id UUID PRIMARY KEY,
    ulpin VARCHAR(50) UNIQUE,           -- Unique Land Parcel ID
    owner_id UUID REFERENCES users,
    geometry GEOMETRY(Polygon, 4326),   -- PostGIS column (WGS84)
    area_in_sq_meters DECIMAL(18, 4),   -- Auto-calculated
    total_value VARCHAR(255),
    location JSONB,                      -- {state, district, taluka, village}
    document_ipfs_cid VARCHAR(255),
    blockchain_hash VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Indexes:**
- `idx_land_parcels_geometry` - GIST Spatial Index
- `idx_land_parcels_owner` - Owner lookups
- `idx_land_parcels_ulpin` - Unique identification

**Constraints:**
- Spatial validity via `check_parcel_overlap()` trigger
- Auto area calculation via `calculate_parcel_area()` trigger

### 3. Transactions Table
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    parcel_id UUID REFERENCES land_parcels,
    buyer_id UUID REFERENCES users,
    seller_id UUID REFERENCES users,
    status ENUM('PENDING', 'LOCKED_IN_ESCROW', 'BUYER_APPROVED',
               'SELLER_APPROVED', 'REGISTRAR_APPROVED', 'COMPLETED',
               'REJECTED', 'CANCELLED'),
    deed_ipfs_cid VARCHAR(255),
    multi_sig_contract_address VARCHAR(42),
    multi_sig_tx_hash VARCHAR(255),
    buyer_approved_at TIMESTAMP,
    seller_approved_at TIMESTAMP,
    registrar_approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Indexes:**
- `idx_transactions_parcel` - Parcel lookups
- `idx_transactions_buyer` - Buyer history
- `idx_transactions_seller` - Seller history
- `idx_transactions_status` - Filter by status
- `idx_transactions_created` - Time-series queries

### 4. Audit Log Table
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    transaction_id UUID REFERENCES transactions,
    action VARCHAR(100),
    actor_id UUID REFERENCES users,
    details JSONB,
    created_at TIMESTAMP
);
```

### Key Constraints & Triggers

#### Spatial Validation Trigger
```sql
CREATE FUNCTION check_parcel_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM land_parcels
        WHERE id != NEW.id
        AND ST_Overlaps(geometry, NEW.geometry) = true
    ) THEN
        RAISE EXCEPTION 'Land parcel overlaps with existing parcel';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Auto Area Calculation
```sql
CREATE FUNCTION calculate_parcel_area()
RETURNS TRIGGER AS $$
BEGIN
    NEW.area_in_sq_meters := ST_Area(NEW.geometry::geography) / 10000.0;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## API Specification

### Base URL
```
http://localhost:3000/api/v1
```

### 1. Authentication Endpoints

#### POST /auth/register
Register new user
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+91-9876543210",
  "role": "CITIZEN",
  "password": "secure_password_123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "CITIZEN",
    "eKycVerified": false
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### POST /auth/login
Authenticate user
```json
{
  "email": "john@example.com",
  "password": "secure_password_123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "fullName": "John Doe",
      "email": "john@example.com",
      "role": "CITIZEN"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 2. Parcels Endpoints

#### POST /parcels
Register new land parcel with spatial validation
```json
{
  "ulpin": "AP01-2024-001",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[78.0, 17.0], [78.1, 17.0], [78.1, 17.1], [78.0, 17.1], [78.0, 17.0]]]
  },
  "location": {
    "state": "Andhra Pradesh",
    "district": "Hyderabad",
    "taluka": "Hyderabad",
    "village": "Kukatpally"
  },
  "totalValue": "1000000000000000000"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ulpin": "AP01-2024-001",
    "ownerId": "user_uuid",
    "areaInSqMeters": 2500,
    "location": {...}
  },
  "message": "Land parcel registered successfully",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /parcels/:id
Get parcel details with GeoJSON
```
GET /api/v1/parcels/uuid
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ulpin": "AP01-2024-001",
    "ownerId": "user_uuid",
    "geometry": {
      "type": "Polygon",
      "coordinates": [...]
    },
    "areaInSqMeters": 2500,
    "blockchainHash": "0x1234..."
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /parcels/spatial/geojson
Get all parcels as GeoJSON FeatureCollection (for Leaflet/Mapbox)
```
GET /api/v1/parcels/spatial/geojson?limit=1000
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": "parcel_uuid",
        "properties": {
          "ulpin": "AP01-2024-001",
          "areaInSqMeters": 2500
        },
        "geometry": {...}
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /parcels/search/bbox
Find parcels within bounding box
```
GET /api/v1/parcels/search/bbox?minX=78.0&minY=17.0&maxX=78.2&maxY=17.2&limit=100
```

#### GET /parcels/search/nearest
Find nearest parcels to a point
```
GET /api/v1/parcels/search/nearest?longitude=78.1&latitude=17.1&radius=1000&limit=10
```

### 3. Transfers Endpoints

#### POST /transfers
Initiate land transfer with deed document
```
POST /api/v1/transfers
Content-Type: multipart/form-data

body:
{
  "parcelId": "parcel_uuid",
  "buyerId": "buyer_uuid",
  "registrarAddress": "0x1234...",
  "deed": <PDF file>
}

Headers:
Authorization: Bearer <JWT_TOKEN>
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "transaction_uuid",
    "parcelId": "parcel_uuid",
    "buyerId": "buyer_uuid",
    "sellerId": "seller_uuid",
    "status": "PENDING",
    "deedIpfsCid": "Qm...",
    "multiSigTxHash": "0x..."
  },
  "message": "Transfer initiated successfully",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### POST /transfers/:id/approve
Approve transfer by buyer or seller
```json
{
  "signature": "0x..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "approver": "SELLER",
    "blockchainTxHash": "0x..."
  },
  "message": "SELLER approval recorded",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /transfers?status=PENDING&page=1&pageSize=20
Get all transfers with filtering
```
GET /api/v1/transfers?status=PENDING&buyerId=buyer_uuid&page=1&pageSize=20
```

### 4. Admin Endpoints (Registrar Only)

#### GET /admin/pending-transfers
Get all pending transfers for registrar approval
```
GET /api/v1/admin/pending-transfers?page=1&pageSize=20
```

**Headers:**
```
Authorization: Bearer <REGISTRAR_JWT_TOKEN>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "transaction_uuid",
      "parcelId": "parcel_uuid",
      "ulpin": "AP01-2024-001",
      "seller": {
        "id": "seller_uuid",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "buyer": {
        "id": "buyer_uuid",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "status": "LOCKED_IN_ESCROW",
      "deedIpfsCid": "Qm...",
      "sellerApprovedAt": "2024-01-01T10:00:00Z",
      "buyerApprovedAt": "2024-01-01T11:00:00Z",
      "createdAt": "2024-01-01T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### POST /admin/approve-transfer
Registrar approves and completes transfer
```json
{
  "transactionId": "transaction_uuid"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "status": "COMPLETED",
    "blockchainTxHash": "0x...",
    "message": "Transfer approved and completed"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /admin/statistics
Get registrar dashboard statistics
```
GET /api/v1/admin/statistics
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": {
      "citizens": 1000,
      "surveyors": 50
    },
    "parcels": {
      "total": 5000,
      "totalAreaSqMeters": 50000000
    },
    "transfers": {
      "pending": 25,
      "completed": 450,
      "inEscrow": 15,
      "failed": 10
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## Smart Contracts

### LandTitleEscrow.sol

#### State Variables
```solidity
mapping(string => Escrow) public escrows;
address public registrarAddress;
address public owner;
```

#### Escrow Struct
```solidity
struct Escrow {
    string transactionId;
    string parcelId;
    address seller;
    address buyer;
    address registrar;
    uint256 amount;
    EscrowStatus status;
    bool sellerApproved;
    bool buyerApproved;
    bool registrarApproved;
    uint256 createdAt;
    uint256 completedAt;
    string ipfsDocumentCid;
}
```

#### Key Functions

**createEscrow()**
- Creates new multi-sig escrow
- Sets status to LOCKED_IN_ESCROW
- Requires owner (backend) to call

**approveTransfer()**
- Approves transfer by seller, buyer, or registrar
- Updates approval status
- Automatically updates escrow status

**completeTransfer()**
- Completes transfer after all approvals
- Only callable by registrar
- Emits TransferCompleted event

**Events:**
```solidity
event EscrowCreated(string transactionId, string parcelId, address seller, address buyer, uint256 amount);
event TransferApproved(string transactionId, string role, address approver);
event TransferCompleted(string transactionId, address newOwner, uint256 timestamp);
event TransferRejected(string transactionId, string reason, uint256 timestamp);
```

---

## Deployment Guide

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- PostgreSQL 15
- Anvil/Hardhat (for local blockchain)
- IPFS Node (or Pinata account)

### Quick Start (Docker Compose)

```bash
# 1. Clone repository
git clone <repo-url>
cd land-registry

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# 3. Start services
docker-compose up -d

# 4. Check logs
docker-compose logs -f backend

# 5. Access services
# API: http://localhost:3000/api/v1
# IPFS: http://localhost:5001
# Anvil: http://localhost:8545
# Postgres: localhost:5432
```

### Manual Setup

#### 1. PostgreSQL Setup
```bash
# Create database
createdb land_registry

# Install PostGIS
psql land_registry
CREATE EXTENSION postgis;
CREATE EXTENSION uuid-ossp;

# Run migrations
psql land_registry < migrations/001_initial_schema.sql
```

#### 2. IPFS Setup
```bash
# Install and start local IPFS
ipfs daemon

# IPFS will be available at http://127.0.0.1:5001
```

#### 3. Blockchain Setup
```bash
# Start Anvil
anvil --host 0.0.0.0 --accounts 10

# Deploy smart contract
cd backend
npm run contract:compile
npm run contract:deploy
```

#### 4. Backend Setup
```bash
cd backend
npm install
npm run build
npm run db:migrate
npm run dev
```

---

## IPFS Integration

### Dual-Mode File Storage

#### Primary: Pinata Cloud
```typescript
// Configuration
PINATA_API_KEY=<your_pinata_key>
PINATA_API_SECRET=<your_pinata_secret>
PINATA_GATEWAY=https://gateway.pinata.cloud
```

**Advantages:**
- Persistent pinning
- High availability
- Global CDN access

#### Fallback: Local IPFS Node
```typescript
// Configuration
LOCAL_IPFS_URL=http://127.0.0.1:5001
```

**Advantages:**
- Zero external dependency
- Complete data control
- Fast local access

### File Upload Flow
```
1. Submit deed PDF to backend
2. Backend attempts Pinata upload
3. If Pinata fails:
   - Fallback to local IPFS node
   - Upload via HTTP API
4. Return immutable CID
5. Store CID in database
```

### Retrieving Files
```typescript
// Access file from any gateway
https://gateway.pinata.cloud/ipfs/Qm...
OR
http://localhost:8080/ipfs/Qm...
```

---

## Security Considerations

### 1. Authentication & Authorization
- ✅ JWT tokens with 7-day expiry
- ✅ Bcryptjs password hashing (10 rounds)
- ✅ Role-based access control (CITIZEN, SURVEYOR, REGISTRAR)
- ⚠️ TODO: Implement 2FA for registrar

### 2. Data Integrity
- ✅ Spatial validation via PostGIS triggers
- ✅ Blockchain-backed ownership records
- ✅ Immutable deed documents on IPFS
- ✅ Audit log for all transactions

### 3. Smart Contract Security
- ✅ Multi-signature requirement (3-of-3)
- ✅ State machine prevents double-spending
- ✅ Access control modifiers
- ⚠️ TODO: External security audit

### 4. API Security
- ✅ CORS configuration
- ✅ Input validation (Joi)
- ✅ Rate limiting (recommended)
- ✅ HTTPS enforcement (production)

### 5. Database Security
- ✅ SQL injection prevention (parameterized queries)
- ✅ Row-level security (TODO: implement in production)
- ✅ Encrypted connections
- ⚠️ TODO: Database encryption at rest

### 6. File Upload Security
- ✅ File type validation
- ✅ File size limits (50MB)
- ✅ Virus scanning (recommended)
- ✅ Immutable IPFS storage

### Recommendations for Production
1. Enable SSL/TLS certificates
2. Implement rate limiting (express-rate-limit)
3. Add request logging & monitoring
4. Set up database backups
5. Enable CORS restrictively
6. Use environment-based secrets
7. Implement emergency pause function
8. Regular security audits

---

## Performance Optimization

### Database Indexes
All critical queries have indexes:
- GIST index on `land_parcels.geometry` for spatial queries
- B-tree indexes on foreign keys and common filters
- Composite indexes for complex queries

### Query Optimization
- Pagination on all list endpoints
- Spatial query limits (default: 1000 records)
- Database connection pooling (max 20 connections)

### Caching Strategy
- JWT token caching in client
- IPFS content addressed caching
- Database query result caching (optional Redis)

---

## Monitoring & Logging

### Log Levels
- INFO: API requests, migrations, deployments
- WARN: Spatial validation failures, IPFS fallbacks
- ERROR: Database errors, blockchain failures
- DEBUG: Detailed application state (development only)

### Key Metrics to Monitor
- API response times
- Database query performance
- IPFS upload/retrieval times
- Blockchain transaction confirmation times
- Storage usage (database, IPFS)
- Spatial query performance

---

## Troubleshooting

### Common Issues

**1. PostGIS Extension Not Found**
```sql
-- Verify installation
SELECT postgis_version();

-- If missing, install:
sudo apt-get install postgresql-15-postgis-3
```

**2. IPFS Upload Fails**
```bash
# Check local IPFS daemon
curl http://127.0.0.1:5001/api/v0/id

# Restart if needed
ipfs shutdown
ipfs daemon
```

**3. Blockchain Connection Failed**
```bash
# Verify Anvil is running
curl http://127.0.0.1:8545

# Restart Anvil
anvil --host 0.0.0.0
```

**4. Spatial Query Slow**
```sql
-- Rebuild spatial index
REINDEX INDEX idx_land_parcels_geometry;

-- Analyze query plan
EXPLAIN ANALYZE SELECT * FROM land_parcels WHERE ST_Contains(geometry, point);
```

---

## Additional Resources

- [PostGIS Documentation](https://postgis.net/documentation/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [IPFS Documentation](https://docs.ipfs.io/)
- [Express.js Guide](https://expressjs.com/)
- [Solidity Best Practices](https://solidity.readthedocs.io/)

