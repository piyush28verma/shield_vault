import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Key, 
  Copy,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Edit,
  Save,
  Trash2
} from 'lucide-react';

function App() {
  const [registered, setRegistered] = useState(false);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [secretContent, setSecretContent] = useState('');
  
  // Registration Form
  const [regPath, setRegPath] = useState([]); // indices of selected dots [0..24]
  const [regRecoveryCode, setRegRecoveryCode] = useState('');

  // Challenge Dialog
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [challengeGrid, setChallengeGrid] = useState([]); // 25 characters
  const [challengeResponse, setChallengeResponse] = useState('');
  const [challengeError, setChallengeError] = useState('');

  // Account Recovery Form
  const [showRecovery, setShowRecovery] = useState(false);
  const [recCode, setRecCode] = useState('');
  const [recPath, setRecPath] = useState([]);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

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

  // Generate random recovery key for registration
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

  const handleDotClick = (idx, mode = 'register') => {
    const currentPath = mode === 'register' ? regPath : recPath;
    const setPath = mode === 'register' ? setRegPath : setRecPath;

    if (currentPath.includes(idx)) {
      setPath(currentPath.filter(i => i !== idx));
    } else {
      if (currentPath.length >= 8) {
        alert("Visual path limited to 8 nodes for cognitive ease.");
        return;
      }
      setPath([...currentPath, idx].sort((a, b) => a - b));
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (regPath.length < 3) {
      return alert('Select at least 3 grid coordinate nodes for your visual signature key.');
    }

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathIndices: regPath,
          recoveryCode: regRecoveryCode
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('CryptoShield Visual Wallet initialized successfully!');
        fetchStatus();
      }
    } catch (e) {
      alert('Setup failed.');
    }
  };

  const handleUnlockRequest = async () => {
    try {
      const res = await fetch('/api/challenge');
      const data = await res.json();
      if (data.success) {
        setChallengeGrid(data.grid);
        setChallengeId(data.challengeId);
        setChallengeResponse('');
        setChallengeError('');
        setShowChallenge(true);
      }
    } catch (e) {
      console.error(e);
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
          challengeId
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
        alert('Secrets encrypted and saved successfully!');
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to save secrets.');
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    if (!recCode) return alert('Recovery shard code is required.');
    if (recPath.length < 3) return alert('Select at least 3 coordinates for your new visual key.');

    try {
      const res = await fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recoveryCode: recCode.trim(),
          newPathIndices: recPath
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('Recovery successful! Old credentials wiped, new visual path registered.');
        setShowRecovery(false);
        setRecCode('');
        setRecPath([]);
        fetchStatus();
      }
    } catch (e) {
      alert('Recovery failed.');
    }
  };

  const handleResetDevice = async () => {
    if (confirm("Reset the entire device status to demo setup again? This will delete the registered wallet.")) {
      try {
        await fetch('/api/reset-device', { method: 'POST' });
        setRegistered(false);
        setVaultLocked(true);
        setSecretContent('');
        setRegPath([]);
        setShowRecovery(false);
        alert('Demo state reset. You can now register again!');
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <>
      <header>
        <div className="logo-container">
          <Shield size={32} style={{ color: 'var(--neon-cyan)' }} />
          <span className="logo-text">CryptoShield</span>
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
              <Key size={24} /> Initialize Crypto Seed Vault
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Secure your high-value cryptocurrency seed phrases against malware keyloggers. 
              Instead of a password, you will authenticate using a **secret visual grid path** that is never typed or sent in plain text.
            </p>

            <form onSubmit={handleSetup}>
              <div className="cyber-group">
                <label className="cyber-label">1. Draw Your Secret Visual Key Path</label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Click nodes on the 5x5 grid to create a unique visual shape (e.g. a diagonal line, triangle, or letters). 
                  The coordinates will be verified top-left to bottom-right (numerical order).
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
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Your registered visual path coordinate indices: {regPath.length === 0 ? 'None selected' : <strong>{regPath.join(' ➔ ')}</strong>}
                </div>
              </div>

              <div className="cyber-group" style={{ background: 'rgba(255,159,0,0.05)', border: '1px solid rgba(255,159,0,0.3)', padding: '15px', borderRadius: '8px', margin: '25px 0' }}>
                <label className="cyber-label" style={{ color: 'var(--neon-orange)' }}>
                  2. Backup Paper Recovery Shard
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0' }}>
                  Write down this backup shard code. If you ever forget your visual key path, you can use this shard to restore your wallet vault offline.
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255,159,0,0.2)' }}>
                  <code style={{ fontFamily: 'Fira Code', fontSize: '0.9rem', color: 'var(--neon-orange)', flex: 1 }}>{regRecoveryCode}</code>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(regRecoveryCode);
                      alert('Recovery key copied to clipboard!');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--neon-orange)', cursor: 'pointer' }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <button type="submit" className="cyber-btn cyber-btn-cyan" style={{ width: '100%' }}>
                Activate Encrypted Wallet Vault
              </button>
            </form>
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
                  {vaultLocked ? 'SEED PHRASE: LOCKED' : 'SEED PHRASE: DECRYPTED'}
                </h2>
                
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                  {vaultLocked 
                    ? 'Your highly confidential cryptocurrency recovery seed phrase is encrypted at rest. Perform the cognitive visual grid challenge to reveal.'
                    : 'Security clearance verified. Decrypted seed phrase loaded.'
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
                          <Edit size={14} /> Edit Stored Seed/Secrets
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
                      Decrypt Wallet Vault
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
                  <HelpCircle size={18} /> How GridShield Works
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <div style={{ borderLeft: '2px solid var(--neon-cyan)', paddingLeft: '10px' }}>
                    <strong>Keylogger Defense:</strong> Because the challenge grid randomizes every time, the characters you type are different for every verification. Even if an attacker records your keyboard, the captured characters are useless.
                  </div>
                  <div style={{ borderLeft: '2px solid var(--neon-cyan)', paddingLeft: '10px' }}>
                    <strong>Cognitive Ease:</strong> You do not need to memorize complex passwords. You only need to memorize a visual shape (like a diagonal) on a 5x5 grid.
                  </div>
                  <div style={{ borderLeft: '2px solid var(--neon-cyan)', paddingLeft: '10px' }}>
                    <strong>No Password File:</strong> No plain-text passwords or biometrics are transmitted or stored on server vaults.
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
                      Enter your backup recovery shard code and draw a new visual pattern below.
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

      {/* Challenge Modal Overlay */}
      {showChallenge && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="siren-animation" style={{ animation: 'none' }}>
              <Key size={36} />
            </div>

            <h3 style={{ fontFamily: 'Orbitron', marginBottom: '10px', color: 'var(--neon-pink)' }}>
              Enter Cognitive Signature
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Type the 5 characters that fall on your **Secret visual path coordinates** in numerical order (top-left to bottom-right).
            </p>

            {/* Random Challenge Grid */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 45px)', gap: '12px', background: 'rgba(2,3,6,0.9)', padding: '16px', borderRadius: '12px', border: '1px solid var(--neon-pink)', boxShadow: '0 0 20px rgba(255, 0, 127, 0.1)' }}>
                {challengeGrid.map((char, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '45px',
                      height: '45px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 0, 127, 0.25)',
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '1.05rem',
                      fontWeight: 'bold',
                      color: 'var(--neon-pink)',
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
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontFamily: 'Fira Code' }}
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
                  Verify Signature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
