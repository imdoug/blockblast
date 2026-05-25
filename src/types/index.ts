// The game grid is a 2D array of 8 rows and 8 columns.
// Each cell is either null (empty) or a number (the color index of the piece that filled it).
export type Grid = (number | null)[][];
 
// A Piece is one of the shapes from our PIECES array.
// shape is a 2D array where 1 = filled cell, 0 = empty.
// color is an index into the COLORS array.
export interface Piece {
  shape: number[][];
  color: number;
}
 
// The tray always holds exactly 3 slots.
// A slot can be null if the piece has been placed and not yet refilled.
export type Tray = [Piece | null, Piece | null, Piece | null];
 
// LevelConfig defines everything about a single level.
export interface LevelConfig {
  id: number;           // 1-99
  pieceCount: number;   // Total pieces the player gets
  targetScore: number;  // Minimum score to pass (1 star)
  star2Score: number;   // Score for 2 stars
  star3Score: number;   // Score for 3 stars
}
 
// GamePhase tracks what state the level is in.
// This drives which UI to show (game board, results screen, etc).
export type GamePhase =
  | 'playing'       // Active gameplay
  | 'won'           // pieceCount hit 0, score >= targetScore
  | 'failed'        // pieceCount hit 0, score < targetScore
  | 'stuck'         // No valid moves remain (early termination)
  | 'paused';
 
// GameState is the complete snapshot of a level at any point in time.
// The useGameState hook manages this object.
export interface GameState {
  grid: Grid;
  tray: Tray;
  selectedIndex: number;    // Which tray slot is active (0, 1, or 2)
  score: number;
  piecesRemaining: number;  // Counts down from level.pieceCount to 0
  combo: number;            // Consecutive line-clearing drops
  phase: GamePhase;
  level: LevelConfig;
}
