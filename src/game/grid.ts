import { Grid, Piece } from "../types";
 
export const GRID_SIZE = 8;
 
// Creates a fresh empty 8x8 grid.
// We use Array.from with a map function to create independent row arrays.
// WARNING: Never use Array(8).fill(Array(8).fill(null)).
// That creates 8 references to the SAME inner array. Mutating one row mutates all.
export function createGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  );
}
 
// Returns true if the piece can be placed at the given top-left corner.
// Checks: piece stays within grid bounds, and no cell overlaps an existing block.
export function canPlace(grid: Grid, piece: Piece, row: number, col: number): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;  // Skip empty cells in piece shape
      const gr = row + r;
      const gc = col + c;
      if (gr < 0 || gr >= GRID_SIZE) return false;  // Out of bounds vertically
      if (gc < 0 || gc >= GRID_SIZE) return false;  // Out of bounds horizontally
      if (grid[gr][gc] !== null) return false;       // Cell already occupied
    }
  }
  return true;
}
 
// Places a piece on the grid and returns the NEW grid.
// We never mutate the existing grid — we clone it first.
// Immutability is critical for React state: if you mutate the grid array directly,
// React will not detect the change and will not re-render.
export function placePiece(grid: Grid, piece: Piece, row: number, col: number): Grid {
  const next = grid.map(r => [...r]);  // Deep clone: new array, new rows
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        next[row + r][col + c] = piece.color;
      }
    }
  }
  return next;
}
 
// Scans all rows and columns. Removes any that are fully filled.
// Returns the new grid and a count of how many lines were cleared.
// Lines cleared in one drop count together for combo scoring.
export function clearLines(grid: Grid): { grid: Grid; linesCleared: number } {
  const next = grid.map(r => [...r]);
  let linesCleared = 0;
 
  // Check rows
  for (let r = 0; r < GRID_SIZE; r++) {
    if (next[r].every(cell => cell !== null)) {
      next[r] = Array(GRID_SIZE).fill(null);
      linesCleared++;
    }
  }
 
  // Check columns
  for (let c = 0; c < GRID_SIZE; c++) {
    if (next.every(row => row[c] !== null)) {
      for (let r = 0; r < GRID_SIZE; r++) next[r][c] = null;
      linesCleared++;
    }
  }
 
  return { grid: next, linesCleared };
}
 
// Checks if ANY of the pieces in the tray can be placed anywhere on the grid.
// If this returns false, the player is stuck and the level ends early.
export function hasAnyValidMove(grid: Grid, pieces: (Piece | null)[]): boolean {
  for (const piece of pieces) {
    if (!piece) continue;
    for (let r = 0; r <= GRID_SIZE - piece.shape.length; r++) {
      for (let c = 0; c <= GRID_SIZE - piece.shape[0].length; c++) {
        if (canPlace(grid, piece, r, c)) return true;
      }
    }
  }
  return false;
}
