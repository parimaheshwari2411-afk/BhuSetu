# 🚀 Land Registry Platform - Complete Windows Setup Guide

## Issues Found:
❌ PostgreSQL not running (or not installed)
❌ Anvil blockchain not running  
❌ Backend .env not configured
❌ Backend dependencies not installed

---

## ⚡ QUICK START (5 Minutes)

### Step 1: Setup Backend Environment

```powershell
cd backend
cp .env.example .env
```

Edit `backend\.env` with these values (minimum setup):

```env
NODE_ENV=development
PORT=3000

# Database (Default PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=land_registry
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secret (generate one)
JWT_SECRET=my_super_secret_key_at_least_32_characters_long_12345
JWT_EXPIRY=7d

# Blockchain (will setup Anvil next)
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CHAIN_ID=31337
SMART_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
REGISTRAR_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
REGISTRAR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476caded64e30b76620615e5d5d

# IPFS (Optional - Pinata or local)
PINATA_API_KEY=
PINATA_API_SECRET=
LOCAL_IPFS_URL=http://127.0.0.1:5001

# CORS
CORS_ORIGIN=http://localhost:5173

# Admin
ADMIN_EMAIL=admin@landregistry.gov.in
ADMIN_PASSWORD=Admin123!
```

### Step 2: Install Backend Dependencies

```powershell
cd backend
npm install
```

This will install all required packages (Express, TypeScript, PostgreSQL driver, etc.)

### Step 3: Install PostgreSQL

**Option A: Using Windows Installer (Easiest)**
1. Download: https://www.postgresql.org/download/windows/
2. Install PostgreSQL 15+
3. When prompted, set password for `postgres` user (use: `postgres`)
4. Keep port as 5432

**Option B: Using Chocolatey**
```powershell
# Install Chocolatey first if you don't have it
choco install postgresql15

# During install, set password to: postgres
```

**Option C: Using WSL2**
```bash
wsl
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

### Step 4: Create Database

Open PowerShell and run:

```powershell
# Create the database
psql -U postgres -c "CREATE DATABASE land_registry;"

# Verify
psql -U postgres -c "\l"  # Lists all databases
```

### Step 5: Install Foundry (Anvil)

```powershell
# Download and install Foundry
curl -L https://foundry.paradigm.xyz | bash

# Close and reopen PowerShell, then:
foundryup

# Verify
anvil --version
```

### Step 6: Run All Services (4 Terminals)

**Terminal 1: PostgreSQL** (Leave running)
```powershell
# Just verify it's running
psql -U postgres -c "SELECT version();"
# Should show PostgreSQL version
```

**Terminal 2: Anvil Blockchain**
```powershell
anvil --host 127.0.0.1 --port 8545
```

Expected output:
```
Available Accounts
==================
(0) 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
(1) 0x70997970C51812e339D9B73b0245ad59415F3e08 (10000 ETH)
...
Listening on 127.0.0.1:8545
```

**Copy these values to your `.env`:**
- `REGISTRAR_WALLET_ADDRESS` = Account #0 (e.g., 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
- `REGISTRAR_PRIVATE_KEY` = Private Key #0 (from "Private Keys" section)

**Terminal 3: Backend**
```powershell
cd backend
npm run db:migrate
npm run dev
```

Expected output:
```
✅ Database migrations completed
✅ Server listening on http://localhost:3000
✅ Blockchain RPC connected
✅ IPFS service ready
```

**Terminal 4: Test API**
```powershell
# Test health check
curl http://localhost:3000/api/v1/health

# Should return: {"status":"ok"}
```

---

## 🧪 TEST SIGN UP & LOGIN

### Test Registration:
```powershell
$body = @{
    email = "test@example.com"
    password = "Test123456!"
    fullName = "Test User"
    role = "CITIZEN"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "CITIZEN",
    "createdAt": "2024-01-01T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Test Login:
```powershell
$body = @{
    email = "test@example.com"
    password = "Test123456!"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "test@example.com",
      "role": "CITIZEN"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 🔍 VERIFY DATABASE

After registration, verify data in PostgreSQL:

```powershell
# Connect to database
psql -U postgres -d land_registry

# In psql prompt:
SELECT * FROM users;      # Should show your test user
SELECT * FROM land_parcels; # Should be empty initially
SELECT * FROM transactions; # Should be empty initially
\q  # Exit psql
```

---

## 🛠️ TROUBLESHOOTING

### Error: "Cannot connect to PostgreSQL"
```powershell
# Check if PostgreSQL is running
# Windows Services > PostgreSQL should be running

# Or start from command line:
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start

# Test connection:
psql -U postgres -c "SELECT 1"
```

### Error: "Port 3000 already in use"
```powershell
# Kill process on port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

### Error: "Port 8545 already in use"
```powershell
# Kill Anvil
Get-Process -Name anvil | Stop-Process -Force
```

### Error: "Cannot find module X"
```powershell
cd backend
npm install
```

### Error: "BLOCKCHAIN_RPC_URL not found"
Check your `.env` file has:
```env
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
```

### Error: Database migration fails
```powershell
cd backend

# Check what tables exist
psql -U postgres -d land_registry -c "\d"

# Try running migration manually
npm run db:migrate

# If still fails, recreate database:
psql -U postgres -c "DROP DATABASE IF EXISTS land_registry; CREATE DATABASE land_registry;"
npm run db:migrate
```

---

## ✅ VERIFICATION CHECKLIST

Run this after setup:

```powershell
# 1. Check all services running
Write-Host "Checking PostgreSQL..."
psql -U postgres -c "SELECT version();" > $null && Write-Host "✅ PostgreSQL OK" || Write-Host "❌ PostgreSQL FAILED"

Write-Host "Checking Anvil..."
curl -s -X POST http://127.0.0.1:8545 `
  -H "Content-Type: application/json" `
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | Tee-Object -Variable response > $null
if ($response) { Write-Host "✅ Anvil OK" } else { Write-Host "❌ Anvil FAILED" }

Write-Host "Checking Backend..."
curl -s http://localhost:3000/api/v1/health && Write-Host "✅ Backend OK" || Write-Host "❌ Backend FAILED"

# 2. Test registration
Write-Host "Testing Registration..."
# (Run the registration command above)
```

---

## 📚 API ENDPOINTS READY TO TEST

Once setup is complete, test these endpoints:

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---|
| `/api/v1/auth/register` | POST | Create new user | ❌ |
| `/api/v1/auth/login` | POST | Login user | ❌ |
| `/api/v1/auth/verify-token` | POST | Check token validity | ❌ |
| `/api/v1/parcels` | GET | List all parcels | ✅ |
| `/api/v1/parcels` | POST | Register new parcel | ✅ |
| `/api/v1/parcels/:id` | GET | Get parcel details | ✅ |
| `/api/v1/transfers` | POST | Initiate transfer | ✅ |
| `/api/v1/admin/pending-transfers` | GET | List pending transfers (REGISTRAR only) | ✅ |
| `/api/v1/admin/approve-transfer` | POST | Complete transfer (REGISTRAR only) | ✅ |

---

## 🎯 NEXT STEPS

After successful signup/login:
1. Frontend app (React + Leaflet) - Ready to build in `/src`
2. Create land parcels with GeoJSON
3. Initiate transfers
4. Test registrar approval workflow

All backend is ready! ✅

---

## 📞 NEED HELP?

Check these files:
- **Backend logs** → Terminal where you ran `npm run dev`
- **Database queries** → Open psql and query directly
- **Blockchain logs** → Terminal where you ran `anvil`
- **Configuration** → `backend/.env`
- **API docs** → `docs/TECHNICAL_DOCUMENTATION.pdf`
- **Demo script** → `docs/SIH_PRESENTATION_DECK.pdf` (Part 5: Live Demo)

