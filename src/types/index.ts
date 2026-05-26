// src/types/index.ts

export type Grid = (number | null)[][];

export interface Piece {
  shape: number[][];
  color: number;
}

export type Tray = [Piece | null, Piece | null, Piece | null];

// ─── Obstacle cell ────────────────────────────────────────────────────────────
// Obstacles are pre-placed cells that can't be moved through.
// They take "hits" when a row or column containing them is completed.
// At 0 durability they are destroyed and the cell becomes empty.
// This means players can clear rows "through" obstacles — the row still
// scores and clears, but the obstacle absorbs a hit instead of disappearing
// until its durability is fully depleted.

export interface ObstacleCell {
  durability: number;     // current hits remaining
  maxDurability: number;  // starting durability (for visual rendering)
}

// ObstacleGrid is a separate layer that overlays the piece grid.
// Keeping them separate means all existing piece logic (canPlace, clearLines)
// requires only minimal changes — we just pass the obstacle layer as an
// optional extra parameter.
export type ObstacleGrid = (ObstacleCell | null)[][];

export interface LevelConfig {
  id: number;
  pieceCount: number;
  targetScore: number;
  star2Score: number;
  star3Score: number;
  obstacles: ObstacleDef[];
}

// ObstacleDef defines where obstacles start on the board for a given level.
export interface ObstacleDef {
  row: number;
  col: number;
  durability: number;
}

export interface LevelResult {
  stars: number;
  score: number;
}

export type GamePhase = "playing" | "won" | "failed" | "stuck";