// src/game/scoring.ts

const POINTS_PER_CELL        = 10;
const POINTS_PER_LINE        = 100;
const COMBO_MULTIPLIER_STEP  = 0.5;
const MAX_COMBO_MULTIPLIER   = 5.0;

// Obstacle bonuses — make breaking blocks feel rewarding
const OBSTACLE_HIT_BONUS     = 75;   // per hit on any obstacle
const OBSTACLE_DESTROY_BONUS = 400;  // extra when obstacle fully destroyed

export interface ScoreResult {
  pointsEarned: number;
  newCombo: number;
  newScore: number;
  // Breakdown for UI display
  basePoints: number;
  linePoints: number;
  obstaclePoints: number;
}

export function calculateScore(
  currentScore: number,
  currentCombo: number,
  cellsPlaced: number,
  linesCleared: number,
  obstaclesHit: number = 0,
  obstaclesDestroyed: number = 0
): ScoreResult {
  const basePoints = cellsPlaced * POINTS_PER_CELL;

  const newCombo = linesCleared > 0 ? currentCombo + 1 : 0;
  const multiplier = linesCleared > 0
    ? Math.min(1 + newCombo * COMBO_MULTIPLIER_STEP, MAX_COMBO_MULTIPLIER)
    : 1;

  const linePoints = Math.round(linesCleared * POINTS_PER_LINE * multiplier);

  // Obstacle points: hits + a bigger bonus for full destruction.
  // Combo multiplier also applies to obstacle points — strategic obstacle
  // clearing during a combo streak is rewarded.
  const obstaclePoints = Math.round(
    (obstaclesHit * OBSTACLE_HIT_BONUS + obstaclesDestroyed * OBSTACLE_DESTROY_BONUS)
    * (newCombo > 1 ? Math.min(newCombo * 0.5 + 0.5, 2.5) : 1)
  );

  const pointsEarned = basePoints + linePoints + obstaclePoints;

  return {
    pointsEarned,
    newCombo,
    newScore: currentScore + pointsEarned,
    basePoints,
    linePoints,
    obstaclePoints,
  };
}

export function countCells(shape: number[][]): number {
  return shape.flat().reduce((sum, cell) => sum + cell, 0);
}