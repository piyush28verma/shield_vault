// Cognitive Grid Helpers for GridShield

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
  if (pathIndices.length !== userResponse.trim().length) return false;
  
  const expected = pathIndices.map(idx => grid[idx]).join('').toUpperCase();
  return expected === userResponse.trim().toUpperCase();
}
