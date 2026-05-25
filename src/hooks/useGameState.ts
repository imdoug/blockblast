
import { useState, useCallback } from "react";
import { Grid, Tray, GameState, GamePhase, LevelConfig } from "../types";
import { createGrid, canPlace, placePiece, clearLines, hasAnyValidMove } from "../game/grid";
import { randomPiece } from "../game/pieces";
import { calculateScore, countCells } from "../game/scoring";
 
function createInitialState(level: LevelConfig): GameState {
  const grid = createGrid();
  const tray: Tray = [randomPiece(), randomPiece(), randomPiece()];
  return {
    grid,
    tray,
    selectedIndex: 0,
    score: 0,
    piecesRemaining: level.pieceCount,
    combo: 0,
    phase: 'playing',
    level,
  };
}
 
export function useGameState(level: LevelConfig) {
  const [state, setState] = useState<GameState>(() => createInitialState(level));
 
  // Called when the user releases a piece onto the grid.
  const dropPiece = useCallback((row: number, col: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
 
      const piece = prev.tray[prev.selectedIndex];
      if (!piece) return prev;
      if (!canPlace(prev.grid, piece, row, col)) return prev;
 
      // 1. Place the piece
      const newGrid = placePiece(prev.grid, piece, row, col);
 
      // 2. Clear completed lines
      const { grid: clearedGrid, linesCleared } = clearLines(newGrid);
 
      // 3. Score
      const { pointsEarned, newCombo, newScore } = calculateScore(
        prev.score, prev.combo, countCells(piece.shape), linesCleared
      );
 
      // 4. Update the tray: remove the used piece
      const newTray = [...prev.tray] as Tray;
      newTray[prev.selectedIndex] = null;
 
      // 5. If all 3 pieces are used, refill the entire tray
      const allUsed = newTray.every(p => p === null);
      const finalTray: Tray = allUsed
        ? [randomPiece(), randomPiece(), randomPiece()]
        : newTray;
 
      // 6. Decrement piece counter
      const piecesRemaining = prev.piecesRemaining - 1;
 
      // 7. Determine next selected index (skip nulls)
      let nextSelected = prev.selectedIndex;
      if (!allUsed) {
        for (let i = 1; i <= 3; i++) {
          const idx = (prev.selectedIndex + i) % 3;
          if (finalTray[idx]) { nextSelected = idx; break; }
        }
      } else {
        nextSelected = 0;
      }
 
      // 8. Determine game phase
      let phase: GamePhase = 'playing';
      if (piecesRemaining <= 0) {
        phase = newScore >= prev.level.targetScore ? 'won' : 'failed';
      } else if (!hasAnyValidMove(clearedGrid, finalTray)) {
        phase = 'stuck';
      }
 
      return {
        ...prev,
        grid: clearedGrid,
        tray: finalTray,
        selectedIndex: nextSelected,
        score: newScore,
        piecesRemaining,
        combo: newCombo,
        phase,
      };
    });
  }, []);
 
  const selectPiece = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedIndex: index }));
  }, []);
 
  const restart = useCallback(() => {
    setState(createInitialState(state.level));
  }, [state.level]);
 
  // Grant extra pieces (rewarded ad perk)
  const addBonusPieces = useCallback((count: number) => {
    setState(prev => ({
      ...prev,
      piecesRemaining: prev.piecesRemaining + count,
      phase: 'playing',
    }));
  }, []);
 
  return { state, dropPiece, selectPiece, restart, addBonusPieces };
}
