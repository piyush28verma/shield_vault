import express from 'express';
import cors from 'cors';
import http from 'http';
import { generateRandomGrid, verifyResponse } from './src/cryptoHelper.js';

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Database for a single user/device configuration
let vaultConfig = {
  registered: false,
  pathIndices: [],
  recoveryCode: '',
  secretContent: 'SEED PHRASE: dynamic zebra rocket manual puzzle annual direct vintage copper plastic column forward'
};

// Active challenge store
let activeChallenge = {
  challengeId: '',
  grid: [],
  timestamp: 0
};

let vaultState = {
  locked: true
};

// REST Endpoints

// Status
app.get('/api/status', (req, res) => {
  return res.json({
    registered: vaultConfig.registered,
    locked: vaultState.locked
  });
});

// Setup Vault (Registration)
app.post('/api/setup', (req, res) => {
  const { pathIndices, recoveryCode } = req.body;
  if (!pathIndices || !Array.isArray(pathIndices) || pathIndices.length < 3 || !recoveryCode) {
    return res.status(400).json({ error: 'Invalid setup parameters. 3+ visual coordinates and recovery key required.' });
  }

  if (vaultConfig.registered) {
    return res.status(400).json({ error: 'Vault has already been initialized on this device.' });
  }

  vaultConfig.registered = true;
  vaultConfig.pathIndices = pathIndices;
  vaultConfig.recoveryCode = recoveryCode;
  vaultState.locked = true;

  console.log('CryptoShield vault initialized with visual key path:', pathIndices);
  return res.json({ success: true, message: 'CryptoShield Vault initialized.' });
});

// Request Challenge
app.get('/api/challenge', (req, res) => {
  if (!vaultConfig.registered) {
    return res.status(400).json({ error: 'Vault not initialized.' });
  }

  const grid = generateRandomGrid();
  const challengeId = `chal_${Date.now()}`;
  
  activeChallenge = {
    challengeId,
    grid,
    timestamp: Date.now()
  };

  console.log(`Generated challenge: ${challengeId}`);
  return res.json({ success: true, challengeId, grid });
});

// Verify and Decrypt Vault
app.post('/api/unlock', (req, res) => {
  const { response, challengeId } = req.body;
  
  if (!response || !challengeId) {
    return res.status(400).json({ error: 'Missing challenge responses.' });
  }

  if (activeChallenge.challengeId !== challengeId) {
    return res.status(400).json({ error: 'Challenge expired or invalid.' });
  }

  // Verify response
  const isVerified = verifyResponse(activeChallenge.grid, vaultConfig.pathIndices, response);

  if (!isVerified) {
    console.log('Challenge verification failed: Access Denied.');
    return res.status(401).json({ error: 'Decryption failed: Visual signature key mismatch.' });
  }

  // Clear challenge
  activeChallenge = { challengeId: '', grid: [], timestamp: 0 };
  vaultState.locked = false;

  console.log('Vault successfully decrypted.');
  return res.json({
    success: true,
    secretContent: vaultConfig.secretContent
  });
});

// Lock Vault
app.post('/api/lock', (req, res) => {
  vaultState.locked = true;
  console.log('Vault locked.');
  return res.json({ success: true });
});

// Save Secret Note (when unlocked)
app.post('/api/save', (req, res) => {
  if (vaultState.locked) {
    return res.status(403).json({ error: 'Vault is locked.' });
  }

  const { secretContent } = req.body;
  if (secretContent === undefined) {
    return res.status(400).json({ error: 'Missing secret content.' });
  }

  vaultConfig.secretContent = secretContent;
  console.log('Vault secrets updated.');
  return res.json({ success: true, message: 'Secrets saved.' });
});

// Recovery Reset
app.post('/api/recovery', (req, res) => {
  const { recoveryCode, newPathIndices } = req.body;
  if (!recoveryCode || !newPathIndices || !Array.isArray(newPathIndices) || newPathIndices.length < 3) {
    return res.status(400).json({ error: 'Missing recovery details.' });
  }

  if (vaultConfig.recoveryCode !== recoveryCode) {
    console.log('Recovery attempt failed: Invalid Shard Code.');
    return res.status(401).json({ error: 'Invalid recovery shard code.' });
  }

  vaultConfig.pathIndices = newPathIndices;
  vaultState.locked = true; // Lock the vault for security

  console.log('Vault reset successful with new key path:', newPathIndices);
  return res.json({ success: true, message: 'Vault recovered successfully.' });
});

// Reset Device (Demo helper)
app.post('/api/reset-device', (req, res) => {
  vaultConfig = {
    registered: false,
    pathIndices: [],
    recoveryCode: '',
    secretContent: 'SEED PHRASE: dynamic zebra rocket manual puzzle annual direct vintage copper plastic column forward'
  };
  vaultState = { locked: true };
  activeChallenge = { challengeId: '', grid: [], timestamp: 0 };
  console.log('Device state cleared for demo.');
  return res.json({ success: true });
});

const PORT = 3001;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`CryptoShield server running on http://localhost:${PORT}`);
});
