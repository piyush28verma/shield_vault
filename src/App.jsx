import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Key, 
  Copy,
  HelpCircle,
  Edit,
  Save,
  Trash2,
  Fingerprint,
  X
} from 'lucide-react';
import { bufferToBase64URL, base64URLToBuffer } from './cryptoHelper';

function App() {
  const [registered, setRegistered] = useState(false);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [secretContent, setSecretContent] = useState('');
  
  // Onboarding Setup State
  const [regUsername, setRegUsername] = useState('');
  const [regPath, setRegPath] = useState([]); // indices [0..24]
  const [regRecoveryCode, setRegRecoveryCode] = useState('');
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const [registeredPasskeyCred, setRegisteredPasskeyCred] = useState(null); // stores credential info

  // Step Indicators for Setup
  const [setupStep, setSetupStep] = useState(1); // 1 = Passkey, 2 = Grid Path, 3 = Recovery/Done

  // Challenge Unlock Dialog
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [challengeGrid, setChallengeGrid] = useState([]); // 25 characters
  const [challengeResponse, setChallengeResponse] = useState('');
  const [challengeError, setChallengeError] = useState('');
  const [activePasskeyChallenge, setActivePasskeyChallenge] = useState('');
  const [activePasskeyCredId, setActivePasskeyCredId] = useState('');
  const [passkeyVerified, setPasskeyVerified] = useState(false); // Step 1 completed in verification

  // Account Recovery Form (Simplified Shard Recovery)
  const [showRecovery, setShowRecovery] = useState(false);
  const [recCode, setRecCode] = useState('');
  const [recPath, setRecPath] = useState([]);
  const [recPasskeyCred, setRecPasskeyCred] = useState(null);
  const [recPasskeyRegistered, setRecPasskeyRegistered] = useState(false);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [activeDocTab, setActiveDocTab] = useState(null); // 'features', 'ps', 'matrix' or null
  const [showShardInfo, setShowShardInfo] = useState(false);

  // Fetch status from server
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setRegistered(data.registered);
      setVaultLocked(data.locked);
      if (data.locked) {
        setSecretContent('');
      }
    } catch (e) {
      console.error('Error fetching status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Generate random recovery key
  useEffect(() => {
    if (!registered) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let key = 'SHARD-';
      for (let i = 0; i < 8; i++) {
        if (i === 4) key += '-';
        key += chars[Math.floor(Math.random() * chars.length)];
      }
      setRegRecoveryCode(key);
    }
  }, [registered]);

  // Dot Click toggles node indices
  const handleDotClick = (idx, mode = 'register') => {
    const currentPath = mode === 'register' ? regPath : recPath;
    const setPath = mode === 'register' ? setRegPath : setRecPath;

    if (currentPath.includes(idx)) {
      setPath(currentPath.filter(i => i !== idx));
    } else {
      if (currentPath.length >= 8) {
        alert("Visual key coordinates limited to 8 nodes for memorability.");
        return;
      }
      setPath([...currentPath, idx]);
    }
  };

  // Primary Passkey Registration (Native browser prompts only)
  const handleRegisterPasskey = async () => {
    if (!regUsername) return alert('Username required first.');

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const rpId = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;

      const createOptions = {
        publicKey: {
          challenge: challenge,
          rp: { name: "ShieldVault", id: rpId },
          user: {
            id: userId,
            name: regUsername,
            displayName: regUsername
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256 (P-256)
          authenticatorSelection: {
            userVerification: "preferred"
          },
          timeout: 60000
        }
      };

      const credential = await navigator.credentials.create(createOptions);
      if (credential) {
        const credData = {
          id: credential.id,
          type: credential.type,
          rawId: bufferToBase64URL(credential.rawId)
        };
        setRegisteredPasskeyCred(credData);
        setPasskeyRegistered(true);
        setSetupStep(2); // Next step: Grid Path setup
        alert('Passkey registered successfully on this device!');
      }
    } catch (err) {
      console.error("Native WebAuthn enrollment failed:", err);
      alert(`Passkey registration failed: ${err.message || err.name}. Make sure biometrics are setup or hardware key is inserted.`);
    }
  };

  // Recovery - Passkey Registration
  const handleRegisterRecoveryPasskey = async () => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const rpId = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;

      const createOptions = {
        publicKey: {
          challenge: challenge,
          rp: { name: "ShieldVault", id: rpId },
          user: {
            id: userId,
            name: recCode || 'recovery_user',
            displayName: recCode || 'Recovery User'
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { userVerification: "preferred" },
          timeout: 60000
        }
      };

      const credential = await navigator.credentials.create(createOptions);
      if (credential) {
        const credData = {
          id: credential.id,
          type: credential.type,
          rawId: bufferToBase64URL(credential.rawId)
        };
        setRecPasskeyCred(credData);
        setRecPasskeyRegistered(true);
        alert('New device Passkey registered successfully!');
      }
    } catch (err) {
      console.error("Native recovery WebAuthn failed:", err);
      alert(`Recovery Passkey setup failed: ${err.message || err.name}`);
    }
  };

  // Complete Registration (Post Setup info to Server)
  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    if (!passkeyRegistered || !registeredPasskeyCred) {
      return alert('Register your Passkey first.');
    }
    if (regPath.length < 3) {
      return alert('Select at least 3 grid coordinates for your cognitive path.');
    }

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathIndices: regPath,
          recoveryCode: regRecoveryCode,
          passkeyCredential: registeredPasskeyCred
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('ShieldVault successfully set up and active!');
        fetchStatus();
      }
    } catch (e) {
      alert('Setup failed.');
    }
  };

  // Start two-layer Authentication sequence
  const handleUnlockRequest = async () => {
    try {
      const res = await fetch('/api/challenge');
      const data = await res.json();
      if (data.success) {
        setChallengeGrid(data.grid);
        setChallengeId(data.challengeId);
        setActivePasskeyChallenge(data.webauthnChallenge);
        setActivePasskeyCredId(data.passkeyCredentialId);
        
        setChallengeResponse('');
        setChallengeError('');
        setPasskeyVerified(false); // Reset authentication steps
        
        // Start Step 1: Biometric Verification
        triggerBiometricVerification(data.passkeyCredentialId, data.webauthnChallenge);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerBiometricVerification = async (credId, challenge) => {
    try {
      const challengeBuffer = base64URLToBuffer(challenge);
      const credBuffer = base64URLToBuffer(credId);
      const rpId = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;

      const getOptions = {
        publicKey: {
          challenge: challengeBuffer,
          rpId: rpId,
          allowCredentials: [{ id: credBuffer, type: "public-key" }],
          userVerification: "required",
          timeout: 60000
        }
      };

      const assertion = await navigator.credentials.get(getOptions);
      if (assertion) {
        // Native verified, move to grid challenge modal
        setPasskeyVerified(true);
        setShowChallenge(true); // Open Layer 2: Grid Input
      }
    } catch (err) {
      console.error("Native WebAuthn verification failed:", err);
      alert(`Passkey verification cancelled or failed: ${err.message || err.name}. Vault remains locked.`);
    }
  };

  const handleVerifyChallenge = async (e) => {
    e.preventDefault();
    setChallengeError('');

    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: challengeResponse.toUpperCase().trim(),
          challengeId,
          passkeyAssertion: {
            id: activePasskeyCredId
          }
        })
      });
      const data = await res.json();
      if (data.error) {
        setChallengeError(data.error);
      } else {
        setVaultLocked(false);
        setSecretContent(data.secretContent);
        setEditContent(data.secretContent);
        setShowChallenge(false);
      }
    } catch (e) {
      setChallengeError('Verification failed.');
    }
  };

  const handleLockVault = async () => {
    try {
      await fetch('/api/lock', { method: 'POST' });
      setVaultLocked(true);
      setSecretContent('');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSecret = async () => {
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretContent: editContent })
      });
      const data = await res.json();
      if (data.success) {
        setSecretContent(editContent);
        setIsEditing(false);
        alert('Vault content securely encrypted and saved!');
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Save failed.');
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    if (!recCode) return alert('Recovery shard code is required.');
    if (!recPasskeyRegistered || !recPasskeyCred) return alert('Please register a new biometric Passkey for your new device.');
    if (recPath.length < 3) return alert('Select at least 3 coordinates for your new visual key.');

    try {
      const res = await fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recoveryCode: recCode.trim(),
          newPathIndices: recPath,
          passkeyCredential: recPasskeyCred
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('Vault successfully recovered! New device keys registered.');
        setShowRecovery(false);
        setRecCode('');
        setRecPath([]);
        setRecPasskeyRegistered(false);
        setRecPasskeyCred(null);
        fetchStatus();
      }
    } catch (e) {
      alert('Recovery failed.');
    }
  };

  const handleResetDevice = async () => {
    if (confirm("Reset the entire vault state to demo registration again?")) {
      try {
        await fetch('/api/reset-device', { method: 'POST' });
        setRegistered(false);
        setVaultLocked(true);
        setSecretContent('');
        setRegPath([]);
        setRegUsername('');
        setPasskeyRegistered(false);
        setRegisteredPasskeyCred(null);
        setSetupStep(1);
        setShowRecovery(false);
        alert('Demo state reset. You can register again!');
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box' }}>
      <header>
        <div className="logo-container">
          <Shield size={32} style={{ color: 'var(--neon-cyan)' }} />
          <span className="logo-text">ShieldVault</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className={`status-pill ${vaultLocked ? 'status-pill-locked' : 'status-pill-secure'}`}>
            <span className="dot" style={{ background: vaultLocked ? 'var(--neon-pink)' : 'var(--neon-green)' }}></span>
            <span>VAULT STATUS: {vaultLocked ? 'LOCKED' : 'DECRYPTED'}</span>
          </div>
          <button className="cyber-btn cyber-btn-pink" onClick={handleResetDevice} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
            <Trash2 size={14} /> Reset Demo
          </button>
        </div>
      </header>

      <div className="war-room-grid" style={{ gridTemplateColumns: registered ? '1.2fr 1fr' : '1fr' }}>
        
        {/* SETUP SCREEN (If not registered) */}
        {!registered ? (
          <div className="glow-panel" style={{ maxWidth: '700px', margin: '40px auto' }}>
            <h2 style={{ fontFamily: 'Orbitron', marginBottom: '15px', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Key size={24} /> Initialize Shield Vault
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '25px' }}>
              Secure your credentials. 
              Setup requires registering a <strong>Biometric Passkey</strong> first, followed by drawing a <strong>Secret Visual Grid Path</strong>.
            </p>

            {/* Registration Steps Navigator */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: setupStep === 1 ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                <span style={{ border: '1px solid', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>1</span>
                <span style={{ fontWeight: setupStep === 1 ? 700 : 400 }}>Passkey</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: setupStep === 2 ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                <span style={{ border: '1px solid', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>2</span>
                <span style={{ fontWeight: setupStep === 2 ? 700 : 400 }}>Visual Grid</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: setupStep === 3 ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                <span style={{ border: '1px solid', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>3</span>
                <span style={{ fontWeight: setupStep === 3 ? 700 : 400 }}>Recovery Shard</span>
              </div>
            </div>

            {/* Step 1: Register Passkey */}
            {setupStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="cyber-group">
                  <label className="cyber-label">Username</label>
                  <input 
                    type="text" 
                    className="cyber-input" 
                    value={regUsername} 
                    onChange={e => setRegUsername(e.target.value.trim().toLowerCase())} 
                    placeholder="Enter your name to link passkey..."
                    required 
                  />
                </div>
                <button 
                  type="button" 
                  className="cyber-btn cyber-btn-cyan"
                  onClick={handleRegisterPasskey}
                  disabled={!regUsername}
                  style={{ width: '100%', padding: '16px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  <Fingerprint size={20} /> Enroll Biometric Passkey
                </button>
              </div>
            )}

            {/* Step 2: Draw Path */}
            {setupStep === 2 && (
              <div>
                <div className="cyber-group">
                  <label className="cyber-label">Draw Secret Visual Key Path</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                    Select nodes in a visual shape. This cognitive pattern resides in your brain, ensuring protection if biometrics are bypassed.
                  </p>
                  
                  {/* 5x5 Grid Designer */}
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 45px)', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                      {Array.from({ length: 25 }).map((_, idx) => {
                        const isSelected = regPath.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleDotClick(idx, 'register')}
                            style={{
                              width: '45px',
                              height: '45px',
                              borderRadius: '50%',
                              background: isSelected ? 'var(--neon-cyan)' : '#111827',
                              border: isSelected ? '2px solid #fff' : '1px solid var(--panel-border)',
                              boxShadow: isSelected ? '0 0 15px var(--neon-cyan-glow)' : 'none',
                              cursor: 'pointer',
                              color: isSelected ? '#000' : 'rgba(255,255,255,0.4)',
                              fontFamily: 'Fira Code, monospace',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {idx}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '20px' }}>
                    Your secret coordinates: {regPath.length === 0 ? 'None selected' : <strong>{regPath.join(' ➔ ')}</strong>}
                  </div>
                </div>
                
                <button 
                  type="button" 
                  className="cyber-btn cyber-btn-cyan"
                  onClick={() => setSetupStep(3)}
                  disabled={regPath.length < 3}
                  style={{ width: '100%' }}
                >
                  Continue to Recovery
                </button>
              </div>
            )}

            {/* Step 3: Recovery & Submit */}
            {setupStep === 3 && (
              <form onSubmit={handleSetupSubmit}>
                <div className="cyber-group" style={{ background: 'rgba(255,159,0,0.05)', border: '1px solid rgba(255,159,0,0.3)', padding: '15px', borderRadius: '8px', marginBottom: '25px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label className="cyber-label" style={{ color: 'var(--neon-orange)', margin: 0 }}>
                      Backup Paper Recovery Shard
                    </label>
                    <button 
                      type="button"
                      onClick={() => setShowShardInfo(!showShardInfo)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--neon-orange)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Learn how recovery shards work"
                    >
                      <HelpCircle size={16} />
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0' }}>
                    Write this key down. If you lose your visual path grid shape, use this code to recover access offline.
                  </p>
                  
                  {showShardInfo && (
                    <div style={{
                      marginTop: '10px',
                      background: 'rgba(255,159,0,0.08)',
                      border: '1px dashed rgba(255,159,0,0.4)',
                      padding: '12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.85)',
                      animation: 'fadeIn 0.25s ease-out',
                      textAlign: 'left',
                      marginBottom: '15px'
                    }}>
                      <strong style={{ color: 'var(--neon-orange)' }}>🛡️ Recovery Key Security Specifications:</strong>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px', listStyleType: 'disc' }}>
                        <li><strong>Zero-Knowledge</strong>: The server only stores the SHA-256 hash of this shard. The raw code is never transmitted or saved online.</li>
                        <li><strong>Anti-SIM Swap</strong>: Completely immune to network/SMS interception because recovery remains physical and offline.</li>
                        <li><strong>Device Override</strong>: Enables a cryptographically secure override to rotate your WebAuthn keys and draw a new pattern if you lose your physical machine.</li>
                      </ul>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255,159,0,0.2)' }}>
                    <code style={{ fontFamily: 'Fira Code', fontSize: '0.9rem', color: 'var(--neon-orange)', flex: 1 }}>{regRecoveryCode}</code>
                    <button 
                      type="button" 
                      onClick={() => {
                        navigator.clipboard.writeText(regRecoveryCode);
                        alert('Recovery code copied!');
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--neon-orange)', cursor: 'pointer' }}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <button type="button" className="cyber-btn cyber-btn-secondary" onClick={() => setSetupStep(2)} style={{ flex: 1 }}>
                    Back
                  </button>
                  <button type="submit" className="cyber-btn cyber-btn-cyan" style={{ flex: 2 }}>
                    Activate Encrypted Vault
                  </button>
                </div>
              </form>
            )}

          </div>
        ) : (
          /* WALLET COCKPIT SCREEN (If registered) */
          <>
            {/* Left Column: Padlock and Decrypted secrets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div className={`vault-card ${vaultLocked ? 'locked' : 'unlocked'}`}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  {vaultLocked ? (
                    <Lock size={80} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 15px rgba(255,0,127,0.4))' }} />
                  ) : (
                    <Unlock size={80} style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 15px rgba(57,255,20,0.4))' }} />
                  )}
                </div>
                
                <h2 className="vault-status-indicator" style={{ fontFamily: 'Orbitron', fontWeight: 900 }}>
                  {vaultLocked ? 'VAULT SECRETS: LOCKED' : 'VAULT SECRETS: DECRYPTED'}
                </h2>
                
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                  {vaultLocked 
                    ? 'Your database credentials and private keys are encrypted at rest. Primary Biometric Passkey + Secondary Cognitive Grid challenge required to decrypt.'
                    : 'Security clearance verified. Decrypted vault secrets loaded.'
                  }
                </p>

                {/* Secret content card */}
                {!vaultLocked && (
                  <div style={{ marginTop: '20px' }}>
                    {isEditing ? (
                      <div className="cyber-group">
                        <textarea
                          className="cyber-input"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={4}
                          style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.95rem', color: 'var(--neon-green)', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <button className="cyber-btn cyber-btn-secondary" onClick={() => setIsEditing(false)} style={{ flex: 1 }}>
                            Cancel
                          </button>
                          <button className="cyber-btn cyber-btn-cyan" onClick={handleSaveSecret} style={{ flex: 1, background: 'var(--neon-green)', color: '#000' }}>
                            <Save size={16} /> Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="secret-data-display">
                          {secretContent}
                        </div>
                        <button 
                          className="cyber-btn cyber-btn-secondary" 
                          onClick={() => {
                            setEditContent(secretContent);
                            setIsEditing(true);
                          }}
                          style={{ marginTop: '15px', width: '100%', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Edit size={14} /> Edit Stored Secrets/Credentials
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '30px' }}>
                  {vaultLocked ? (
                    <button 
                      className="cyber-btn cyber-btn-cyan" 
                      onClick={handleUnlockRequest}
                      style={{ width: '100%' }}
                    >
                      Decrypt Shield Vault
                    </button>
                  ) : (
                    !isEditing && (
                      <button 
                        className="cyber-btn cyber-btn-pink" 
                        onClick={handleLockVault}
                        style={{ width: '100%' }}
                      >
                        Encrypt & Lock Vault
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Explainer and Recovery */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* Security Explainer Card */}
              <div className="glow-panel" style={{ border: '1px solid rgba(0,242,254,0.1)' }}>
                <h3 style={{ fontFamily: 'Orbitron', marginBottom: '15px', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={18} /> Two-Layer Security Protocol
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <div style={{ borderLeft: '2px solid var(--neon-cyan)', paddingLeft: '10px' }}>
                    <strong>Layer 1 (Passkey)</strong>: WebAuthn cryptographically proves physical device ownership and biometric authentication. Protects against remote attackers.
                  </div>
                  <div style={{ borderLeft: '2px solid var(--neon-cyan)', paddingLeft: '10px' }}>
                    <strong>Layer 2 (Cognitive Grid)</strong>: Proves human knowledge. Even if an attacker steals your device unlocked or coerces TouchID, they cannot decrypt the secrets because the visual path is strictly in your brain.
                  </div>
                </div>
              </div>

              {/* Passwordless Recovery Card */}
              <div className="glow-panel">
                {!showRecovery ? (
                  <>
                    <h3 style={{ fontFamily: 'Orbitron', marginBottom: '15px', color: 'var(--neon-orange)' }}>
                      Vault Access Recovery
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                      Forgotten your visual path shape? Reset your cognitive credentials using your paper recovery shard.
                    </p>
                    <button 
                      className="cyber-btn cyber-btn-secondary" 
                      onClick={() => setShowRecovery(true)}
                      style={{ width: '100%', border: '1px solid rgba(255,159,0,0.3)', color: 'var(--neon-orange)' }}
                    >
                      <RefreshCw size={16} /> Recover Visual Path
                    </button>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontFamily: 'Orbitron', marginBottom: '15px', color: 'var(--neon-orange)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={20} /> Recover Vault Key
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                      Enter your backup recovery code. For security on a new device, you will also enroll a new biometric Passkey.
                    </p>

                    <form onSubmit={handleRecoverySubmit}>
                      <div className="cyber-group">
                        <label className="cyber-label">Recovery Shard Code</label>
                        <input 
                          type="text" 
                          className="cyber-input" 
                          value={recCode} 
                          onChange={e => setRecCode(e.target.value)} 
                          placeholder="SHARD-XXXX-YYYY"
                          required 
                        />
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <button
                          type="button"
                          className="cyber-btn cyber-btn-secondary"
                          onClick={handleRegisterRecoveryPasskey}
                          style={{ width: '100%', border: recPasskeyRegistered ? '1px solid var(--neon-green)' : '1px solid var(--panel-border)', color: recPasskeyRegistered ? 'var(--neon-green)' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Fingerprint size={16} /> {recPasskeyRegistered ? 'Passkey Enrolled ✓' : 'Register New Device Passkey'}
                        </button>
                      </div>

                      <div className="cyber-group">
                        <label className="cyber-label">Draw NEW Cognitive Key Path</label>
                        
                        {/* 5x5 Grid Designer */}
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 45px)', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                            {Array.from({ length: 25 }).map((_, idx) => {
                              const isSelected = recPath.includes(idx);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleDotClick(idx, 'recovery')}
                                  style={{
                                    width: '45px',
                                    height: '45px',
                                    borderRadius: '50%',
                                    background: isSelected ? 'var(--neon-orange)' : '#111827',
                                    border: isSelected ? '2px solid #fff' : '1px solid var(--panel-border)',
                                    boxShadow: isSelected ? '0 0 15px var(--neon-orange-glow)' : 'none',
                                    cursor: 'pointer',
                                    color: isSelected ? '#000' : 'rgba(255,255,255,0.4)',
                                    fontFamily: 'Fira Code, monospace',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {idx}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          New secret path coordinates: {recPath.length === 0 ? 'None selected' : <strong>{recPath.join(' ➔ ')}</strong>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" className="cyber-btn cyber-btn-secondary" onClick={() => setShowRecovery(false)} style={{ flex: 1 }}>
                          Cancel
                        </button>
                        <button type="submit" className="cyber-btn cyber-btn-cyan" style={{ flex: 1, background: 'var(--neon-orange)', boxShadow: '0 4px 15px var(--neon-orange-glow)' }}>
                          Recover
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>

            </div>
          </>
        )}
      </div>

      {/* Dynamic Documentation Section */}
      <div className="glow-panel" style={{ marginTop: 'auto', width: '100%', border: '1px solid var(--panel-border)', paddingTop: '30px' }}>

        
        {/* Toggle Buttons */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '25px' }}>
          <button 
            type="button"
            className={`cyber-btn ${activeDocTab === 'features' ? 'cyber-btn-cyan' : 'cyber-btn-secondary'}`}
            onClick={() => setActiveDocTab(activeDocTab === 'features' ? null : 'features')}
            style={{ minWidth: '180px' }}
          >
            Key Features
          </button>
          <button 
            type="button"
            className={`cyber-btn ${activeDocTab === 'ps' ? 'cyber-btn-cyan' : 'cyber-btn-secondary'}`}
            onClick={() => setActiveDocTab(activeDocTab === 'ps' ? null : 'ps')}
            style={{ minWidth: '180px' }}
          >
            How this solves PS
          </button>
          <button 
            type="button"
            className={`cyber-btn ${activeDocTab === 'matrix' ? 'cyber-btn-cyan' : 'cyber-btn-secondary'}`}
            onClick={() => setActiveDocTab(activeDocTab === 'matrix' ? null : 'matrix')}
            style={{ minWidth: '180px' }}
          >
            Threat Mitigation Matrix
          </button>
        </div>

        {/* Tab Contents */}
        {activeDocTab && (
          <div style={{ position: 'relative', borderTop: '1px solid var(--panel-border)', paddingTop: '20px', marginTop: '10px', animation: 'fadeIn 0.3s ease-out' }}>
            {/* Collapse Button */}
            <button 
              type="button" 
              onClick={() => setActiveDocTab(null)} 
              className="cyber-btn cyber-btn-pink"
              style={{
                position: 'absolute',
                top: '20px',
                right: '0',
                padding: '8px',
                borderRadius: '50%',
                minWidth: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Collapse Panel"
            >
              <X size={16} />
            </button>

            {activeDocTab === 'features' && (
              <div>
                <h3 style={{ fontFamily: 'Orbitron', color: 'var(--neon-cyan)', marginBottom: '15px' }}>Key Security Features</h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyleType: 'none', padding: 0, paddingRight: '140px' }}>
                  <li style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--neon-cyan)', textAlign: 'left' }}>
                    <strong>Two-Layer Credentials (MFA)</strong>: Integrates hardware-bound biometrics (WebAuthn Passkeys) for physical presence, with a cognitive spatial memorized pattern for access control.
                  </li>
                  <li style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--neon-cyan)', textAlign: 'left' }}>
                    <strong>Zero-Knowledge Keystrokes</strong>: Grid challenge randomizes on every unlock request. You never type your visual pattern coordinates, only randomized letters, completely neutralizing keyloggers.
                  </li>
                  <li style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--neon-cyan)', textAlign: 'left' }}>
                    <strong>Memory-Bound Security (Cognitive)</strong>: No visual grid coordinates, master decryption keys, or session tokens are stored in browser memory, Chrome autofill, or local vaults. The master visual key pattern remains strictly inside your head.
                  </li>
                  <li style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--neon-cyan)', textAlign: 'left' }}>
                    <strong>Paper Shard Recovery</strong>: Enables complete account recovery and device rotation using a decentralized recovery shard key, keeping user keys private.
                  </li>
                </ul>
              </div>
            )}

            {activeDocTab === 'ps' && (
              <div>
                <h3 style={{ fontFamily: 'Orbitron', color: 'var(--neon-cyan)', marginBottom: '15px' }}>Alignment with Hackathon Security Goals</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left', paddingRight: '140px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid var(--neon-green)' }}>
                    <h4 style={{ color: 'var(--neon-green)', margin: '0 0 8px 0', fontSize: '1.05rem', fontFamily: 'Orbitron' }}>Goal 1: Keylogger & Phishing Resistance (Passwordless First)</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <strong>Our Solution</strong>: ShieldVault is 100% passwordless. There is no text-based password created, stored, or typed. Users enroll device-bound WebAuthn Passkeys combined with a randomized cognitive visual grid check.
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid var(--neon-green)' }}>
                    <h4 style={{ color: 'var(--neon-green)', margin: '0 0 8px 0', fontSize: '1.05rem', fontFamily: 'Orbitron' }}>Goal 2: Biometric Bypass Prevention (Multi-Factor Security)</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <strong>Our Solution</strong>: While we leverage native WebAuthn (Passkeys) for device possession, we mandate a custom-engineered Cognitive Grid Verification layer. The second layer is a proprietary visual path challenge-response verification system that we wrote from scratch.
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid var(--neon-green)' }}>
                    <h4 style={{ color: 'var(--neon-green)', margin: '0 0 8px 0', fontSize: '1.05rem', fontFamily: 'Orbitron' }}>Goal 3: Device & Channel Loss Recovery (High Resilience)</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <strong>Our Solution</strong>: ShieldVault provides a cryptographic <strong>Paper Shard Recovery</strong> protocol. If a user loses their device (or clears browser state), they can restore credentials and register new passkeys by entering their offline-saved Recovery Shard key, ensuring no weak fallbacks (like SMS, email, or security questions) compromise the vault.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeDocTab === 'matrix' && (
              <div style={{ overflowX: 'auto' }}>
                <h3 style={{ fontFamily: 'Orbitron', color: 'var(--neon-cyan)', marginBottom: '15px' }}>Detailed Threat Mitigation Matrix</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--panel-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--neon-cyan)', fontFamily: 'Orbitron' }}>Threat Vector</th>
                      <th style={{ padding: '12px', color: 'var(--neon-pink)', fontFamily: 'Orbitron' }}>Vulnerability of Standard Systems</th>
                      <th style={{ padding: '12px', color: 'var(--neon-green)', fontFamily: 'Orbitron' }}>How ShieldVault Solves It</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>Keyloggers & Keystroke Malware</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>Captures credentials (passwords, PINs, static 2FA codes) as they are typed.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>Grid Randomization</strong>: The challenge grid characters randomize on every single unlock. The typed characters are different every time, rendering recorded keystrokes useless.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>SIM Swapping</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>Intercepts cellular SMS codes by hijacking the user's phone number.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>SMS-Free Protocol</strong>: We do not use SMS, email verification, or cellular phone numbers. Authentication is completed entirely between the local device and the server.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>Device Theft (Unlocked/Bypassed)</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>If a phone/laptop is stolen unlocked, Chrome/Safari auto-fills all stored passwords.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>Mental Isolation</strong>: The master visual key path exists only in the user's head, not in any local browser storage, keychains, or cookies.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>Biometric Coercion</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>An attacker forces you to touch the fingerprint reader or scans FaceID while you are asleep.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>Two-Layer Mandate</strong>: Biometrics only passes Layer 1. The vault remains locked until you actively look at the grid and type the correct path sequence.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>Fraudulent OTP Phishing</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>Relays intercepted OTP codes from a fake screen to log in to the real site.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>Challenge Bound</strong>: The response characters are valid only for the specific grid shown. A fake grid from a phishing site will be rejected by the real server.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>Dictionary & Bruteforce Attacks</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>Automated scripts try millions of common textual passwords.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>Spatial Complexity</strong>: There is no textual password. Guessing a 5-node path out of 25 dots offers 53,130 combinations, which are blocked after 3 attempts.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>Credential Auto-Fill Stealers</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>Stealer malware targets saved browser credentials and cookies.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>No Stored Cognitive Coordinates</strong>: The master decryption key is your memorized visual path. No browser database, autofill credential file, or local storage contains this pattern, leaving nothing for browser stealers to extract.</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>Shoulder Surfing (Keystroke Spying)</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>An observer watches you type your credentials.</td>
                      <td style={{ padding: '12px', color: 'var(--neon-green)' }}><strong>One-Time Token</strong>: They only see you type 5 random letters that change on every login, which cannot be reused to log in later.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Challenge Modal Overlay */}
      {showChallenge && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ border: '2px solid var(--neon-cyan)', boxShadow: '0 0 35px var(--neon-cyan-glow)' }}>
            <div className="siren-animation" style={{ animation: 'none', border: '2px solid var(--neon-cyan)', color: 'var(--neon-cyan)' }}>
              <Key size={36} />
            </div>

            <h3 style={{ fontFamily: 'Orbitron', marginBottom: '10px', color: 'var(--neon-cyan)' }}>
              Layer 2: Visual Grid Signature
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              TouchID/Biometrics verified successfully. Now, input the 5 characters that fall on your <strong>Secret visual path coordinates</strong> in numerical order (top-left to bottom-right).
            </p>

            {/* Random Challenge Grid */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 45px)', gap: '12px', background: 'rgba(2,3,6,0.9)', padding: '16px', borderRadius: '12px', border: '1px solid var(--neon-cyan)', boxShadow: '0 0 20px rgba(0, 242, 254, 0.1)' }}>
                {challengeGrid.map((char, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '45px',
                      height: '45px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(0, 242, 254, 0.25)',
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '1.05rem',
                      fontWeight: 'bold',
                      color: 'var(--neon-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {char}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleVerifyChallenge}>
              <div className="cyber-group">
                <input 
                  type="text" 
                  className="cyber-input" 
                  value={challengeResponse} 
                  onChange={e => setChallengeResponse(e.target.value.toUpperCase())} 
                  placeholder="Type response letters..."
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontFamily: 'Fira Code', borderColor: 'var(--neon-cyan)' }}
                  required 
                  autoFocus
                />
              </div>

              {challengeError && (
                <p style={{ color: 'var(--neon-pink)', fontSize: '0.85rem', marginBottom: '15px', fontWeight: 600 }}>
                  [!] {challengeError}
                </p>
              )}

              <div style={{ display: 'flex', gap: '15px' }}>
                <button type="button" className="cyber-btn cyber-btn-secondary" onClick={() => setShowChallenge(false)} style={{ flex: 1 }}>
                  Abort
                </button>
                <button type="submit" className="cyber-btn cyber-btn-cyan" style={{ flex: 1 }}>
                  Verify Grid Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
