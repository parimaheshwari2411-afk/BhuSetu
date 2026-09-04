#!/usr/bin/env pwsh
# Land Registry Platform - API Test Script
# Run this after starting: PostgreSQL + Anvil + Backend
# Usage: .\test-api.ps1

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Land Registry Platform - API Test Suite                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$apiUrl = "http://localhost:3000/api/v1"
$testResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body,
        [string]$Token = $null
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Blue
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json
            $response = Invoke-WebRequest -Uri "$apiUrl$Endpoint" `
                -Method $Method `
                -Headers $headers `
                -Body $bodyJson `
                -TimeoutSec 10
        } else {
            $response = Invoke-WebRequest -Uri "$apiUrl$Endpoint" `
                -Method $Method `
                -Headers $headers `
                -TimeoutSec 10
        }
        
        $data = $response.Content | ConvertFrom-Json
        Write-Host "  ✅ Success (HTTP $($response.StatusCode))" -ForegroundColor Green
        
        $testResults += @{
            Test = $Name
            Status = "PASS"
            Response = $data
        }
        
        return $data
    }
    catch {
        Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        
        $testResults += @{
            Test = $Name
            Status = "FAIL"
            Error = $_.Exception.Message
        }
        
        return $null
    }
}

# Test 1: Health Check
Write-Host "`n--- Test 1: Health Check ---" -ForegroundColor Yellow
$health = Test-Endpoint -Name "API Health" -Method "GET" -Endpoint "/health"

# Test 2: User Registration
Write-Host "`n--- Test 2: User Registration ---" -ForegroundColor Yellow
$registerBody = @{
    email = "citizen$(Get-Random)@example.com"
    password = "Test123456!"
    fullName = "Test Citizen"
    role = "CITIZEN"
}
$registerResponse = Test-Endpoint -Name "Register User" -Method "POST" -Endpoint "/auth/register" -Body $registerBody

$testEmail = $registerBody.email
$testPassword = $registerBody.password
$testToken = $registerResponse.token

# Test 3: User Login
Write-Host "`n--- Test 3: User Login ---" -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = $testPassword
}
$loginResponse = Test-Endpoint -Name "Login User" -Method "POST" -Endpoint "/auth/login" -Body $loginBody

# Test 4: Get User Profile (Protected)
Write-Host "`n--- Test 4: Protected Endpoint ---" -ForegroundColor Yellow
Test-Endpoint -Name "Get User Profile" -Method "GET" -Endpoint "/auth/profile" -Token $testToken

# Test 5: Create Land Parcel
Write-Host "`n--- Test 5: Create Land Parcel ---" -ForegroundColor Yellow
$parcelBody = @{
    ulpin = "AP01-2024-$(Get-Random -Minimum 1000 -Maximum 9999)"
    location = @{
        state = "AP"
        district = "Hyderabad"
        taluka = "Hyderabad"
        village = "Kukatpally"
    }
    geometry = @{
        type = "Polygon"
        coordinates = @(@(
            @(78, 17),
            @(78.1, 17),
            @(78.1, 17.1),
            @(78, 17.1),
            @(78, 17)
        ))
    }
}
$parcelResponse = Test-Endpoint -Name "Create Parcel" -Method "POST" -Endpoint "/parcels" -Body $parcelBody -Token $testToken

# Test 6: List Parcels
Write-Host "`n--- Test 6: List Parcels ---" -ForegroundColor Yellow
Test-Endpoint -Name "List Parcels" -Method "GET" -Endpoint "/parcels" -Token $testToken

# Test 7: Get Parcels as GeoJSON
Write-Host "`n--- Test 7: Get GeoJSON ---" -ForegroundColor Yellow
Test-Endpoint -Name "Get GeoJSON" -Method "GET" -Endpoint "/parcels/spatial/geojson" -Token $testToken

# Test 8: Verify Database
Write-Host "`n--- Test 8: Database Verification ---" -ForegroundColor Yellow
Write-Host "Checking database..." -ForegroundColor Cyan
try {
    $dbCheck = psql -U postgres -d land_registry -c "SELECT COUNT(*) as user_count FROM users;" 2>$null
    if ($dbCheck) {
        Write-Host "  ✅ Database connected" -ForegroundColor Green
        Write-Host "  $dbCheck" -ForegroundColor Gray
    }
}
catch {
    Write-Host "  ❌ Database check failed (PostgreSQL might not be running)" -ForegroundColor Red
}

# Test 9: Verify Blockchain
Write-Host "`n--- Test 9: Blockchain Connection ---" -ForegroundColor Yellow
Write-Host "Checking Anvil..." -ForegroundColor Cyan
try {
    $blockchainCheck = curl -s -X POST http://127.0.0.1:8545 `
        -H "Content-Type: application/json" `
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>$null
    if ($blockchainCheck) {
        Write-Host "  ✅ Blockchain connected" -ForegroundColor Green
    }
}
catch {
    Write-Host "  ❌ Blockchain check failed (Anvil might not be running)" -ForegroundColor Red
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Test Summary                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count

Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red

if ($failCount -eq 0) {
    Write-Host "`n✅ All API tests passed! Your system is working correctly." -ForegroundColor Green
    Write-Host "`nYou can now:" -ForegroundColor Cyan
    Write-Host "  1. Test parcel creation with spatial validation"
    Write-Host "  2. Initiate land transfers"
    Write-Host "  3. Test multi-signature approvals"
    Write-Host "  4. Build the frontend React app"
}
else {
    Write-Host "`n⚠️  Some tests failed. Check the errors above." -ForegroundColor Yellow
    Write-Host "`nMake sure all services are running:" -ForegroundColor Cyan
    Write-Host "  - PostgreSQL (port 5432)"
    Write-Host "  - Anvil (port 8545)"
    Write-Host "  - Backend (port 3000)"
}

Write-Host "`n"
