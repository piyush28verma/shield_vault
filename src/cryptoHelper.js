// Cognitive Grid & WebAuthn Helpers for ShieldVault

export function generateRandomGrid() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters like O, I, 1, 0
  const grid = [];
  for (let i = 0; i < 25; i++) {
    const rand = Math.floor(Math.random() * chars.length);
    grid.push(chars[rand]);
  }
  return grid;
}

export function verifyResponse(grid, pathIndices, userResponse) {
  if (!grid || !pathIndices || !userResponse) return false;
  const cleanResponse = userResponse.trim().toUpperCase();
  if (pathIndices.length !== cleanResponse.length) return false;
  
  // Check exact click order (the order they drew the path)
  const expectedClick = pathIndices.map(idx => grid[idx]).join('').toUpperCase();
  if (expectedClick === cleanResponse) return true;

  // Check sorted numerical order (top-left to bottom-right)
  const sortedIndices = [...pathIndices].sort((a, b) => a - b);
  const expectedSorted = sortedIndices.map(idx => grid[idx]).join('').toUpperCase();
  if (expectedSorted === cleanResponse) return true;

  return false;
}

// Convert ArrayBuffer to Base64URL string (required for WebAuthn serialization)
export function bufferToBase64URL(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Convert Base64URL string back to ArrayBuffer
export function base64URLToBuffer(base64url) {
  if (!base64url || typeof base64url !== 'string') return new ArrayBuffer(0);
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const str = atob(base64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes.buffer;
}
