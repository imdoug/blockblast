// Base points per cell placed. A 3x3 piece = 9 cells = 90 base points.
const POINTS_PER_CELL = 10;
 
// Points per line cleared, before combo multiplier.
const POINTS_PER_LINE = 100;
 
// How much the combo multiplier grows per consecutive clearing drop.
// After 3 clearing drops in a row: multiplier = 1 + (3 * 0.5) = 2.5x
const COMBO_MULTIPLIER_STEP = 0.5;
const MAX_COMBO_MULTIPLIER = 5.0;
 
export interface ScoreResult {
  pointsEarned: number;
  newCombo: number;
  newScore: number;
}
 
export function calculateScore(
  currentScore: number,
  currentCombo: number,
  cellsPlaced: number,
  linesCleared: number
): ScoreResult {
  const basePoints = cellsPlaced * POINTS_PER_CELL;
 
  // Combo only applies to line clears, not base placement.
  const newCombo = linesCleared > 0 ? currentCombo + 1 : 0;
  const multiplier = linesCleared > 0
    ? Math.min(1 + newCombo * COMBO_MULTIPLIER_STEP, MAX_COMBO_MULTIPLIER)
    : 1;
 
  const linePoints = linesCleared * POINTS_PER_LINE * multiplier;
  const pointsEarned = Math.round(basePoints + linePoints);
 
  return {
    pointsEarned,
    newCombo,
    newScore: currentScore + pointsEarned,
  };
}
 
// Counts the number of filled cells in a piece shape.
export function countCells(shape: number[][]): number {
  return shape.flat().reduce((sum, cell) => sum + cell, 0);
}
