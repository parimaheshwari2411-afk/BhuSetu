# Land Registry Platform - Diagnostic Checklist

## 1. SETUP & PREREQUISITES

### Required Software
- [ ] Node.js 20+ installed
- [ ] npm or pnpm installed
- [ ] PostgreSQL 15+ running locally
- [ ] Anvil or Hardhat local blockchain
- [ ] IPFS node (optional but recommended)

### Check Installation
```bash
node --version
npm --version
psql --version
```

## 2. BACKEND SETUP

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Create Environment File
```bash
cp .env.example .env
```

**Edit `.env` with your values:**
```
NODE_ENV=development
PORT=3000

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=land_registry
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_EXPIRY=7d

# Blockchain (Anvil/Local)
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CHAIN_ID=31337
SMART_CONTRACT_ADDRESS=0x...
REGISTRAR_WALLET_ADDRESS=0x...
REGISTRAR_PRIVATE_KEY=0x...

# IPFS
PINATA_API_KEY=your_pinata_key
PINATA_API_SECRET=your_pinata_secret
LOCAL_IPFS_URL=http://127.0.0.1:5001

# CORS
CORS_ORIGIN=http://localhost:5173

# Admin
ADMIN_EMAIL=admin@landregistry.gov.in
ADMIN_PASSWORD=secure_password
```

### Step 3: Initialize Database
```bash
# Create PostgreSQL database
createdb land_registry

# Run migrations
npm run db:migrate
```

### Step 4: Start Backend
```bash
npm run dev
```

Expected output:
```
Server running on http://localhost:3000
Database connected: PostgreSQL
```

## 3. DATABASE VERIFICATION

### Test PostgreSQL Connection
```bash
psql -h localhost -U postgres -d land_registry -c "SELECT version();"
```

Expected: PostgreSQL version info

### Check PostGIS Extension
```sql
SELECT PostGIS_version();
SELECT * FROM information_schema.tables WHERE table_schema='public' LIMIT 5;
```

### Verify Tables Created
```bash
npm run db:migrate
```

Check tables in psql:
```sql
\d
```

Should show: `users`, `land_parcels`, `transactions`, `audit_log`

## 4. API TESTING

### Test Registration Endpoint
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "fullName": "Test User",
    "role": "CITIZEN"
  }'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "CITIZEN"
  },
  "token": "eyJhbGc..."
}
```

### Test Login Endpoint
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

Expected: JWT token returned

### Test Parcel Creation (Requires Auth)
```bash
curl -X POST http://localhost:3000/api/v1/parcels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ulpin": "AP01-2024-001",
    "location": {
      "state": "AP",
      "district": "Hyderabad",
      "taluka": "Hyderabad",
      "village": "Kukatpally"
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[78, 17], [78.1, 17], [78.1, 17.1], [78, 17.1], [78, 17]]]
    }
  }'
```

## 5. COMMON ISSUES & SOLUTIONS

### Issue: "Cannot find module" errors
**Solution:**
```bash
cd backend
npm install
npm run build
```

### Issue: Database connection refused
**Solution:**
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# If not, start PostgreSQL:
# On Mac: brew services start postgresql
# On Windows: Start PostgreSQL from Services
# On Linux: sudo systemctl start postgresql
```

### Issue: "EADDRINUSE: address already in use :3000"
**Solution:**
```bash
# Kill process on port 3000
lsof -i :3000  # Find PID
kill -9 <PID>

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: JWT_SECRET not set or too short
**Solution:**
```bash
# Generate a secure key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
JWT_SECRET=your_generated_key_here
```

### Issue: Smart contract not deployed
**Solution:**
```bash
cd backend
npm run contract:compile
npm run contract:deploy
```

## 6. BLOCKCHAIN SETUP (Anvil)

### Install Anvil
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Start Anvil Local Blockchain
```bash
anvil --host 0.0.0.0 --port 8545
```

Expected output:
```
Account #0: 0x1234... (balance: 10000 ETH)
...
Listening on 127.0.0.1:8545
```

### Get Account Details for .env
From Anvil output, copy:
- First account address → `REGISTRAR_WALLET_ADDRESS`
- First private key → `REGISTRAR_PRIVATE_KEY`
- Contract address after deployment → `SMART_CONTRACT_ADDRESS`

## 7. IPFS SETUP (Optional)

### Install IPFS
```bash
# Download from https://dist.ipfs.tech/#go-ipfs
# Or use: go-ipfs
```

### Start IPFS Node
```bash
ipfs daemon
```

Expected output:
```
Daemon is ready
API listening on /ip4/127.0.0.1/tcp/5001
```

## 8. COMPLETE STARTUP SEQUENCE

**Terminal 1: PostgreSQL**
```bash
# Ensure PostgreSQL is running
psql -U postgres
```

**Terminal 2: Anvil (Blockchain)**
```bash
anvil --host 0.0.0.0 --port 8545
```

**Terminal 3: IPFS Node (Optional)**
```bash
ipfs daemon
```

**Terminal 4: Backend Server**
```bash
cd backend
npm install
npm run db:migrate
npm run dev
```

**Terminal 5: Frontend (when ready)**
```bash
npm run dev
# Runs on http://localhost:5173
```

## 9. QUICK VERIFICATION CHECKLIST

Use this checklist to verify everything is working:

```
Backend Server Status:
curl http://localhost:3000/api/v1/health

Database Connection:
psql -h localhost -U postgres -d land_registry -c "SELECT COUNT(*) FROM users;"

Auth Registration:
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","fullName":"Test","role":"CITIZEN"}'

Auth Login:
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'

Blockchain Connection:
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

IPFS Connection (if running):
curl http://127.0.0.1:5001/api/v0/version
```

## 10. EXPECTED SUCCESS INDICATORS

✅ All services running without errors
✅ Database has tables: users, land_parcels, transactions, audit_log
✅ JWT tokens generate and validate
✅ Auth endpoints return 200/201 status codes
✅ Blockchain connection established (eth_blockNumber returns valid response)
✅ Parcel creation with GeoJSON works
✅ IPFS upload (if configured) returns IPFS CID

## 11. DEBUGGING HINTS

### Enable Debug Logging
```bash
# Add to .env
DEBUG=*
```

### Check Backend Logs
```bash
# Errors will show in Terminal 4 (backend)
# Look for:
# - "Database connected"
# - "Server listening on port 3000"
# - "Blockchain RPC connected"
```

### Test Database Directly
```bash
psql -h localhost -U postgres -d land_registry
> SELECT * FROM users;
> SELECT * FROM land_parcels;
```

### Test Blockchain
```bash
# Use cast (Foundry tool)
cast balance 0x1234... --rpc-url http://127.0.0.1:8545
```

---

**Need Help?** Check these files:
- Backend logs → Terminal output
- Database schema → `migrations/001_initial_schema.sql`
- API routes → `backend/src/routes/`
- Types → `backend/src/types/index.ts`
