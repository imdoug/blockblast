// src/game/grid.ts

import { Grid, Piece, ObstacleGrid } from "../types";

export const GRID_SIZE = 8;

export function createGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

export function createObstacleGrid(
  defs: { row: number; col: number; durability: number }[]
): ObstacleGrid {
  const grid: ObstacleGrid = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  );
  for (const { row, col, durability } of defs) {
    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      grid[row][col] = { durability, maxDurability: durability };
    }
  }
  return grid;
}

export function canPlace(
  grid: Grid,
  piece: Piece,
  row: number,
  col: number,
  obstacles?: ObstacleGrid
): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const gr = row + r, gc = col + c;
      if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) return false;
      if (grid[gr][gc] !== null) return false;
      if (obstacles && obstacles[gr][gc] !== null) return false;
    }
  }
  return true;
}

export function placePiece(grid: Grid, piece: Piece, row: number, col: number): Grid {
  const next = grid.map(r => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) next[row + r][col + c] = piece.color;
  return next;
}

// ─── clearLines ───────────────────────────────────────────────────────────────
//
// CRITICAL FIX: We scan ALL rows AND columns for completion BEFORE clearing
// anything. The previous version scanned rows first, cleared them (setting
// cells to null), then scanned columns — cleared cells appeared empty so valid
// columns were never detected.
//
// Fix: two-pass approach:
//   Pass 1 — identify every row and column that is currently complete
//   Pass 2 — apply all clears and obstacle hits atomically
//
// A row/col is complete when every cell has EITHER a piece OR an obstacle.
// Obstacles absorb a hit when their row/col clears. If the same obstacle cell
// is in BOTH a cleared row AND a cleared column, it takes 2 hits (double clear
// bonus — a reward for strategic play around obstacles).
//
// Returns:
//   grid            — updated piece grid
//   obstacles       — updated obstacle grid (hits applied, 0-durability removed)
//   linesCleared    — total rows + cols cleared (for combo scoring)
//   obstaclesHit    — how many obstacle hits occurred (for bonus scoring)
//   obstaclesDestroyed — how many obstacles reached 0 and were removed

export function clearLines(
  grid: Grid,
  obstacles?: ObstacleGrid
): {
  grid: Grid;
  obstacles: ObstacleGrid;
  linesCleared: number;
  obstaclesHit: number;
  obstaclesDestroyed: number;
} {
  const obs: ObstacleGrid = obstacles
    ? obstacles.map(r => r.map(c => (c ? { ...c } : null)))
    : Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

  // ── Pass 1: identify complete rows and columns ───────────────────────────
  // Use original grid state — do NOT check the mutated version.
  const rowsToClear: number[] = [];
  const colsToClear: number[] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    if (grid[r].every((cell, c) => cell !== null || obs[r][c] !== null)) {
      rowsToClear.push(r);
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    if (grid.every((row, r) => row[c] !== null || obs[r][c] !== null)) {
      colsToClear.push(c);
    }
  }

  if (rowsToClear.length === 0 && colsToClear.length === 0) {
    return { grid, obstacles: obs, linesCleared: 0, obstaclesHit: 0, obstaclesDestroyed: 0 };
  }

  // ── Pass 2: apply all clears atomically ──────────────────────────────────
  const newGrid = grid.map(r => [...r]);
  // Track how many hits each obstacle cell takes (could be in both row + col)
  const hitsMap: number[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(0)
  );

  for (const r of rowsToClear) {
    for (let c = 0; c < GRID_SIZE; c++) {
      newGrid[r][c] = null;
      if (obs[r][c] !== null) hitsMap[r][c]++;
    }
  }

  for (const c of colsToClear) {
    for (let r = 0; r < GRID_SIZE; r++) {
      newGrid[r][c] = null;
      if (obs[r][c] !== null) hitsMap[r][c]++;
    }
  }

  // Apply accumulated hits to obstacles
  let obstaclesHit = 0;
  let obstaclesDestroyed = 0;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const hits = hitsMap[r][c];
      if (hits === 0) continue;
      obstaclesHit += hits;
      const current = obs[r][c];
      if (!current) continue;
      const newDur = current.durability - hits;
      if (newDur <= 0) {
        obs[r][c] = null;
        obstaclesDestroyed++;
      } else {
        obs[r][c] = { ...current, durability: newDur };
      }
    }
  }

  return {
    grid: newGrid,
    obstacles: obs,
    linesCleared: rowsToClear.length + colsToClear.length,
    obstaclesHit,
    obstaclesDestroyed,
  };
}

export function hasAnyValidMove(
  grid: Grid,
  pieces: (Piece | null)[],
  obstacles?: ObstacleGrid
): boolean {
  for (const piece of pieces) {
    if (!piece) continue;
    for (let r = 0; r <= GRID_SIZE - piece.shape.length; r++)
      for (let c = 0; c <= GRID_SIZE - piece.shape[0].length; c++)
        if (canPlace(grid, piece, r, c, obstacles)) return true;
  }
  return false;
}

export { Grid };
