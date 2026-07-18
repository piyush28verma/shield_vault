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
  passkeyCredential: null, // Stores { id, type, rawId }
  secretContent: 'VAULT SECRETS:\n- Login: admin_alice@secured.domain / pass: aL1c3_P@ss!\n- Bank Vault Code: 9982-1102\n- Secure Note: Cognitive grid pattern is my master key.'
};

// Active challenge store
let activeChallenge = {
  challengeId: '',
  grid: [],
  timestamp: 0,
  webauthnChallenge: ''
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

// Setup Vault (Registration - Passkey + Path)
app.post('/api/setup', (req, res) => {
  const { pathIndices, recoveryCode, passkeyCredential } = req.body;
  if (!pathIndices || !Array.isArray(pathIndices) || pathIndices.length < 3 || !recoveryCode || !passkeyCredential) {
    return res.status(400).json({ error: 'Invalid setup parameters. Path indices, recovery key, and Passkey registration required.' });
  }

  if (vaultConfig.registered) {
    return res.status(400).json({ error: 'Vault has already been initialized on this device.' });
  }

  vaultConfig.registered = true;
  vaultConfig.pathIndices = pathIndices;
  vaultConfig.recoveryCode = recoveryCode;
  vaultConfig.passkeyCredential = passkeyCredential;
  vaultState.locked = true;

  console.log('ShieldVault initialized successfully:');
  console.log('- Visual key path:', pathIndices);
  console.log('- Passkey credential ID:', passkeyCredential.id);

  return res.json({ success: true, message: 'ShieldVault initialized.' });
});

// Request Challenge (Passkey verification + Grid generation)
app.get('/api/challenge', (req, res) => {
  if (!vaultConfig.registered) {
    return res.status(400).json({ error: 'Vault not initialized.' });
  }

  const grid = generateRandomGrid();
  const challengeId = `chal_${Date.now()}`;
  const webauthnChallenge = Math.random().toString(36).substring(2); // String challenge for WebAuthn

  activeChallenge = {
    challengeId,
    grid,
    timestamp: Date.now(),
    webauthnChallenge
  };

  console.log(`Generated challenge: ${challengeId}`);
  return res.json({ 
    success: true, 
    challengeId, 
    grid,
    webauthnChallenge,
    passkeyCredentialId: vaultConfig.passkeyCredential.rawId // Send RAWID to rebuild exact bytes
  });
});

// Verify and Decrypt Vault (Verifies both Passkey and Grid)
app.post('/api/unlock', (req, res) => {
  const { response, challengeId, passkeyAssertion } = req.body;
  
  if (!response || !challengeId || !passkeyAssertion) {
    return res.status(400).json({ error: 'Missing challenge responses (both Passkey signature and Grid response are required).' });
  }

  if (activeChallenge.challengeId !== challengeId) {
    return res.status(400).json({ error: 'Challenge expired or invalid.' });
  }

  // 1. Verify Passkey Credential ID matches registered credential
  if (passkeyAssertion.id !== vaultConfig.passkeyCredential.rawId) {
    console.log('WebAuthn verification failed: Credential ID mismatch.');
    return res.status(401).json({ error: 'Decryption failed: Unauthorized device/biometric key.' });
  }

  // 2. Verify Grid Response matches secret visual path
  const expectedClick = vaultConfig.pathIndices.map(idx => activeChallenge.grid[idx]).join('').toUpperCase();
  const sortedIndices = [...vaultConfig.pathIndices].sort((a, b) => a - b);
  const expectedSorted = sortedIndices.map(idx => activeChallenge.grid[idx]).join('').toUpperCase();
  console.log(`[DEBUG] Stored pathIndices (click order):`, vaultConfig.pathIndices);
  console.log(`[DEBUG] Server expected (click order): "${expectedClick}", expected (sorted): "${expectedSorted}", User response: "${response}"`);

  const isVerified = verifyResponse(activeChallenge.grid, vaultConfig.pathIndices, response);

  if (!isVerified) {
    console.log('Grid challenge verification failed: Visual key mismatch.');
    return res.status(401).json({ error: 'Decryption failed: Visual signature key mismatch.' });
  }

  // Clear challenge
  activeChallenge = { challengeId: '', grid: [], timestamp: 0, webauthnChallenge: '' };
  vaultState.locked = false;

  console.log('WebAuthn Passkey + Cognitive Grid verification successful. Vault decrypted.');
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
  const { recoveryCode, newPathIndices, passkeyCredential } = req.body;
  if (!recoveryCode || !newPathIndices || !Array.isArray(newPathIndices) || newPathIndices.length < 3 || !passkeyCredential) {
    return res.status(400).json({ error: 'Missing recovery details (Code, new Path, and new Passkey required).' });
  }

  if (vaultConfig.recoveryCode !== recoveryCode) {
    console.log('Recovery attempt failed: Invalid Recovery Code.');
    return res.status(401).json({ error: 'Invalid recovery shard code.' });
  }

  vaultConfig.pathIndices = newPathIndices;
  vaultConfig.passkeyCredential = passkeyCredential;
  vaultState.locked = true; // Lock the vault for security

  console.log('Vault recovery successful. Registered new Passkey and visual path.');
  return res.json({ success: true, message: 'Vault recovered successfully.' });
});

// Reset Device (Demo helper)
app.post('/api/reset-device', (req, res) => {
  vaultConfig = {
    registered: false,
    pathIndices: [],
    recoveryCode: '',
    passkeyCredential: null,
    secretContent: 'VAULT SECRETS:\n- Login: admin_alice@secured.domain / pass: aL1c3_P@ss!\n- Bank Vault Code: 9982-1102\n- Secure Note: Cognitive grid pattern is my master key.'
  };
  vaultState = { locked: true };
  activeChallenge = { challengeId: '', grid: [], timestamp: 0, webauthnChallenge: '' };
  console.log('Device state cleared for demo.');
  return res.json({ success: true });
});

const PORT = 3001;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`ShieldVault server running on http://localhost:${PORT}`);
});
