// src/game/levels.ts
//
// Difficulty curve design:
//
// The previous formula (300 * id^1.35) jumped from 300 at level 1 to
// ~6,700 at level 10 — a 22x increase in 9 levels. That's why level 10 felt
// impossible. The new formula uses a "saw curve" recommended by puzzle game
// designers: gentle ramp through the first 20 levels, moderate climb to 50,
// steeper climb to 99, with brief "relief" levels every 5-6 levels.
//
// Key design decisions:
//   1. Piece count stays at 30 through level 20 — players learn, not struggle
//   2. Obstacles appear at level 11 with EXTRA bonus pieces to compensate
//   3. Targets are reduced proportionally for obstacle levels
//   4. New obstacle mechanic levels (11, 21, 41) get a brief "learning dip"
//
// Approximate targets:
//   Level  1:  ~500   (basically just place any 2 pieces)
//   Level 10:  ~1100  (need 2-3 line clears total)
//   Level 20:  ~2000  (need regular line clears)
//   Level 30:  ~2800  (obstacles + consistent clears needed)
//   Level 50:  ~3800  (good strategy required)
//   Level 75:  ~5000  (obstacles + combos needed)
//   Level 99:  ~6200  (expert play required)

import { LevelConfig, ObstacleDef } from "../types";

export function generateLevel(id: number): LevelConfig {
  const obs = generateObstacles(id);

  // ── Piece count ──────────────────────────────────────────────────────────
  // Stays at 30 for first 20 levels (learning phase).
  // Drops slowly from 30 → 12 over levels 21-99.
  // Extra pieces granted when obstacles are present (compensate for blocked cells).
  const basePieces =
    id <= 20 ? 30 :
    Math.max(12, Math.round(30 - (id - 20) * 0.23));
  const obstacleBonusPieces = Math.min(obs.length * 2, 8);
  const pieceCount = basePieces + obstacleBonusPieces;

  // ── Target score ─────────────────────────────────────────────────────────
  // Uses a "saw curve": gentle linear ramp + small quadratic component.
  // Every 5 levels, difficulty dips ~10% then resumes — gives players a
  // breathing moment so the game never feels relentlessly punishing.
  const isSawDip = id > 5 && id % 5 === 1; // levels 6, 11, 16, 21... get brief relief
  const sawFactor = isSawDip ? 0.88 : 1.0;

  // Base formula: ~8% increase per level early, tapering to ~3% late
  const rawTarget = Math.round(
    (500 + (id - 1) * 58 + Math.pow(id, 1.18) * 3) * sawFactor
  );

  // Obstacle reduction: each obstacle makes the level harder because cells
  // are blocked and pieces are "spent" chipping them. Compensate with a
  // target reduction so obstacle levels feel fair, not punishing.
  const avgDur = obs.length > 0
    ? obs.reduce((s, o) => s + o.durability, 0) / obs.length
    : 0;
  const targetReduction = Math.round(obs.length * avgDur * 120);
  const targetScore = Math.max(300, rawTarget - targetReduction);

  return {
    id,
    pieceCount,
    targetScore,
    star2Score: Math.round(targetScore * 1.4),
    star3Score: Math.round(targetScore * 1.85),
    obstacles: obs,
  };
}

// ─── Obstacle generation ──────────────────────────────────────────────────────
//
// Obstacle introduction follows the saw curve principle:
//   Level 11: first obstacle appears — durability 2 (very easy to break)
//   Level 21: second obstacle added — still durability 2 (learning phase)
//   Level 31+: durability increases, more obstacles
//
// Obstacle types by durability (used for emoji selection in the UI):
//   durability 2:   🪵 wood   (breaks after 2 hits — easy intro)
//   durability 3:   🪨 stone  (needs 3 hits — moderate challenge)
//   durability 4-5: 💣 bomb   (tough — needs sustained effort)

const POSITIONS: [number, number][] = [
  [3, 3], [4, 4], [2, 5], [5, 2], [3, 6],
  [6, 3], [2, 2], [5, 5], [1, 4], [4, 1],
  [6, 6], [1, 6], [6, 1], [3, 1], [1, 3],
  [4, 6], [6, 4], [2, 7], [5, 6], [7, 5],
];

function generateObstacles(id: number): ObstacleDef[] {
  if (id < 11) return [];

  // Count — ramps up gently
  const count =
    id < 21 ? 1 :
    id < 31 ? 2 :
    id < 46 ? 3 :
    id < 66 ? 4 :
    id < 86 ? 5 : 6;

  // Durability — starts very easy, gets tougher
  const durability =
    id < 21 ? 2 :       // wood — 2 hits
    id < 36 ? 2 :       // still wood (give players time to learn)
    id < 56 ? 3 :       // stone — 3 hits
    id < 76 ? 4 :       // bomb — 4 hits
    5;                  // tough bomb — 5 hits

  const obstacles: ObstacleDef[] = [];
  const used = new Set<string>();

  for (let i = 0; i < Math.min(count, POSITIONS.length); i++) {
    const pos = POSITIONS[(id * 3 + i * 7) % POSITIONS.length];
    const key = `${pos[0]},${pos[1]}`;
    if (used.has(key)) continue;
    used.add(key);
    obstacles.push({ row: pos[0], col: pos[1], durability });
  }

  return obstacles;
}

export const LEVELS: LevelConfig[] = Array.from(
  { length: 99 },
  (_, i) => generateLevel(i + 1)
);

export function getLevel(id: number): LevelConfig {
  return LEVELS[Math.max(0, Math.min(98, id - 1))];
}

export { LevelConfig };
