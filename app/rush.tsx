// app/rush/index.tsx
//
// Pressure Mode — BloxBurst's second game mode.
//
// Core mechanic: every cell has a point multiplier that counts DOWN each turn.
// Cells NEVER lock or disappear — the board clears exactly like classic Block Blast.
// The pressure comes from the board filling up (organic, same as Block Blast),
// not from artificial decay penalties.
//
// The number on each cell = its current score multiplier.
// Clear a row fast → cells still have high values → big score.
// Clear the same row slowly → values are low → small score.
// This creates a natural speed-vs-strategy tension without ever feeling unfair.
//
// Scoring:
//   Base:  cells placed × startingValue × 10
//   Clear: sum of all cell values in cleared lines × 20
//   Combo: consecutive clearing turns stack a multiplier (same as classic mode)

import {
  View, Text, StyleSheet, TouchableOpacity,
  PanResponder, Animated, Dimensions,
} from "react-native";
import { useRef, useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import { COLORS, SIZES } from "../src/constants/theme";
import { canPlace, hasAnyValidMove } from "../src/game/grid";
import { randomPiece } from "../src/game/pieces";
import { Grid, Piece, Tray } from "../src/types";

// ─── Rush cell ────────────────────────────────────────────────────────────────
// Each cell stores its color + a live multiplier value that decays over turns.
// Value hits 0 minimum — cell stays fully playable, just scores less.

interface RushCell {
  color: number;    // piece color (0-7) for rendering
  value: number;    // current multiplier, minimum 1
  maxValue: number; // starting value, set by piece size
}

type RushGrid = (RushCell | null)[][];

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_SIZE   = 8;
const LIFT_OFFSET = 110;

// Starting multiplier per piece, based on total filled cells.
// Larger/harder pieces start with a higher multiplier — more risk, more reward.
function startingValue(cellCount: number): number {
  if (cellCount === 1) return 2;
  if (cellCount <= 3) return 3;
  if (cellCount <= 5) return 4;
  if (cellCount <= 6) return 5;
  return 6; // 7-9 cells (2×3, 3×3)
}

// ─── Responsive sizing ────────────────────────────────────────────────────────

const SCREEN_H  = Dimensions.get("window").height;
const SCREEN_W  = Dimensions.get("window").width;
const GAP       = 4;
const AVAILABLE = Math.min(SCREEN_H * 0.5, SCREEN_W - 32);
const RAW_CELL  = Math.floor(AVAILABLE / GRID_SIZE) - GAP;
const CELL_SIZE = Math.max(30, Math.min(RAW_CELL, 44));
const CELL_STEP = CELL_SIZE + GAP;
const CELL_R    = Math.round(CELL_SIZE * 0.22);

// ─── Value → color ────────────────────────────────────────────────────────────
// Cell background shifts with the multiplier so the player can read board state
// at a glance: green = high value, red = decayed.

function valueToColor(value: number, maxValue: number): string {
  const ratio = value / maxValue;
  if (ratio >= 0.85) return "#52C97A"; // fresh green
  if (ratio >= 0.65) return "#4ECDC4"; // teal
  if (ratio >= 0.45) return "#FFE66D"; // yellow
  if (ratio >= 0.25) return "#FD9644"; // orange
  return "#FF6B6B";                    // red — very stale, low score
}

// Text color on top of the cell background — always dark for readability
function valueTextColor(value: number, maxValue: number): string {
  const ratio = value / maxValue;
  return ratio >= 0.45 ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.55)";
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────

function createRushGrid(): RushGrid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

// Convert RushGrid → base Grid for canPlace / hasAnyValidMove
function toBase(rg: RushGrid): (number | null)[][] {
  return rg.map(row => row.map(c => c !== null ? c.color : null));
}

// Place a piece — cells get their starting multiplier based on piece size
function rushPlace(grid: RushGrid, piece: Piece, row: number, col: number): RushGrid {
  const next = grid.map(r => r.map(c => c ? { ...c } : null));
  const cellCount = piece.shape.flat().filter(Boolean).length;
  const val = startingValue(cellCount);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        next[row + r][col + c] = { color: piece.color, value: val, maxValue: val };
  return next;
}

// Decay all cells by 1 after each drop. Minimum value is 1 — never 0.
// This means cells ALWAYS score something and NEVER block the board.
function decayGrid(grid: RushGrid): RushGrid {
  return grid.map(row =>
    row.map(cell => {
      if (!cell) return null;
      return { ...cell, value: Math.max(1, cell.value - 1) };
    })
  );
}

// Clear completed rows and columns.
// Score = sum of cell values × 20 (reward clearing while values are still high).
// Returns new grid, lines cleared count, and score earned from clears.
function rushClear(grid: RushGrid): {
  grid: RushGrid;
  linesCleared: number;
  clearScore: number;
} {
  const next = grid.map(r => r.map(c => c ? { ...c } : null));
  let linesCleared = 0;
  let clearScore = 0;

  for (let r = 0; r < GRID_SIZE; r++) {
    if (next[r].every(c => c !== null)) {
      clearScore += next[r].reduce((s, c) => s + (c?.value ?? 0), 0);
      next[r] = Array(GRID_SIZE).fill(null);
      linesCleared++;
    }
  }

  for (let c = 0; c < GRID_SIZE; c++) {
    if (next.every(row => row[c] !== null)) {
      clearScore += next.reduce((s, row) => s + (row[c]?.value ?? 0), 0);
      for (let r = 0; r < GRID_SIZE; r++) next[r][c] = null;
      linesCleared++;
    }
  }

  return { grid: next, linesCleared, clearScore };
}

type Phase = "playing" | "over";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fingerToCell(fx: number, fy: number, origin: { x: number; y: number }, piece: Piece) {
  return {
    col: Math.floor((fx - origin.x) / CELL_STEP) - Math.floor(piece.shape[0].length / 2),
    row: Math.floor((fy - origin.y) / CELL_STEP) - Math.floor(piece.shape.length / 2),
  };
}

function clamp(row: number, col: number, piece: Piece) {
  return {
    row: Math.max(0, Math.min(row, GRID_SIZE - piece.shape.length)),
    col: Math.max(0, Math.min(col, GRID_SIZE - piece.shape[0].length)),
  };
}

// ─── Mini Piece ───────────────────────────────────────────────────────────────

function MiniPiece({ piece }: { piece: Piece }) {
  const color = COLORS.pieces[piece.color];
  const sz = Math.max(10, Math.min(14, CELL_SIZE * 0.32));
  return (
    <View>
      {piece.shape.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((cell, c) => (
            <View key={c} style={{
              width: sz, height: sz, margin: 1.5, borderRadius: 3,
              backgroundColor: cell ? color.fill : "transparent",
            }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Drag Shadow ──────────────────────────────────────────────────────────────

function DragShadow({ piece, position }: { piece: Piece; position: Animated.ValueXY }) {
  const color = COLORS.pieces[piece.color];
  const dc = CELL_SIZE * 1.1;
  return (
    <Animated.View pointerEvents="none" style={[
      StyleSheet.absoluteFill,
      { zIndex: 999, transform: position.getTranslateTransform() },
    ]}>
      {piece.shape.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((cell, c) => (
            <View key={c} style={{
              width: dc, height: dc, margin: 2, borderRadius: CELL_R,
              backgroundColor: cell ? color.fill : "transparent",
              opacity: cell ? 0.88 : 0,
            }} />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Score pop animation ──────────────────────────────────────────────────────

function ScorePop({ points, combo }: { points: number; combo: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -40, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", top: 0, alignSelf: "center",
        opacity, transform: [{ translateY }], zIndex: 50,
      }}
    >
      <Text style={{
        color: combo > 1 ? COLORS.accent : COLORS.primary,
        fontSize: combo > 1 ? 22 : 18,
        fontWeight: "bold",
      }}>
        +{points.toLocaleString()}{combo > 1 ? ` ×${combo}` : ""}
      </Text>
    </Animated.View>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  score, bestCombo, linesCleared, piecesPlaced, onReplay, onHome,
}: {
  score: number; bestCombo: number; linesCleared: number;
  piecesPlaced: number; onReplay: () => void; onHome: () => void;
}) {
  return (
    <View style={rsS.overlay}>
      <View style={rsS.modal}>
        <Text style={rsS.icon}>⚡</Text>
        <Text style={rsS.title}>Pressure Mode</Text>
        <Text style={rsS.subtitle}>No more moves!</Text>

        {/* Score */}
        <View style={rsS.scoreBox}>
          <Text style={rsS.scoreLabel}>SCORE</Text>
          <Text style={rsS.scoreNum}>{score.toLocaleString()}</Text>
        </View>

        {/* Stats */}
        <View style={rsS.statsRow}>
          <View style={rsS.stat}>
            <Text style={rsS.statNum}>{piecesPlaced}</Text>
            <Text style={rsS.statLabel}>pieces</Text>
          </View>
          <View style={rsS.stat}>
            <Text style={rsS.statNum}>{linesCleared}</Text>
            <Text style={rsS.statLabel}>lines cleared</Text>
          </View>
          <View style={rsS.stat}>
            <Text style={[rsS.statNum, bestCombo > 2 && { color: COLORS.accent }]}>
              ×{bestCombo}
            </Text>
            <Text style={rsS.statLabel}>best combo</Text>
          </View>
        </View>

        <TouchableOpacity style={rsS.btnPrimary} onPress={onReplay}>
          <Text style={rsS.btnText}>⚡  Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onHome} style={{ marginTop: 8 }}>
          <Text style={rsS.homeLink}>← Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rsS = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    backgroundColor: "#1B2A4A", borderRadius: 28,
    paddingHorizontal: 32, paddingVertical: 36,
    alignItems: "center", gap: 12, width: "88%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  icon: { fontSize: 44 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "bold" },
  subtitle: { color: COLORS.textDim, fontSize: 13, marginTop: -8 },
  scoreBox: {
    alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, paddingHorizontal: 40, paddingVertical: 12,
    width: "100%",
  },
  scoreLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 3 },
  scoreNum: { color: COLORS.accent, fontSize: 48, fontWeight: "bold" },
  statsRow: { flexDirection: "row", gap: 24 },
  stat: { alignItems: "center" },
  statNum: { color: COLORS.text, fontSize: 20, fontWeight: "bold" },
  statLabel: { color: COLORS.textDim, fontSize: 10 },
  btnPrimary: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 14,
    width: "100%", alignItems: "center", marginTop: 4,
  },
  btnText: { color: "#1B2A4A", fontSize: 16, fontWeight: "bold" },
  homeLink: { color: COLORS.textDim, fontSize: 14 },
});

// ─── Pressure / Rush Screen ───────────────────────────────────────────────────

export default function RushScreen() {
  const [grid, setGrid] = useState<RushGrid>(() => createRushGrid());
  const [tray, setTray] = useState<Tray>(() => [randomPiece(), randomPiece(), randomPiece()]);
  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [ghostValid, setGhostValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scorePop, setScorePop] = useState<{ id: number; pts: number; combo: number } | null>(null);
  const popId = useRef(0);

  const gridOrigin = useRef<{ x: number; y: number } | null>(null);
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Refs so PanResponder always sees fresh state
  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const scoreRef = useRef(score); scoreRef.current = score;
  const comboRef = useRef(combo); comboRef.current = combo;
  const bestComboRef = useRef(bestCombo); bestComboRef.current = bestCombo;
  const phaseRef = useRef(phase); phaseRef.current = phase;

  const activePiece = tray[selected];

  // Ghost preview cells
  const ghostCells = new Set<string>();
  if (ghost && activePiece && ghostValid) {
    for (let r = 0; r < activePiece.shape.length; r++)
      for (let c = 0; c < activePiece.shape[r].length; c++)
        if (activePiece.shape[r][c]) ghostCells.add(`${ghost.row + r},${ghost.col + c}`);
  }

  // Auto-clear score pop after animation completes
  useEffect(() => {
    if (!scorePop) return;
    const t = setTimeout(() => setScorePop(null), 950);
    return () => clearTimeout(t);
  }, [scorePop]);

  // ─── Drop ─────────────────────────────────────────────────────────────────────

  const dropAt = useCallback((row: number, col: number, pieceOverride?: Piece, trayIdx?: number) => {
    if (phaseRef.current !== "playing") return;
    const curGrid = gridRef.current;
    const curTray = trayRef.current;
    const curSel = trayIdx ?? selectedRef.current;
    const piece = pieceOverride ?? curTray[curSel];
    if (!piece || !canPlace(toBase(curGrid), piece, row, col)) return;

    // 1. Place the piece — cells get their starting multiplier
    const afterPlace = rushPlace(curGrid, piece, row, col);

    // 2. Check for line clears (BEFORE decay — fresh cells score highest)
    const { grid: afterClear, linesCleared, clearScore } = rushClear(afterPlace);

    // 3. Decay remaining cells after the clear
    //    This is the key design decision: decay happens AFTER scoring,
    //    so a freshly placed row that clears immediately always gets full value.
    const afterDecay = decayGrid(afterClear);

    // 4. Calculate score
    const cellCount = piece.shape.flat().filter(Boolean).length;
    const basePts = cellCount * startingValue(cellCount) * 10;
    const newCombo = linesCleared > 0 ? comboRef.current + 1 : 0;
    const comboMult = newCombo > 1 ? newCombo : 1;
    const linePts = clearScore * 20 * comboMult;
    const totalPts = basePts + linePts;
    const newScore = scoreRef.current + totalPts;
    const newBest = Math.max(bestComboRef.current, newCombo);

    // 5. Update tray
    const newTray = [...curTray] as Tray;
    newTray[curSel] = null;
    const allUsed = newTray.every(p => p === null);
    const finalTray: Tray = allUsed
      ? [randomPiece(), randomPiece(), randomPiece()]
      : newTray;
    let nextSel = allUsed ? 0 : curSel;
    if (!allUsed) {
      for (let i = 1; i <= 3; i++) {
        const idx = (curSel + i) % 3;
        if (finalTray[idx]) { nextSel = idx; break; }
      }
    }

    // 6. Check game over — same as Block Blast: no valid moves = done
    const isOver = !hasAnyValidMove(toBase(afterDecay), finalTray);

    setGrid(afterDecay);
    setTray(finalTray);
    setSelected(nextSel);
    setScore(newScore);
    setCombo(newCombo);
    setBestCombo(newBest);
    setTotalLines(l => l + linesCleared);
    setTotalPieces(p => p + 1);
    setGhost(null);
    setGhostValid(false);
    if (isOver) setPhase("over");

    // Show score pop when lines are cleared
    if (linesCleared > 0 || basePts > 0) {
      setScorePop({ id: ++popId.current, pts: totalPts, combo: newCombo });
    }
  }, []);

  // ─── Pan responders ───────────────────────────────────────────────────────────

  const panResponders = useRef([0, 1, 2].map(idx =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (e) => {
        if (phaseRef.current !== "playing") return;
        setSelected(idx); setIsDragging(true);
        dragPosition.setValue({
          x: e.nativeEvent.pageX - containerOrigin.current.x,
          y: e.nativeEvent.pageY - containerOrigin.current.y - LIFT_OFFSET,
        });
      },

      onPanResponderMove: (e) => {
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece) return;
        dragPosition.setValue({
          x: e.nativeEvent.pageX - containerOrigin.current.x,
          y: e.nativeEvent.pageY - containerOrigin.current.y - LIFT_OFFSET,
        });
        if (!gridOrigin.current) return;
        const { row, col } = fingerToCell(
          e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT_OFFSET,
          gridOrigin.current, piece
        );
        const c = clamp(row, col, piece);
        setGhost(c);
        setGhostValid(canPlace(toBase(gridRef.current), piece, c.row, c.col));
      },

      onPanResponderRelease: (e) => {
        setIsDragging(false); setGhost(null); setGhostValid(false);
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece || !gridOrigin.current) return;
        const { row, col } = fingerToCell(
          e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT_OFFSET,
          gridOrigin.current, piece
        );
        const c = clamp(row, col, piece);
        dropAt(c.row, c.col, piece, idx);
      },

      onPanResponderTerminate: () => {
        setIsDragging(false); setGhost(null); setGhostValid(false);
      },
    })
  )).current;

  // ─── Tap to place ─────────────────────────────────────────────────────────────

  function handleCellTap(row: number, col: number) {
    if (!activePiece || phase !== "playing" || isDragging) return;
    const c = clamp(
      row - Math.floor(activePiece.shape.length / 2),
      col - Math.floor(activePiece.shape[0].length / 2),
      activePiece
    );
    dropAt(c.row, c.col);
  }

  // ─── Restart ──────────────────────────────────────────────────────────────────

  function restart() {
    setGrid(createRushGrid());
    setTray([randomPiece(), randomPiece(), randomPiece()]);
    setSelected(0); setScore(0); setCombo(0); setBestCombo(0);
    setTotalLines(0); setTotalPieces(0); setPhase("playing");
    setGhost(null); setGhostValid(false); setIsDragging(false);
    setScorePop(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View
      style={styles.container}
      onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
        containerOrigin.current = { x: px, y: py };
      })}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.modeTag}>
          <Text style={styles.modeTagText}>⚡ PRESSURE</Text>
        </View>
        {combo > 1 && (
          <View style={styles.comboBadge}>
            <Text style={styles.comboText}>×{combo} COMBO</Text>
          </View>
        )}
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={styles.score}>{score.toLocaleString()}</Text>
        {totalLines > 0 && (
          <Text style={styles.lineCount}>{totalLines} lines</Text>
        )}
      </View>

      {/* Grid */}
      <View
        style={styles.gridContainer}
        onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
          gridOrigin.current = { x: px + 8, y: py + 8 };
        })}
      >
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => {
              const isGhost = ghostCells.has(`${r},${c}`);
              const gc = activePiece ? COLORS.pieces[activePiece.color] : null;
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.8}
                  onPress={() => handleCellTap(r, c)}
                  style={[
                    styles.cell,
                    // Filled cell — color reflects current multiplier
                    cell !== null && {
                      backgroundColor: valueToColor(cell.value, cell.maxValue),
                    },
                    // Ghost valid
                    isGhost && ghostValid && {
                      backgroundColor: gc!.fill,
                      opacity: 0.5, borderWidth: 2, borderColor: gc!.fill,
                    },
                    // Ghost invalid
                    isGhost && !ghostValid && {
                      backgroundColor: COLORS.danger, opacity: 0.35,
                    },
                  ]}
                >
                  {/* Multiplier number — only on filled, non-ghost cells */}
                  {cell !== null && !isGhost && (
                    <Text style={[
                      styles.cellNum,
                      { fontSize: CELL_SIZE > 38 ? 11 : 9 },
                      { color: valueTextColor(cell.value, cell.maxValue) },
                      cell.value <= 1 && styles.cellNumLow,
                    ]}>
                      ×{cell.value}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Score pop — floats above grid */}
        {scorePop && (
          <ScorePop
            key={scorePop.id}
            points={scorePop.pts}
            combo={scorePop.combo}
          />
        )}
      </View>

      {/* Hint */}
      <Text style={styles.hint}>
        {isDragging
          ? "Release to place"
          : "×N = score multiplier — clear fast for big points!"}
      </Text>

      {/* Tray */}
      <View style={styles.tray}>
        {tray.map((piece, i) => {
          if (!piece) return <View key={i} style={styles.trayEmpty} />;
          const val = startingValue(piece.shape.flat().filter(Boolean).length);
          return (
            <View
              key={i}
              style={[styles.traySlot, selected === i && styles.traySlotSelected]}
              {...panResponders[i].panHandlers}
            >
              <MiniPiece piece={piece} />
              {/* Show what multiplier this piece will place */}
              <View style={styles.trayValueBadge}>
                <Text style={styles.trayValueText}>×{val}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Drag shadow */}
      {isDragging && activePiece && (
        <DragShadow piece={activePiece} position={dragPosition} />
      )}

      {/* Results */}
      {phase === "over" && (
        <ResultsScreen
          score={score}
          bestCombo={bestCombo}
          linesCleared={totalLines}
          piecesPlaced={totalPieces}
          onReplay={restart}
          onHome={() => router.back()}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    paddingTop: 52, paddingHorizontal: 16, alignItems: "center",
  },
  header: {
    flexDirection: "row", alignItems: "center",
    width: "100%", height: 44, marginBottom: 4, gap: 10,
  },
  back: { color: COLORS.textDim, fontSize: 16 },
  modeTag: {
    backgroundColor: "rgba(255,230,109,0.1)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(255,230,109,0.3)",
  },
  modeTagText: { color: COLORS.accent, fontSize: 12, fontWeight: "bold" },
  comboBadge: {
    flex: 1, alignItems: "flex-end",
    backgroundColor: "rgba(255,230,109,0.08)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.accent,
  },
  comboText: { color: COLORS.accent, fontSize: 12, fontWeight: "bold" },
  scoreRow: {
    flexDirection: "row", alignItems: "baseline",
    gap: 12, marginBottom: 8, width: "100%",
  },
  score: { color: COLORS.text, fontSize: 28, fontWeight: "bold" },
  lineCount: { color: COLORS.textDim, fontSize: 14 },
  gridContainer: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 8, gap: GAP,
    position: "relative",
  },
  row: { flexDirection: "row", gap: GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: CELL_R,
    backgroundColor: COLORS.cellEmpty,
    alignItems: "center", justifyContent: "center",
  },
  cellNum: {
    fontWeight: "bold",
    lineHeight: 13,
  },
  cellNumLow: { color: "rgba(0,0,0,0.4)" },
  hint: { color: COLORS.textDim, fontSize: 11, marginTop: 8, marginBottom: 4 },
  tray: {
    flexDirection: "row", gap: 10, marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18, padding: 12,
    alignItems: "center", justifyContent: "center",
  },
  traySlot: {
    padding: 10, borderRadius: 12, borderWidth: 2,
    borderColor: "transparent", alignItems: "center",
    justifyContent: "center", minWidth: 72, minHeight: 64,
    backgroundColor: "rgba(255,255,255,0.04)", gap: 4,
  },
  traySlotSelected: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(255,230,109,0.08)",
    transform: [{ scale: 1.05 }],
  },
  trayEmpty: {
    minWidth: 72, minHeight: 64, borderRadius: 12,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.06)",
  },
  trayValueBadge: {
    backgroundColor: "rgba(255,230,109,0.15)",
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(255,230,109,0.3)",
  },
  trayValueText: { color: COLORS.accent, fontSize: 10, fontWeight: "bold" },
});