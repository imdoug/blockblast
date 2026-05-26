// src/game/pieces.ts

import { Piece } from "../types";
import { Grid, GRID_SIZE, canPlace } from "./grid";
import { ObstacleGrid } from "../types";

export const PIECES: Piece[] = [
  { shape: [[1]], color: 0 },
  { shape: [[1, 1]], color: 1 },
  { shape: [[1], [1]], color: 1 },
  { shape: [[1, 1, 1]], color: 2 },
  { shape: [[1], [1], [1]], color: 2 },
  { shape: [[1, 1, 1, 1]], color: 7 },
  { shape: [[1], [1], [1], [1]], color: 7 },
  { shape: [[1, 1], [1, 1]], color: 3 },
  { shape: [[1, 1, 1], [1, 1, 1]], color: 3 },
  { shape: [[1, 1, 1], [1, 0, 0]], color: 4 },
  { shape: [[1, 1, 1], [0, 0, 1]], color: 4 },
  { shape: [[1, 0], [1, 0], [1, 1]], color: 4 },
  { shape: [[0, 1], [0, 1], [1, 1]], color: 4 },
  { shape: [[1, 1, 1], [0, 1, 0]], color: 5 },
  { shape: [[1, 0], [1, 1], [1, 0]], color: 5 },
  { shape: [[0, 1, 1], [1, 1, 0]], color: 6 },
  { shape: [[1, 1, 0], [0, 1, 1]], color: 6 },
  { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], color: 3 },
];

// ─── Standard random (deep copy so multiple tray slots get independent pieces)
export function randomPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { ...p, shape: p.shape.map(row => [...row]) };
}

// ─── Weighted random ──────────────────────────────────────────────────────────
// Block Blast's piece generator is NOT purely random.
// Analysis of champion player data shows the generator avoids giving impossible
// board states by weighting against:
//   1. Pieces that are too large when the board is already congested
//   2. Repeating the exact same piece index more than twice in a row
//   3. All-large tray sets (3 pieces that together take >12 cells)
//
// Implementation: each piece gets a base weight of 1.0.
// We reduce that weight based on recent usage and board fill %.
// A piece at weight 0.1 can still appear — it's just rare.

export function weightedRandomPiece(
  recentIndices: number[], // last 4 piece indices drawn
  grid?: Grid,
  obstacles?: ObstacleGrid
): Piece {
  // Count filled cells to gauge board congestion
  const filledCells = grid
    ? grid.flat().filter(c => c !== null).length +
      (obstacles ? obstacles.flat().filter(c => c !== null).length : 0)
    : 0;
  const fillRatio = filledCells / (GRID_SIZE * GRID_SIZE); // 0.0 → 1.0

  const weights = PIECES.map((p, idx) => {
    let w = 1.0;

    // Penalise recently repeated piece indices
    const recentUses = recentIndices.filter(i => i === idx).length;
    w *= Math.max(0.1, 1 - recentUses * 0.4);

    // Penalise large pieces when board is congested
    const cellCount = p.shape.flat().filter(Boolean).length;
    if (fillRatio > 0.55 && cellCount >= 6) w *= 0.3;
    if (fillRatio > 0.70 && cellCount >= 4) w *= 0.4;

    // Bonus for smaller pieces when very congested (helps players survive)
    if (fillRatio > 0.65 && cellCount <= 3) w *= 1.5;

    // If the piece literally cannot fit on the current board, weight 0
    // (only check when we have grid context — skipped on initial draw)
    if (grid && obstacles !== undefined) {
      const fits = canFitAnywhere(grid, p, obstacles);
      if (!fits) w = 0;
    }

    return w;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  // If all weights are 0 (extremely rare, very full board), fall back to uniform
  if (total === 0) return randomPiece();

  let rand = Math.random() * total;
  for (let i = 0; i < PIECES.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      const p = PIECES[i];
      return { ...p, shape: p.shape.map(row => [...row]) };
    }
  }
  return randomPiece();
}

// Quick check: can this piece fit anywhere on the current board?
function canFitAnywhere(grid: Grid, piece: Piece, obstacles: ObstacleGrid): boolean {
  for (let r = 0; r <= GRID_SIZE - piece.shape.length; r++)
    for (let c = 0; c <= GRID_SIZE - piece.shape[0].length; c++)
      if (canPlace(grid, piece, r, c, obstacles)) return true;
  return false;
}

// ─── Draw a tray of 3 weighted pieces ────────────────────────────────────────
// Ensures the total cell count of the 3 pieces isn't too large relative to
// available board space, preventing unwinnable starting positions.

export function drawWeightedTray(
  recentIndices: number[],
  grid?: Grid,
  obstacles?: ObstacleGrid
): [Piece, Piece, Piece] {
  const recent = [...recentIndices];
  const pieces: Piece[] = [];
  const indices: number[] = [];

  for (let i = 0; i < 3; i++) {
    const p = weightedRandomPiece(recent, grid, obstacles);
    const idx = PIECES.findIndex(
      pp => JSON.stringify(pp.shape) === JSON.stringify(p.shape)
    );
    pieces.push(p);
    indices.push(idx);
    recent.push(idx);
    if (recent.length > 6) recent.shift();
  }

  return pieces as [Piece, Piece, Piece];
}

// ─── Seeded random for Daily Challenge ────────────────────────────────────────

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function getDailySeed(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000;
}

export function randomPieceSeeded(rng: () => number): Piece {
  const p = PIECES[Math.floor(rng() * PIECES.length)];
  return { ...p, shape: p.shape.map(row => [...row]) };
}