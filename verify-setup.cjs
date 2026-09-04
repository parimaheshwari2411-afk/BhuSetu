#!/usr/bin/env node

/**
 * Land Registry Platform - Quick Setup & Test Script
 * Run this to verify your setup and identify issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function check(name, condition, errorMsg = '') {
  if (condition) {
    log(`✅ ${name}`, 'green');
    return true;
  } else {
    log(`❌ ${name}`, 'red');
    if (errorMsg) log(`   ${errorMsg}`, 'yellow');
    return false;
  }
}

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (e) {
    return null;
  }
}

log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
log('║   Land Registry Platform - System Diagnostic Tool          ║', 'cyan');
log('╚════════════════════════════════════════════════════════════╝\n', 'cyan');

let allGood = true;

// 1. Check Node & npm
log('\n📦 CHECKING PREREQUISITES', 'blue');
const nodeVersion = exec('node --version');
allGood &= check('Node.js installed', !!nodeVersion, nodeVersion ? '' : 'Install Node.js 20+');

const npmVersion = exec('npm --version');
allGood &= check('npm installed', !!npmVersion, npmVersion ? '' : 'Install npm');

// 2. Check project structure
log('\n📁 CHECKING PROJECT STRUCTURE', 'blue');
allGood &= check('backend/ directory exists', fs.existsSync('backend'));
allGood &= check('contracts/ directory exists', fs.existsSync('contracts'));
allGood &= check('migrations/ directory exists', fs.existsSync('migrations'));
allGood &= check('docs/ directory exists', fs.existsSync('docs'));
allGood &= check('backend/package.json exists', fs.existsSync('backend/package.json'));

// 3. Check environment setup
log('\n⚙️  CHECKING ENVIRONMENT CONFIGURATION', 'blue');
const envExists = fs.existsSync('backend/.env');
check('backend/.env file exists', envExists, 'Copy backend/.env.example to backend/.env');

if (envExists) {
  const env = fs.readFileSync('backend/.env', 'utf-8');
  check('DB_HOST configured', env.includes('DB_HOST'));
  check('DB_USER configured', env.includes('DB_USER'));
  check('JWT_SECRET configured', env.includes('JWT_SECRET') && !env.includes('JWT_SECRET=your_'));
  check('BLOCKCHAIN_RPC_URL configured', env.includes('BLOCKCHAIN_RPC_URL'));
}

// 4. Check dependencies
log('\n📚 CHECKING BACKEND DEPENDENCIES', 'blue');
const packageJson = JSON.parse(fs.readFileSync('backend/package.json', 'utf-8'));
const nodeModulesExist = fs.existsSync('backend/node_modules');
check('Backend node_modules installed', nodeModulesExist, 'Run: cd backend && npm install');

// 5. Check external services
log('\n🔌 CHECKING EXTERNAL SERVICES', 'blue');

const postgresqlRunning = exec('psql -U postgres -c "SELECT 1" 2>/dev/null');
check('PostgreSQL running', !!postgresqlRunning, 'Start PostgreSQL or install: https://www.postgresql.org/');

const anvilRunning = exec('curl -s http://127.0.0.1:8545 -X POST -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}\' 2>/dev/null');
check('Anvil/Hardhat local blockchain running', !!anvilRunning, 'Start with: anvil or hardhat node');

const ipfsRunning = exec('curl -s http://127.0.0.1:5001/api/v0/version 2>/dev/null');
check('IPFS node running', !!ipfsRunning, '(Optional) Start with: ipfs daemon');

// 6. Summary
log('\n📊 SETUP SUMMARY', 'blue');
if (allGood) {
  log('✅ All critical checks passed!', 'green');
  log('\n📋 NEXT STEPS:', 'cyan');
  log('1. cd backend');
  log('2. npm run db:migrate   # Initialize database');
  log('3. npm run dev          # Start backend server');
  log('4. Test API: curl http://localhost:3000/api/v1/health');
} else {
  log('⚠️  Some checks failed. Follow the instructions above.', 'yellow');
  log('\n📋 QUICK SETUP GUIDE:', 'cyan');
  log('\n1. Install PostgreSQL:');
  log('   Windows: https://www.postgresql.org/download/windows/');
  log('   Mac: brew install postgresql');
  log('   Linux: sudo apt-get install postgresql');
  log('\n2. Create database:');
  log('   psql -U postgres -c "CREATE DATABASE land_registry;"');
  log('\n3. Install Anvil:');
  log('   curl -L https://foundry.paradigm.xyz | bash');
  log('   foundryup');
  log('\n4. Start services (in separate terminals):');
  log('   Terminal 1: postgre (already running or start service)');
  log('   Terminal 2: anvil --host 127.0.0.1 --port 8545');
  log('   Terminal 3: ipfs daemon (optional)');
  log('\n5. Start backend:');
  log('   cd backend');
  log('   npm install');
  log('   npm run db:migrate');
  log('   npm run dev');
}

log('\n📖 For detailed help, see: DIAGNOSTIC.md\n', 'cyan');
