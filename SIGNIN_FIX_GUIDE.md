# 🎯 YOUR SIGN-IN ISN'T WORKING - HERE'S WHAT TO DO

## The Issue
The sign-in (authentication endpoints) requires:
- ❌ PostgreSQL database running locally
- ❌ Backend server running on port 3000
- ❌ Blockchain (Anvil) running on port 8545

## What's Already Done ✅
- ✅ Backend code fully written and ready
- ✅ Authentication endpoints implemented
- ✅ All 1,083 npm packages installed
- ✅ Configuration template created (.env)
- ✅ Testing tools provided

## How to Fix Sign-In (30 Minutes)

### Step 1: Install PostgreSQL (10 minutes)
```
1. Download: https://www.postgresql.org/download/windows/
2. Run installer, keep default settings
3. When asked for password: type "postgres"
4. Finish installation
```

### Step 2: Install Foundry + Anvil (5 minutes)
```powershell
# Open PowerShell and run:
curl -L https://foundry.paradigm.xyz | bash

# Close PowerShell and open a NEW one, then:
foundryup
```

### Step 3: Start PostgreSQL
```powershell
# Option A: Use Windows Services
# 1. Press Windows + R
# 2. Type: services.msc
# 3. Find "postgresql-x64-15"
# 4. Click "Start" if it's not running

# Option B: Command line
psql -U postgres -c "SELECT version();"
# Should show PostgreSQL version
```

### Step 4: Create Database
```powershell
psql -U postgres -c "CREATE DATABASE land_registry;"
```

### Step 5: Open 3 PowerShell Windows (Terminals)

**Terminal 1: Keep PostgreSQL running**
```powershell
# Just verify it's working:
psql -U postgres -c "SELECT 1;"
# Should return: 1
```

**Terminal 2: Start Anvil Blockchain**
```powershell
anvil --host 127.0.0.1 --port 8545
```

Expected output:
```
Available Accounts
==================
(0) 0x1234... (10000 ETH)
...
Private Keys
============
(0) 0x5678... (⚠️ DO NOT SHARE OR COMMIT TO REPO)
...
Listening on 127.0.0.1:8545
```

**⚠️ IMPORTANT SECURITY NOTE:**
- Copy your actual addresses from Anvil output
- NEVER commit real private keys to the repository
- NEVER share private keys in documentation
- Use .env file (which is .gitignored) for real secrets

**Terminal 3: Start Backend Server**
```powershell
cd backend
npm run db:migrate
npm run dev
```

Expected output:
```
✅ Server listening on http://localhost:3000
✅ Database connected
✅ Blockchain RPC connected
```

### Step 6: Test Sign-In (Terminal 4)

```powershell
# Test User Registration
curl -X POST http://localhost:3000/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "fullName": "Test User",
    "role": "CITIZEN"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400...",
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "CITIZEN"
  },
  "token": "eyJhbGc..."
}
```

### Step 7: Test Login
```powershell
curl -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "Test123456!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {"id": "550e...", "email": "test@example.com"},
    "token": "eyJhbGc..."
  }
}
```

✅ **SIGN-IN WORKING!**

---

## Troubleshooting

### "Cannot connect to database"
```powershell
# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1;"

# If failed, start PostgreSQL:
# Windows Services → postgresql-x64-15 → Start
```

### "Port 3000 already in use"
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

### "Port 8545 already in use"
```powershell
Get-Process -Name anvil | Stop-Process -Force
```

### "Cannot find module X"
```powershell
cd backend
npm install
```

### "Database migration fails"
```powershell
# Recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS land_registry; CREATE DATABASE land_registry;"

# Then run migration
cd backend
npm run db:migrate
```

---

## Automated Test Suite

Once all services are running, run the complete test:

```powershell
.\test-api.ps1
```

This will test:
- ✅ Health check
- ✅ User registration
- ✅ User login
- ✅ Parcel creation (spatial validation)
- ✅ Parcel listing
- ✅ Database connection
- ✅ Blockchain connection

---

## What's Happening When You Sign In

1. **Registration endpoint receives:**
   - Email, password, full name, role

2. **Backend processes:**
   - Validates input
   - Hashes password with bcryptjs
   - Stores user in PostgreSQL
   - Generates JWT token

3. **Response sent:**
   - User data (id, email, name, role)
   - JWT token (7-day expiry)

4. **Login endpoint:**
   - Validates email & password
   - Compares password hash
   - Generates new JWT token
   - Returns token for future requests

---

## API Endpoints Available After Sign-In

Using your JWT token from login, you can now access:

```powershell
# Get protected endpoint (requires token)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/parcels

# Create parcel (with spatial validation)
curl -X POST http://localhost:3000/api/v1/parcels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ulpin": "AP01-2024-001",
    "location": {...},
    "geometry": {...}
  }'

# Initiate land transfer
curl -X POST http://localhost:3000/api/v1/transfers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Complete Setup Checklist

```
[ ] PostgreSQL installed & running
[ ] Foundry + Anvil installed
[ ] Database created (land_registry)
[ ] Backend dependencies installed (1,083 packages)
[ ] Terminal 1: PostgreSQL verified
[ ] Terminal 2: Anvil running on port 8545
[ ] Terminal 3: Backend running on port 3000
[ ] Terminal 4: User registration works
[ ] Terminal 4: User login works
[ ] All tests pass: .\test-api.ps1
```

---

## Documentation Files

- **README.md** - Start here
- **SETUP_WINDOWS.md** - Complete setup guide
- **DIAGNOSTIC.md** - Troubleshooting
- **TECHNICAL_DOCUMENTATION.pdf** - Architecture & API
- **SIH_PRESENTATION_DECK.pdf** - Demo presentation

---

## Still Having Issues?

1. Run diagnostic: `node verify-setup.cjs`
2. Check logs in the terminal where backend is running
3. Read DIAGNOSTIC.md for detailed troubleshooting
4. Check TECHNICAL_DOCUMENTATION.pdf for API details

---

**Once you follow these steps, sign-in will be working! ✅**

Estimated time: 30-45 minutes
Status after setup: Backend fully operational
Next: Test all endpoints with test-api.ps1
