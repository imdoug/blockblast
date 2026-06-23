// app/rush/index.tsx
//
// Rush Mode — BlockBlast's pressure game mode.
//
// Core mechanic: the player MUST clear at least one line before a countdown
// timer hits zero, or the game ends. Every successful clear resets the timer,
// but each new window is shorter than the last — creating escalating tension.

import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  PanResponder, Animated, Dimensions,
} from "react-native";
import { useRef, useState, useCallback, useEffect } from "react";
import { router, useFocusEffect } from "expo-router";
import { COLORS, TEXT } from "../src/constants/theme";
import { AnimatedScore } from "../src/components/AnimatedScore";
import { createGrid, canPlace, placePiece, clearLines, hasAnyValidMove } from "../src/game/grid";
import { randomPiece } from "../src/game/pieces";
import { Grid, Piece, Tray } from "../src/types";
import { AD_UNIT_IDS } from "../src/constants/config";
import { loadRushBest, saveRushBest } from "../src/store/storage";
import { useSound } from "../src/hooks/useSound";

let BannerAd: any = null;
let BannerAdSize: any = null;
try {
  const admob = require("react-native-google-mobile-ads");
  BannerAd     = admob.BannerAd;
  BannerAdSize = admob.BannerAdSize;
} catch {}

const GRID_SIZE   = 8;
const LIFT_OFFSET = 60;
const GAP         = 4;

function timerWindow(totalClears: number): number {
  if (totalClears < 5)  return 60;
  if (totalClears < 10) return 45;
  if (totalClears < 15) return 30;
  return 20;
}

const SCREEN_H  = Dimensions.get("window").height;
const SCREEN_W  = Dimensions.get("window").width;
const AVAILABLE = Math.min(SCREEN_H * 0.5, SCREEN_W - 32);
const RAW_CELL  = Math.floor(AVAILABLE / GRID_SIZE) - GAP;
const CELL_SIZE = Math.max(30, Math.min(RAW_CELL, 44));
const CELL_STEP = CELL_SIZE + GAP;
const CELL_R    = Math.round(CELL_SIZE * 0.22);

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
    <Animated.View pointerEvents="none" style={{
      position: "absolute", top: 0, alignSelf: "center",
      opacity, transform: [{ translateY }], zIndex: 50,
    }}>
      <Text style={{
        color: combo > 1 ? COLORS.accent : COLORS.primary,
        fontSize: combo > 1 ? 24 : 20,
        fontFamily: "LuckiestGuy_400Regular",
        letterSpacing: 1,
      }}>
        +{points.toLocaleString()}{combo > 1 ? ` ×${combo}` : ""}
      </Text>
    </Animated.View>
  );
}

function TimerBar({ timeLeft, totalTime, totalClears }: {
  timeLeft: number; totalTime: number; totalClears: number;
}) {
  const progress = totalTime > 0 ? timeLeft / totalTime : 0;
  const anim = useRef(new Animated.Value(progress)).current;
  const prevTotal = useRef(totalTime);
  useEffect(() => {
    if (totalTime !== prevTotal.current) { anim.setValue(1); prevTotal.current = totalTime; }
    Animated.timing(anim, { toValue: progress, duration: 200, useNativeDriver: false }).start();
  }, [timeLeft, totalTime]);
  const isLow = progress <= 0.25;
  const isVeryLow = progress <= 0.1;
  const barColor = anim.interpolate({
    inputRange: [0, 0.25, 0.6, 1],
    outputRange: [COLORS.danger, "#FD9644", COLORS.accent, "#52C97A"],
  });
  const urgencyLabel =
    totalTime === 60 ? "WARM UP" :
    totalTime === 45 ? "GETTING TENSE" :
    totalTime === 30 ? "FAST" : "PANIC MODE";
  return (
    <View style={tbS.container}>
      <View style={tbS.row}>
        <View style={tbS.modeTag}>
          <Text style={tbS.modeTagText}>⚡ RUSH MODE</Text>
        </View>
        <Text style={tbS.urgencyLabel}>{urgencyLabel}</Text>
        <View style={[tbS.timeBox, isLow && tbS.timeBoxLow, isVeryLow && tbS.timeBoxVeryLow]}>
          <Text style={[tbS.timeNum, isLow && { color: COLORS.accent }, isVeryLow && { color: COLORS.danger }]}>
            {timeLeft}
          </Text>
          <Text style={tbS.timeLabel}>sec</Text>
        </View>
      </View>
      <View style={tbS.track}>
        <Animated.View style={[tbS.fill, {
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          backgroundColor: barColor,
        }]} />
      </View>
      <View style={tbS.statsRow}>
        <Text style={tbS.statText}>{totalClears} <Text style={tbS.statLabel}>clears</Text></Text>
        <Text style={tbS.statText}>{totalTime}s <Text style={tbS.statLabel}>window</Text></Text>
      </View>
    </View>
  );
}

const tbS = StyleSheet.create({
  container: { width: "100%", gap: 5, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  modeTag: {
    backgroundColor: "rgba(255,230,109,0.1)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(255,230,109,0.3)",
  },
  modeTagText: {
    color: COLORS.accent, fontSize: 11,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
  },
  urgencyLabel: {
    flex: 1, color: COLORS.textDim, fontSize: 11,
    fontFamily: "FredokaOne_400Regular", letterSpacing: 1, textAlign: "center",
  },
  timeBox: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 5,
    alignItems: "center", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)", minWidth: 64,
  },
  timeBoxLow: { borderColor: COLORS.accent, backgroundColor: "rgba(255,230,109,0.08)" },
  timeBoxVeryLow: { borderColor: COLORS.danger, backgroundColor: "rgba(255,107,107,0.1)" },
  timeNum: {
    color: COLORS.text, fontSize: 22,
    fontFamily: "LuckiestGuy_400Regular", lineHeight: 24,
  },
  timeLabel: {
    color: COLORS.textDim, fontSize: 9,
    fontFamily: "FredokaOne_400Regular", letterSpacing: 1,
  },
  track: { height: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statText: { color: COLORS.text, fontSize: 13, fontFamily: "FredokaOne_400Regular" },
  statLabel: { color: COLORS.textDim, fontSize: 12, fontFamily: "FredokaOne_400Regular" },
});

function ResultsScreen({ score, bestCombo, totalClears, piecesPlaced, reason, onReplay, onHome }: {
  score: number; bestCombo: number; totalClears: number; piecesPlaced: number;
  reason: "timeout" | "stuck"; onReplay: () => void; onHome: () => void;
}) {
  return (
    <View style={rsS.overlay}>
      <View style={rsS.modal}>
        <Text style={rsS.icon}>{reason === "timeout" ? "⏱️" : "🧱"}</Text>
        <Text style={rsS.title}>
          {reason === "timeout" ? "Time's Up!" : "No Moves Left!"}
        </Text>
        <Text style={rsS.subtitle}>
          {reason === "timeout" ? "Didn't clear a line in time" : "Board is completely full"}
        </Text>
        <View style={rsS.scoreBox}>
          <Text style={rsS.scoreLabel}>SCORE</Text>
          <Text style={rsS.scoreNum}>{score.toLocaleString()}</Text>
        </View>
        <View style={rsS.statsRow}>
          <View style={rsS.stat}>
            <Text style={rsS.statNum}>{piecesPlaced}</Text>
            <Text style={rsS.statLabel}>pieces</Text>
          </View>
          <View style={rsS.stat}>
            <Text style={rsS.statNum}>{totalClears}</Text>
            <Text style={rsS.statLabel}>lines cleared</Text>
          </View>
          <View style={rsS.stat}>
            <Text style={[rsS.statNum, bestCombo > 2 && { color: COLORS.accent }]}>×{bestCombo}</Text>
            <Text style={rsS.statLabel}>best combo</Text>
          </View>
        </View>
        <TouchableOpacity style={rsS.btnPrimary} onPress={onReplay}>
          <Text style={rsS.btnText}>⚡  Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onHome} style={rsS.homeBtn}>
          <Image source={require("../assets/icons/arrow-left.png")} style={rsS.btnArrow} />
          <Text style={rsS.homeLink}>Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rsS = StyleSheet.create({
  homeBtn:  { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  btnArrow: { width: 22, height: 16, resizeMode: "contain" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    backgroundColor: "#091526", borderRadius: 28,
    paddingHorizontal: 32, paddingVertical: 36,
    alignItems: "center", gap: 12, width: "88%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  icon: { fontSize: 44 },
  title: {
    color: COLORS.text, fontSize: 28,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
  },
  subtitle: {
    color: COLORS.textDim, fontSize: 13,
    fontFamily: "FredokaOne_400Regular", marginTop: -8, textAlign: "center",
  },
  scoreBox: {
    alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, paddingHorizontal: 40, paddingVertical: 12, width: "100%",
  },
  scoreLabel: {
    color: COLORS.textDim, fontSize: 16,
    fontFamily: "FredokaOne_400Regular", letterSpacing: 3,
    marginBottom: 12
  },
  scoreNum: {
    color: COLORS.accent, fontSize: 52,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 2,
    lineHeight: 58
  },
  statsRow: { flexDirection: "row", gap: 24, marginTop: 12, marginBottom: 12},
  stat: { alignItems: "center" },
  statNum: {
    color: COLORS.text, fontSize: 22,
    fontFamily: "LuckiestGuy_400Regular",
  },
  statLabel: {
    color: COLORS.textDim, fontSize: 16,
    fontFamily: "FredokaOne_400Regular",
    marginBottom: 12
  },
  btnPrimary: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 14,
    width: "100%", alignItems: "center", marginTop: 4,
  },
  btnText: {
    color: COLORS.background, fontSize: 17,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
  },
  homeLink: {
    color: COLORS.textDim, fontSize: 14,
    fontFamily: "FredokaOne_400Regular",
  },
});

type Phase = "playing" | "over";
type OverReason = "timeout" | "stuck";

export default function RushScreen() {
  const [grid, setGrid] = useState<Grid>(() => createGrid());
  const [tray, setTray] = useState<Tray>(() => [randomPiece(), randomPiece(), randomPiece()]);
  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [rushBest, setRushBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [totalClears, setTotalClears] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [overReason, setOverReason] = useState<OverReason>("timeout");
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [ghostValid, setGhostValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scorePop, setScorePop] = useState<{ id: number; pts: number; combo: number } | null>(null);
  const popId = useRef(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [totalTime, setTotalTime] = useState(60);
  const clearsAtWindowStart = useRef(0);
  const sound    = useSound();
  const soundRef = useRef(sound); soundRef.current = sound;

  const gridOrigin = useRef<{ x: number; y: number } | null>(null);
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const scoreRef = useRef(score); scoreRef.current = score;
  const comboRef = useRef(combo); comboRef.current = combo;
  const bestComboRef = useRef(bestCombo); bestComboRef.current = bestCombo;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const totalClearsRef = useRef(totalClears); totalClearsRef.current = totalClears;
  const timeLeftRef = useRef(timeLeft); timeLeftRef.current = timeLeft;

  const activePiece = tray[selected];

  // Ghost cells
  const ghostCells = new Set<string>();
  const wouldClearRows = new Set<number>();
  const wouldClearCols = new Set<number>();
  if (ghost && activePiece) {
    for (let r = 0; r < activePiece.shape.length; r++)
      for (let c = 0; c < activePiece.shape[r].length; c++)
        if (activePiece.shape[r][c]) ghostCells.add(`${ghost.row + r},${ghost.col + c}`);
    if (ghostValid) {
      const sim = placePiece(grid, activePiece, ghost.row, ghost.col);
      for (let r = 0; r < 8; r++) if (sim[r].every(c => c !== null)) wouldClearRows.add(r);
      for (let c = 0; c < 8; c++) if (sim.every(r => r[c] !== null)) wouldClearCols.add(c);
    }
  }

  useEffect(() => {
    if (phase !== "over") return;

    async function updateBest() {
      await saveRushBest(score);
      const latestBest = await loadRushBest();
      setRushBest(latestBest);
    }

    updateBest();
  }, [phase, score]);

  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); setPhase("over"); setOverReason("timeout"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, totalTime]);

  useEffect(() => {
    if (!scorePop) return;
    const t = setTimeout(() => setScorePop(null), 950);
    return () => clearTimeout(t);
  }, [scorePop]);

  const dropAt = useCallback((row: number, col: number, pieceOverride?: Piece, trayIdx?: number) => {
    if (phaseRef.current !== "playing") return;
    const curGrid = gridRef.current;
    const curTray = trayRef.current;
    const curSel = trayIdx ?? selectedRef.current;
    const piece = pieceOverride ?? curTray[curSel];
    if (!piece || !canPlace(curGrid, piece, row, col)) return;

    const placed = placePiece(curGrid, piece, row, col);
    const { grid: cleared, linesCleared } = clearLines(placed);

    const cellCount = piece.shape.flat().filter(Boolean).length;
    const basePts = cellCount * 10;
    const newCombo = linesCleared > 0 ? comboRef.current + 1 : 0;
    const comboMult = newCombo > 1 ? newCombo : 1;
    const timePts = linesCleared > 0 ? timeLeftRef.current * 5 : 0;
    const linePts = linesCleared * 100 * comboMult;
    const totalPts = basePts + linePts + timePts;
    const newScore = scoreRef.current + totalPts;
    const newBest = Math.max(bestComboRef.current, newCombo);
    const newTotalClears = totalClearsRef.current + linesCleared;

    if (linesCleared > 0) {
      const nextWindow = timerWindow(newTotalClears);
      clearsAtWindowStart.current = newTotalClears;
      setTotalTime(nextWindow); setTimeLeft(nextWindow);
    }

    const newTray = [...curTray] as Tray;
    newTray[curSel] = null;
    const allUsed = newTray.every(p => p === null);
    const finalTray: Tray = allUsed ? [randomPiece(), randomPiece(), randomPiece()] : newTray;
    let nextSel = allUsed ? 0 : curSel;
    if (!allUsed) { for (let i = 1; i <= 3; i++) { const idx = (curSel + i) % 3; if (finalTray[idx]) { nextSel = idx; break; } } }

    const isOver = !hasAnyValidMove(cleared, finalTray);
    setGrid(cleared); setTray(finalTray); setSelected(nextSel);
    setScore(newScore); setCombo(newCombo); setBestCombo(newBest);
    setTotalClears(newTotalClears); setTotalPieces(p => p + 1);
    setGhost(null); setGhostValid(false);
    if (isOver) { setPhase("over"); setOverReason("stuck"); }
    if (linesCleared > 0 || basePts > 0) setScorePop({ id: ++popId.current, pts: totalPts, combo: newCombo });
    if (linesCleared > 0) {
      soundRef.current.playClear();
      if (newCombo > 1) soundRef.current.playCombo();
    } else {
      soundRef.current.playPlace();
    }
    if (isOver) soundRef.current.playFail();
  }, []);

  const panResponders = useRef([0, 1, 2].map(idx =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        if (phaseRef.current !== "playing") return;
        setSelected(idx); setIsDragging(true);
      },
      onPanResponderMove: (e) => {
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece || !gridOrigin.current) return;
        const { row, col } = fingerToCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT_OFFSET, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        setGhost(c); setGhostValid(canPlace(gridRef.current, piece, c.row, c.col));
      },
      onPanResponderRelease: (e) => {
        setIsDragging(false); setGhost(null); setGhostValid(false);
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece || !gridOrigin.current) return;
        const { row, col } = fingerToCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT_OFFSET, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        dropAt(c.row, c.col, piece, idx);
      },
      onPanResponderTerminate: () => { setIsDragging(false); setGhost(null); setGhostValid(false); },
    })
  )).current;

  function handleCellTap(row: number, col: number) {
    if (!activePiece || phase !== "playing" || isDragging) return;
    const c = clamp(row - Math.floor(activePiece.shape.length / 2), col - Math.floor(activePiece.shape[0].length / 2), activePiece);
    dropAt(c.row, c.col);
  }

  useFocusEffect(
    useCallback(() => {
      async function loadBestAndReset() {
        const best = await loadRushBest();
        setRushBest(best);
        resetGame();
      }

      loadBestAndReset();
    }, [])
  );

  function resetGame() {
    setGrid(createGrid()); setTray([randomPiece(), randomPiece(), randomPiece()]);
    setSelected(0); setScore(0); setCombo(0); setBestCombo(0);
    setTotalClears(0); setTotalPieces(0); setPhase("playing");
    setGhost(null); setGhostValid(false); setIsDragging(false);
    setScorePop(null); setTimeLeft(60); setTotalTime(60);
    clearsAtWindowStart.current = 0;
  }

  const isTimerDanger = timeLeft <= 5 && phase === "playing";

  return (
    <View
      style={styles.container}
      onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => { containerOrigin.current = { x: px, y: py }; })}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={require("../assets/icons/arrow-left.png")} style={styles.backArrow} />
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {combo > 1 && (
            <View style={styles.comboBadge}>
              <Text style={styles.comboText}>⚡ ×{combo}</Text>
            </View>
          )}

          <View style={styles.bestBadge}>
            <Text style={styles.bestLabel}>BEST</Text>
            <Text style={styles.bestValue}>
              {Math.max(rushBest, score).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <AnimatedScore value={score} style={styles.score} duration={350} />
      </View>

      <TimerBar timeLeft={timeLeft} totalTime={totalTime} totalClears={totalClears} />

      {/* Grid */}
      <View style={styles.gridWrapper}>
        <Animated.View
          style={[styles.gridContainer, isTimerDanger && styles.gridDanger]}
          onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
            gridOrigin.current = { x: px + 8, y: py + 8 };
          })}
        >
          {grid.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((cell, c) => {
                const willClear = wouldClearRows.has(r) || wouldClearCols.has(c);
                const color = cell !== null ? COLORS.pieces[cell] : null;
                return (
                  <TouchableOpacity key={c} activeOpacity={0.8}
                    onPress={() => handleCellTap(r, c)}
                    style={[
                      styles.cell,
                      cell !== null && { backgroundColor: color!.fill, shadowColor: color!.fill, shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
                      willClear && cell === null && { backgroundColor: COLORS.accent, opacity: 0.2 },
                    ]}
                  />
                );
              })}
            </View>
          ))}
          {scorePop && <ScorePop key={scorePop.id} points={scorePop.pts} combo={scorePop.combo} />}
        </Animated.View>

        {/* Placement overlay */}
        {isDragging && ghost && activePiece && (
          <View style={styles.placementOverlay} pointerEvents="none">
            {Array.from({ length: 8 }, (_, r) => (
              <View key={r} style={styles.row}>
                {Array.from({ length: 8 }, (_, c) => {
                  const isGhost = ghostCells.has(`${r},${c}`);
                  const gc = COLORS.pieces[activePiece.color];
                  if (isGhost && ghostValid) {
                    return <View key={c} style={[styles.overlayCell, { backgroundColor: gc.fill, opacity: 1, borderWidth: 2, borderColor: gc.fill }]} />;
                  }
                  if (isGhost && !ghostValid) {
                    return (
                      <View key={c} style={[styles.overlayCell, { backgroundColor: gc.fill, borderWidth: 2, borderColor: COLORS.danger }]}>
                        <Image source={require("../assets/pieces/block.png")} style={styles.blockOverlay} resizeMode="cover" />
                      </View>
                    );
                  }
                  return <View key={c} style={styles.overlayCell} />;
                })}
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.hint}>
        {isDragging ? "Release to place" : "Clear a line before time runs out!"}
      </Text>

      <View style={styles.tray}>
        {tray.map((piece, i) => !piece
          ? <View key={i} style={styles.trayEmpty} />
          : (
            <View key={i} style={[styles.traySlot, selected === i && styles.traySlotSelected]} {...panResponders[i].panHandlers}>
              <MiniPiece piece={piece} />
            </View>
          )
        )}
      </View>

      {/* Banner ad — sits flush below tray */}
      {BannerAd && BannerAdSize && (
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          />
        </View>
      )}

      {phase === "over" && (
        <ResultsScreen score={score} bestCombo={bestCombo} totalClears={totalClears}
          piecesPlaced={totalPieces} reason={overReason} onReplay={resetGame} onHome={() => router.back()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn:   { flexDirection: "row", alignItems: "center", gap: 6 },
  backArrow: { width: 22, height: 16, resizeMode: "contain" },
  container: {
    flex: 1, backgroundColor: COLORS.background,
    paddingTop: 52, paddingHorizontal: 16, alignItems: "center",
  },
 header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 44,
    marginBottom: 4,
    gap: 10,
  },
  headerRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  back: {
    color: COLORS.textDim,
    fontSize: 16,
    ...TEXT.nav,
  },
  comboBadge: {
    backgroundColor: "rgba(255,230,109,0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  comboText: {
    color: COLORS.accent,
    fontSize: 13,
    ...TEXT.badge,
},
bestBadge: {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 4,
  alignItems: "center",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.1)",
  minWidth: 72,
},
bestLabel: {
  color: COLORS.textDim,
  fontSize: 9,
  ...TEXT.label,
},
bestValue: {
  color: COLORS.primary,
  fontSize: 15,
  lineHeight: 17,
  ...TEXT.number,
},
  scoreRow: { width: "100%", marginBottom: 6, alignItems: "center" },
  score: {
    color: COLORS.text, fontSize: 52,
    fontFamily: "LuckiestGuy_400Regular",
    textAlign: "center", lineHeight: 58, letterSpacing: 2,
  },
  gridWrapper: { position: "relative" as any },
  gridContainer: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    padding: 8, gap: GAP,
    borderWidth: 2, borderColor: "transparent",
    position: "relative" as any,
  },
  gridDanger: {
    borderColor: COLORS.danger,
    shadowColor: COLORS.danger, shadowOpacity: 0.5,
    shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  placementOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    padding: 8, gap: GAP, borderRadius: 14, backgroundColor: "transparent",
  },
  overlayCell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: CELL_R, backgroundColor: "transparent",
  },
  blockOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_R, opacity: 0.85,
  },
  row: { flexDirection: "row", gap: GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: CELL_R, backgroundColor: COLORS.cellEmpty,
    alignItems: "center", justifyContent: "center",
  },
  hint: {
    color: COLORS.textDim, fontSize: 12,
    fontFamily: "FredokaOne_400Regular",
    marginTop: 8, marginBottom: 4,
  },
  tray: {
    flexDirection: "row", gap: 10, marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18, padding: 12,
    alignItems: "center", justifyContent: "center",
  },
  traySlot: {
    padding: 10, borderRadius: 12,
    borderWidth: 2, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
    minWidth: 72, minHeight: 64,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  traySlotSelected: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(255,230,109,0.08)",
    transform: [{ scale: 1.05 }],
  },
  trayEmpty: {
    minWidth: 72, minHeight: 64,
    borderRadius: 12, borderWidth: 2,
    borderColor: "rgba(255,255,255,0.06)",
  },
  bannerContainer: {
    width: "100%", alignItems: "center", marginTop: 20,
  },
});