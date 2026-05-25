// app/level/[id].tsx
//
// Dynamic route — Expo Router passes the level ID from the URL.
// /level/1  → loads level 1 config
// /level/42 → loads level 42 config
//
// This file contains the full game screen wired to a specific level.
// It saves progress and stars to AsyncStorage on level complete.

import {
  View, Text, StyleSheet, TouchableOpacity,
  PanResponder, Animated, Dimensions,
} from "react-native";

import { useRef, useState, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS, SIZES } from "../../src/constants/theme";
import { createGrid, canPlace, placePiece, clearLines, hasAnyValidMove } from "../../src/game/grid";
import { randomPiece } from "../../src/game/pieces";
import { calculateScore, countCells } from "../../src/game/scoring";
import { getLevel, LevelConfig } from "../../src/game/levels";
import { saveHighestLevel, saveLevelStars } from "../../src/store/storage";
import { Grid, Piece, Tray } from "../../src/types";

// ─── Responsive sizing ────────────────────────────────────────────────────────

const SCREEN_H     = Dimensions.get("window").height;
const SCREEN_W     = Dimensions.get("window").width;
const HEADER_H     = 44;
const SCOREBAR_H   = 90;
const HINT_H       = 28;
const TRAY_H       = 92;
const PADDING_V    = 56 + 16 + 12 + 10 + 16;
const AVAILABLE_H  = SCREEN_H - HEADER_H - SCOREBAR_H - HINT_H - TRAY_H - PADDING_V;
const AVAILABLE_W  = SCREEN_W - 32;
const GAP          = 4;
const RAW_CELL     = Math.floor(Math.min(AVAILABLE_H, AVAILABLE_W) / 8) - GAP;
const CELL_SIZE    = Math.max(30, Math.min(RAW_CELL, 46));
const CELL_STEP    = CELL_SIZE + GAP;
const CELL_RADIUS  = Math.round(CELL_SIZE * 0.22);
const LIFT_OFFSET  = 110;

type GamePhase = "playing" | "won" | "failed" | "stuck";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fingerToGridCell(fx: number, fy: number, origin: { x: number; y: number }, piece: Piece) {
  return {
    col: Math.floor((fx - origin.x) / CELL_STEP) - Math.floor(piece.shape[0].length / 2),
    row: Math.floor((fy - origin.y) / CELL_STEP) - Math.floor(piece.shape.length / 2),
  };
}

function clamp(row: number, col: number, piece: Piece) {
  return {
    row: Math.max(0, Math.min(row, 8 - piece.shape.length)),
    col: Math.max(0, Math.min(col, 8 - piece.shape[0].length)),
  };
}

function getStars(score: number, level: LevelConfig): number {
  if (score >= level.star3Score) return 3;
  if (score >= level.star2Score) return 2;
  if (score >= level.targetScore) return 1;
  return 0;
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
              width: dc, height: dc, margin: 2, borderRadius: CELL_RADIUS,
              backgroundColor: cell ? color.fill : "transparent",
              opacity: cell ? 0.9 : 0,
              shadowColor: color.fill, shadowOpacity: 0.6,
              shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
            }} />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, level, piecesRemaining }: {
  score: number; level: LevelConfig; piecesRemaining: number;
}) {
  const progress = Math.min(score / level.targetScore, 1);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 350, useNativeDriver: false }).start();
  }, [progress]);

  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [COLORS.danger, COLORS.accent, COLORS.primary],
  });

  const isLow = piecesRemaining <= 5;
  const isVeryLow = piecesRemaining <= 2;

  return (
    <View style={sbStyles.container}>
      <View style={sbStyles.row}>
        <View>
          <Text style={sbStyles.levelLabel}>LEVEL {level.id}</Text>
          <Text style={sbStyles.scoreText}>
            {score.toLocaleString()}
            <Text style={sbStyles.targetText}> / {level.targetScore.toLocaleString()}</Text>
          </Text>
        </View>
        <View style={[
          sbStyles.counter,
          isLow && sbStyles.counterLow,
          isVeryLow && sbStyles.counterVeryLow,
        ]}>
          <Text style={[
            sbStyles.counterNum,
            isLow && { color: COLORS.accent },
            isVeryLow && { color: COLORS.danger },
          ]}>
            {piecesRemaining}
          </Text>
          <Text style={sbStyles.counterLabel}>left</Text>
        </View>
      </View>
      <View style={sbStyles.track}>
        <Animated.View style={[sbStyles.fill, {
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          backgroundColor: barColor,
        }]} />
        <View style={sbStyles.tick} />
      </View>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  container: { width: "100%", gap: 6, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelLabel: { color: COLORS.primary, fontSize: 12, fontWeight: "bold", letterSpacing: 2 },
  scoreText: { color: COLORS.text, fontSize: 16, fontWeight: "bold", marginTop: 1 },
  targetText: { color: COLORS.textDim, fontSize: 12, fontWeight: "normal" },
  counter: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 5, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", minWidth: 64,
  },
  counterLow: { borderColor: COLORS.accent, backgroundColor: "rgba(255,230,109,0.08)" },
  counterVeryLow: { borderColor: COLORS.danger, backgroundColor: "rgba(255,107,107,0.1)" },
  counterNum: { color: COLORS.text, fontSize: 20, fontWeight: "bold", lineHeight: 22 },
  counterLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 1 },
  track: { height: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  tick: { position: "absolute", right: 0, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.3)" },
});

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({ phase, score, level, onReplay, onNext, onHome, onWatchAd }: {
  phase: GamePhase; score: number; level: LevelConfig;
  onReplay: () => void; onNext: () => void; onHome: () => void; onWatchAd: () => void;
}) {
  const stars = getStars(score, level);
  const isWon = phase === "won";
  const gap = level.targetScore - score;
  const pct = Math.min(100, Math.round((score / level.targetScore) * 100));
  const isLastLevel = level.id === 99;

  return (
    <View style={rsStyles.overlay}>
      <View style={rsStyles.modal}>
        <Text style={rsStyles.icon}>{isWon ? "🎉" : "😞"}</Text>
        <Text style={rsStyles.title}>
          {isWon
            ? isLastLevel ? "You finished all levels! 🏆" : "Level Complete!"
            : phase === "stuck" ? "No Moves Left!" : "So Close!"}
        </Text>

        {isWon && (
          <View style={rsStyles.starsRow}>
            {[1, 2, 3].map((s) => (
              <Text key={s} style={[rsStyles.star, s > stars && rsStyles.starDim]}>⭐</Text>
            ))}
          </View>
        )}

        <View style={rsStyles.scoreBox}>
          <Text style={rsStyles.scoreLabel}>SCORE</Text>
          <Text style={[rsStyles.scoreNum, { color: isWon ? COLORS.primary : COLORS.danger }]}>
            {score.toLocaleString()}
          </Text>
          {!isWon && (
            <Text style={rsStyles.gapText}>
              {pct}% of target · {gap.toLocaleString()} pts short
            </Text>
          )}
        </View>

        {isWon ? (
          <>
            {!isLastLevel && (
              <TouchableOpacity style={rsStyles.btnPrimary} onPress={onNext}>
                <Text style={rsStyles.btnPrimaryText}>Next Level →</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={rsStyles.btnOutline} onPress={onReplay}>
              <Text style={rsStyles.btnOutlineText}>Play Again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={rsStyles.btnAd} onPress={onWatchAd}>
              <Text style={rsStyles.btnAdText}>📺  Watch Ad for +3 Pieces</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rsStyles.btnPrimary} onPress={onReplay}>
              <Text style={rsStyles.btnPrimaryText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={onHome} style={{ marginTop: 4 }}>
          <Text style={rsStyles.homeLink}>← Campaign</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rsStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    backgroundColor: "#1B2A4A", borderRadius: 28,
    paddingHorizontal: 32, paddingVertical: 36,
    alignItems: "center", gap: 12, width: "88%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000", shadowOpacity: 0.6,
    shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },
  icon: { fontSize: 48 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "bold", textAlign: "center" },
  starsRow: { flexDirection: "row", gap: 8 },
  star: { fontSize: 30 },
  starDim: { opacity: 0.2 },
  scoreBox: {
    alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
    width: "100%", gap: 2,
  },
  scoreLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 3 },
  scoreNum: { fontSize: 42, fontWeight: "bold" },
  gapText: { color: COLORS.textDim, fontSize: 12, marginTop: 4, textAlign: "center" },
  btnPrimary: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 13,
    width: "100%", alignItems: "center",
  },
  btnPrimaryText: { color: COLORS.background, fontSize: 16, fontWeight: "bold" },
  btnOutline: {
    borderRadius: 14, paddingHorizontal: 32, paddingVertical: 12,
    width: "100%", alignItems: "center",
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  btnOutlineText: { color: COLORS.primary, fontSize: 15, fontWeight: "bold" },
  btnAd: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13,
    width: "100%", alignItems: "center",
  },
  btnAdText: { color: COLORS.background, fontSize: 14, fontWeight: "bold" },
  homeLink: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
});

// ─── Game Screen ──────────────────────────────────────────────────────────────

export default function LevelScreen() {
  // Get level ID from the route: /level/[id]
  const { id } = useLocalSearchParams<{ id: string }>();
  const levelId = parseInt(id ?? "1", 10);
  const level = getLevel(levelId);

  const [grid, setGrid] = useState<Grid>(() => createGrid());
  const [tray, setTray] = useState<Tray>(() => [randomPiece(), randomPiece(), randomPiece()]);
  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [piecesRemaining, setPiecesRemaining] = useState(level.pieceCount);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [ghostValid, setGhostValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const gridOrigin = useRef<{ x: number; y: number } | null>(null);
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const scoreRef = useRef(score); scoreRef.current = score;
  const comboRef = useRef(combo); comboRef.current = combo;
  const piecesRef = useRef(piecesRemaining); piecesRef.current = piecesRemaining;
  const phaseRef = useRef(phase); phaseRef.current = phase;

  const activePiece = tray[selected];

  // Ghost cells + would-clear
  const ghostCells = new Set<string>();
  const wouldClearRows = new Set<number>();
  const wouldClearCols = new Set<number>();
  if (ghost && activePiece && ghostValid) {
    for (let r = 0; r < activePiece.shape.length; r++)
      for (let c = 0; c < activePiece.shape[r].length; c++)
        if (activePiece.shape[r][c]) ghostCells.add(`${ghost.row + r},${ghost.col + c}`);
    const sim = placePiece(grid, activePiece, ghost.row, ghost.col);
    for (let r = 0; r < 8; r++) if (sim[r].every(c => c !== null)) wouldClearRows.add(r);
    for (let c = 0; c < 8; c++) if (sim.every(r => r[c] !== null)) wouldClearCols.add(c);
  }

  // ─── Save results when phase changes to won/failed/stuck ─────────────────────

  useEffect(() => {
    if (phase === "won") {
      const stars = getStars(score, level);
      // Fire and forget — storage failures never block the UI
      saveHighestLevel(levelId);
      saveLevelStars(levelId, stars);
    }
    // We don't save on fail — only wins unlock progress
  }, [phase]);

  // ─── Drop ─────────────────────────────────────────────────────────────────────

  const dropAt = useCallback((row: number, col: number, pieceOverride?: Piece, trayIdx?: number) => {
    if (phaseRef.current !== "playing") return;
    const curGrid = gridRef.current;
    const curTray = trayRef.current;
    const curSel = trayIdx ?? selectedRef.current;
    const piece = pieceOverride ?? curTray[curSel];
    if (!piece || !canPlace(curGrid, piece, row, col)) return;

    const placed = placePiece(curGrid, piece, row, col);
    const { grid: cleared, linesCleared } = clearLines(placed);
    const result = calculateScore(scoreRef.current, comboRef.current, countCells(piece.shape), linesCleared);

    const newTray = [...curTray] as Tray;
    newTray[curSel] = null;
    const allUsed = newTray.every(p => p === null);
    const finalTray: Tray = allUsed ? [randomPiece(), randomPiece(), randomPiece()] : newTray;

    let nextSel = allUsed ? 0 : curSel;
    if (!allUsed) {
      for (let i = 1; i <= 3; i++) {
        const idx = (curSel + i) % 3;
        if (finalTray[idx]) { nextSel = idx; break; }
      }
    }

    const newPieces = piecesRef.current - 1;
    let newPhase: GamePhase = "playing";
    if (newPieces <= 0)
      newPhase = result.newScore >= level.targetScore ? "won" : "failed";
    else if (!hasAnyValidMove(cleared, finalTray))
      newPhase = "stuck";

    setGrid(cleared);
    setTray(finalTray);
    setSelected(nextSel);
    setScore(result.newScore);
    setCombo(result.newCombo);
    setPiecesRemaining(newPieces);
    setPhase(newPhase);
    setGhost(null);
    setGhostValid(false);
  }, [level]);

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
        const { row, col } = fingerToGridCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT_OFFSET, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        setGhost(c);
        setGhostValid(canPlace(gridRef.current, piece, c.row, c.col));
      },

      onPanResponderRelease: (e) => {
        setIsDragging(false); setGhost(null); setGhostValid(false);
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece || !gridOrigin.current) return;
        const { row, col } = fingerToGridCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT_OFFSET, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        dropAt(c.row, c.col, piece, idx);
      },

      onPanResponderTerminate: () => { setIsDragging(false); setGhost(null); setGhostValid(false); },
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
    setGrid(createGrid()); setTray([randomPiece(), randomPiece(), randomPiece()]);
    setSelected(0); setScore(0); setCombo(0);
    setPiecesRemaining(level.pieceCount); setPhase("playing");
    setGhost(null); setGhostValid(false); setIsDragging(false);
  }

  function addBonusPieces() { setPiecesRemaining(p => p + 3); setPhase("playing"); }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View
      style={styles.container}
      onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
        containerOrigin.current = { x: px, y: py };
      })}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Levels</Text>
        </TouchableOpacity>
        {combo > 1 && (
          <View style={styles.comboBadge}>
            <Text style={styles.comboText}>🔥 ×{combo}</Text>
          </View>
        )}
      </View>

      <ScoreBar score={score} level={level} piecesRemaining={piecesRemaining} />

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
              const willClear = wouldClearRows.has(r) || wouldClearCols.has(c);
              const color = cell !== null ? COLORS.pieces[cell] : null;
              const gc = activePiece ? COLORS.pieces[activePiece.color] : null;
              return (
                <TouchableOpacity
                  key={c} activeOpacity={0.8}
                  onPress={() => handleCellTap(r, c)}
                  style={[
                    styles.cell,
                    cell !== null && { backgroundColor: color!.fill, shadowColor: color!.fill, shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
                    isGhost && ghostValid && { backgroundColor: gc!.fill, opacity: 0.55, borderWidth: 2, borderColor: gc!.fill },
                    isGhost && !ghostValid && { backgroundColor: COLORS.danger, opacity: 0.4 },
                    !isGhost && willClear && cell === null && { backgroundColor: COLORS.accent, opacity: 0.2 },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.hint}>
        {isDragging ? "Release to place" : "Drag a piece · or select then tap grid"}
      </Text>

      <View style={styles.tray}>
        {tray.map((piece, i) => !piece
          ? <View key={i} style={styles.trayEmpty} />
          : (
            <View key={i}
              style={[styles.traySlot, selected === i && styles.traySlotSelected]}
              {...panResponders[i].panHandlers}
            >
              <MiniPiece piece={piece} />
            </View>
          )
        )}
      </View>

      {isDragging && activePiece && <DragShadow piece={activePiece} position={dragPosition} />}

      {phase !== "playing" && (
        <ResultsScreen
          phase={phase} score={score} level={level}
          onReplay={restart}
          onNext={() => router.replace(`/level/${levelId + 1}`)}
          onHome={() => router.back()}
          onWatchAd={addBonusPieces}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    paddingTop: 52, paddingHorizontal: 16, alignItems: "center",
  },
  header: {
    flexDirection: "row", alignItems: "center",
    width: "100%", height: HEADER_H, marginBottom: 4, gap: 12,
  },
  back: { color: COLORS.textDim, fontSize: 16 },
  comboBadge: {
    backgroundColor: "rgba(255,230,109,0.12)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.accent,
  },
  comboText: { color: COLORS.accent, fontSize: 13, fontWeight: "bold" },
  gridContainer: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 8, gap: GAP,
  },
  row: { flexDirection: "row", gap: GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: CELL_RADIUS, backgroundColor: COLORS.cellEmpty,
  },
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
    justifyContent: "center", minWidth: 72, minHeight: 56,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  traySlotSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(78,205,196,0.1)",
    transform: [{ scale: 1.05 }],
  },
  trayEmpty: {
    minWidth: 72, minHeight: 56, borderRadius: 12,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.06)",
  },
});