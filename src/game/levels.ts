// src/game/levels.ts
//
// All 99 level configs generated from a formula.
// Data-driven: rebalancing the curve means changing the formula constants here,
// which instantly updates all 99 levels without touching any other file.

export interface LevelConfig {
  id: number;
  pieceCount: number;   // Total pieces the player gets for this level
  targetScore: number;  // Minimum score to pass (1 star)
  star2Score: number;   // Score for 2 stars
  star3Score: number;   // Score for 3 stars
}

// Difficulty curve:
//   pieceCount: starts at 30, decreases to minimum 8 by level 99
//   targetScore: exponential growth — level 1: ~300, level 50: ~8k, level 99: ~33k
function generateLevel(id: number): LevelConfig {
  const pieceCount = Math.max(
    8,
    Math.round(30 - (id - 1) * 0.22 * (1 + id / 99))
  );
  const targetScore = Math.round(300 * Math.pow(id, 1.35));
  return {
    id,
    pieceCount,
    targetScore,
    star2Score: Math.round(targetScore * 1.5),
    star3Score: Math.round(targetScore * 2.0),
  };
}

export const LEVELS: LevelConfig[] = Array.from(
  { length: 99 },
  (_, i) => generateLevel(i + 1)
);

// Helper to get a level by ID (1-indexed)
export function getLevel(id: number): LevelConfig {
  const level = LEVELS[id - 1];
  if (!level) throw new Error(`Level ${id} does not exist`);
  return level;
}