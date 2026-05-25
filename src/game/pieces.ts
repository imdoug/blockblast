import { Piece } from "../types";
 
// All piece definitions. Shape arrays use 1 for filled, 0 for empty.
// Color indices 0-7 map to the COLORS array in theme.ts.
export const PIECES: Piece[] = [
  { shape: [[1]], color: 0 },                           // 1x1
  { shape: [[1,1]], color: 1 },                         // 1x2 H
  { shape: [[1],[1]], color: 1 },                       // 1x2 V
  { shape: [[1,1,1]], color: 2 },                       // 1x3 H
  { shape: [[1],[1],[1]], color: 2 },                   // 1x3 V
  { shape: [[1,1,1,1]], color: 7 },                     // 1x4 H
  { shape: [[1],[1],[1],[1]], color: 7 },               // 1x4 V
  { shape: [[1,1],[1,1]], color: 3 },                   // 2x2
  { shape: [[1,1,1],[1,1,1]], color: 3 },               // 2x3
  { shape: [[1,1,1],[1,0,0]], color: 4 },               // L
  { shape: [[1,1,1],[0,0,1]], color: 4 },               // J
  { shape: [[1,0],[1,0],[1,1]], color: 4 },             // L vertical
  { shape: [[0,1],[0,1],[1,1]], color: 4 },             // J vertical
  { shape: [[1,1,1],[0,1,0]], color: 5 },               // T
  { shape: [[1,0],[1,1],[1,0]], color: 5 },             // T rotated
  { shape: [[0,1,1],[1,1,0]], color: 6 },               // S
  { shape: [[1,1,0],[0,1,1]], color: 6 },               // Z
];
 
// Returns a deep copy of a random piece from the PIECES array.
// Deep copy is essential: if multiple tray slots got the same piece object,
// mutating one would affect the others.
export function randomPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { ...p, shape: p.shape.map(row => [...row]) };
}
 
// Seeded random for Daily Challenge mode.
// Uses a simple LCG (Linear Congruential Generator).
// Same seed → same sequence of pieces → same puzzle for all players worldwide.
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
 
// Generates a daily seed from today's date.
// All players on the same calendar day get the same seed regardless of timezone.
// We use UTC date to avoid edge cases around midnight in different timezones.
export function getDailySeed(): number {
  const now = new Date();
  const utcDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return utcDate / 86400000;  // Days since Unix epoch — a stable daily integer
}
 
export function randomPieceSeeded(rng: () => number): Piece {
  const p = PIECES[Math.floor(rng() * PIECES.length)];
  return { ...p, shape: p.shape.map(row => [...row]) };
}

