// app/game.tsx — Classic endless mode with personal best tracking

import {
  View, Text, Image, StyleSheet, TouchableOpacity, Alert,
  PanResponder, Animated, Dimensions,
  GestureResponderEvent,
} from "react-native";
import { useRef, useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import { COLORS, SIZES } from "../src/constants/theme";
import {
  createGrid, canPlace, placePiece, clearLines, hasAnyValidMove,
} from "../src/game/grid";
import { drawWeightedTray, PIECES } from "../src/game/pieces";
import { calculateScore, countCells } from "../src/game/scoring";
import { loadClassicBest, saveClassicBest } from "../src/store/storage";
import { useHaptics } from "../src/hooks/useHaptics";
import { AD_UNIT_IDS } from "../src/constants/config";

let BannerAd: any = null;
let BannerAdSize: any = null;
try {
  const admob = require("react-native-google-mobile-ads");
  BannerAd     = admob.BannerAd;
  BannerAdSize = admob.BannerAdSize;
} catch {}
import { AnimatedScore } from "../src/components/AnimatedScore";
import { useInterstitialAd, useRewardedAd } from "../src/hooks/useAds";
import { useSound } from "../src/hooks/useSound";
import { Grid, Piece, Tray } from "../src/types";

// ─── Sizing ───────────────────────────────────────────────────────────────────
const SCREEN_H  = Dimensions.get("window").height;
const SCREEN_W  = Dimensions.get("window").width;
const GAP       = 4;
const AVAILABLE = Math.min(SCREEN_H * 0.5, SCREEN_W - 32);
const CELL_SIZE = Math.max(30, Math.min(Math.floor(AVAILABLE / 8) - GAP, 44));
const CELL_STEP = CELL_SIZE + GAP;
const CELL_R    = Math.round(CELL_SIZE * 0.22);
const LIFT      = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fingerToCell(fx: number, fy: number, o: { x: number; y: number }, piece: Piece) {
  return {
    col: Math.floor((fx - o.x) / CELL_STEP) - Math.floor(piece.shape[0].length / 2),
    row: Math.floor((fy - o.y) / CELL_STEP) - Math.floor(piece.shape.length / 2),
  };
}
function clamp(row: number, col: number, piece: Piece) {
  return {
    row: Math.max(0, Math.min(row, 8 - piece.shape.length)),
    col: Math.max(0, Math.min(col, 8 - piece.shape[0].length)),
  };
}
function getPieceIdx(piece: Piece): number {
  return PIECES.findIndex(p => JSON.stringify(p.shape) === JSON.stringify(piece.shape)) ?? 0;
}

// ─── Mini piece ───────────────────────────────────────────────────────────────
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

// ─── Game Over screen ─────────────────────────────────────────────────────────
function GameOverScreen({
  score, best, isNewRecord, piecesPlaced, linesCleared, bestCombo,
  onReplay, onHome, onWatchAd,
}: {
  score: number; best: number; isNewRecord: boolean;
  piecesPlaced: number; linesCleared: number; bestCombo: number;
  onReplay: () => void; onHome: () => void; onWatchAd: () => void;
}) {
  return (
    <View style={goS.overlay}>
      <View style={goS.modal}>

        {isNewRecord ? (
          <>
            <Text style={goS.icon}>🏆</Text>
            <Text style={goS.recordBadge}>NEW RECORD!</Text>
            <Text style={goS.title}>Amazing run!</Text>
          </>
        ) : (
          <>
            <Text style={goS.icon}>💥</Text>
            <Text style={goS.title}>Game Over</Text>
            <Text style={goS.subtitle}>No moves left</Text>
          </>
        )}

        {/* Score */}
        <View style={[goS.scoreBox, isNewRecord && goS.scoreBoxRecord]}>
          <Text style={goS.scoreLabel}>SCORE</Text>
          <Text style={[goS.scoreNum, isNewRecord && goS.scoreNumRecord]}>
            {score.toLocaleString()}
          </Text>
        </View>

        {/* Personal best (if not a new record) */}
        {!isNewRecord && best > 0 && (
          <View style={goS.bestRow}>
            <Text style={goS.bestLabel}>Best</Text>
            <Text style={goS.bestNum}>{best.toLocaleString()}</Text>
            <Text style={goS.bestDiff}>
              {score >= best ? "" : `  –${(best - score).toLocaleString()} from record`}
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={goS.statsRow}>
          <View style={goS.stat}>
            <Text style={goS.statNum}>{piecesPlaced}</Text>
            <Text style={goS.statLabel}>pieces</Text>
          </View>
          <View style={goS.stat}>
            <Text style={goS.statNum}>{linesCleared}</Text>
            <Text style={goS.statLabel}>lines</Text>
          </View>
          <View style={goS.stat}>
            <Text style={[goS.statNum, bestCombo > 2 && { color: COLORS.accent }]}>
              ×{bestCombo}
            </Text>
            <Text style={goS.statLabel}>combo</Text>
          </View>
        </View>

        {/* Rewarded ad — give fresh pieces to continue */}
        <TouchableOpacity style={goS.btnAd} onPress={onWatchAd}>
          <Text style={goS.btnAdText}>📺  Watch Ad for 3 Fresh Pieces</Text>
        </TouchableOpacity>
        <TouchableOpacity style={goS.btnPrimary} onPress={onReplay}>
          <Text style={goS.btnPrimaryText}>▶  Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onHome} style={{ marginTop: 8 }}>
          <Text style={goS.homeLink}>← Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const goS = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    backgroundColor: "#1B2A4A", borderRadius: 28,
    paddingHorizontal: 32, paddingVertical: 36,
    alignItems: "center", gap: 10, width: "88%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  icon: { fontSize: 48 },
  recordBadge: {
    backgroundColor: COLORS.accent, color: COLORS.background,
    fontFamily: "LuckiestGuy_400Regular", fontSize: 13, letterSpacing: 2,
    paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20,
    marginTop: -4,
  },
  title: {
    color: COLORS.text, fontSize: 26,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
  },
  subtitle: {
    color: COLORS.textDim, fontSize: 13,
    fontFamily: "FredokaOne_400Regular", marginTop: -4,
  },
  scoreBox: {
    alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, paddingHorizontal: 40, paddingVertical: 12,
    width: "100%",
  },
  scoreBoxRecord: {
    backgroundColor: "rgba(255,230,109,0.1)",
    borderWidth: 1.5, borderColor: "rgba(255,230,109,0.4)",
  },
  scoreLabel: {
    color: COLORS.textDim, fontSize: 11,
    fontFamily: "FredokaOne_400Regular", letterSpacing: 3,
  },
  scoreNum: {
    color: COLORS.primary, fontSize: 52,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 2,
  },
  scoreNumRecord: { color: COLORS.accent },
  bestRow: {
    flexDirection: "row", alignItems: "baseline", gap: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
    width: "100%",
  },
  bestLabel: {
    color: COLORS.textDim, fontSize: 12,
    fontFamily: "FredokaOne_400Regular",
  },
  bestNum: {
    color: COLORS.text, fontSize: 18,
    fontFamily: "LuckiestGuy_400Regular",
  },
  bestDiff: {
    color: COLORS.danger, fontSize: 12,
    fontFamily: "FredokaOne_400Regular", flex: 1, textAlign: "right",
  },
  statsRow: { flexDirection: "row", gap: 24 },
  stat: { alignItems: "center" },
  statNum: {
    color: COLORS.text, fontSize: 22,
    fontFamily: "LuckiestGuy_400Regular",
  },
  statLabel: {
    color: COLORS.textDim, fontSize: 11,
    fontFamily: "FredokaOne_400Regular",
  },
  btnPrimary: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 14,
    width: "100%", alignItems: "center", marginTop: 4,
  },
  btnPrimaryText: {
    color: COLORS.background, fontSize: 17,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
  },
  homeLink: {
    color: COLORS.textDim, fontSize: 14,
    fontFamily: "FredokaOne_400Regular",
  },
  btnAd: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13,
    width: "100%", alignItems: "center",
  },
  btnAdText: {
    color: COLORS.background, fontSize: 14,
    fontFamily: "FredokaOne_400Regular", fontWeight: "bold" as any,
  },
});

// ─── Classic Game Screen ──────────────────────────────────────────────────────

export default function GameScreen() {
  const haptics = useHaptics();
  const sound = useSound();
  const hapticsRef = useRef(haptics); hapticsRef.current = haptics;
  const soundRef = useRef(sound); soundRef.current = sound;
  const { showInterstitial } = useInterstitialAd();
  const { showRewarded } = useRewardedAd();

  const [grid, setGrid] = useState<Grid>(() => createGrid());
  const [tray, setTray] = useState<Tray>(() => drawWeightedTray([], createGrid()) as Tray);
  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [linesTotal, setLinesTotal] = useState(0);
  const [piecesPlaced, setPiecesPlaced] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const [personalBest, setPersonalBest] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [ghostValid, setGhostValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [flashRows, setFlashRows] = useState<Set<number>>(new Set());
  const [flashCols, setFlashCols] = useState<Set<number>>(new Set());
  const [linesJustCleared, setLinesJustCleared] = useState(false);
  const flashColorRef = useRef<string>(COLORS.primary);
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const [comboFloatText,    setComboFloatText]    = useState("");
  const [comboFloatVisible, setComboFloatVisible] = useState(false);
  const [comboFloatRowY,    setComboFloatRowY]    = useState(100);
  const comboFloatY       = useRef(new Animated.Value(0)).current;
  const comboFloatOpacity = useRef(new Animated.Value(1)).current;

  const [recentIndices, setRecentIndices] = useState<number[]>([]);

  const gridOrigin = useRef<{ x: number; y: number } | null>(null);
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const selRef = useRef(selected); selRef.current = selected;
  const scoreRef = useRef(score); scoreRef.current = score;
  const comboRef = useRef(combo); comboRef.current = combo;
  const bestComboRef = useRef(bestCombo); bestComboRef.current = bestCombo;
  const gameOverRef = useRef(gameOver); gameOverRef.current = gameOver;
  const recentRef = useRef(recentIndices); recentRef.current = recentIndices;
  const personalBestRef = useRef(personalBest); personalBestRef.current = personalBest;

  const activePiece = tray[selected];

  useEffect(() => {
    loadClassicBest().then(best => {
      setPersonalBest(best);
      personalBestRef.current = best;
    });
  }, []);

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
      for (let r = 0; r < 8; r++)
        if (sim[r].every(c => c !== null)) wouldClearRows.add(r);
      for (let c = 0; c < 8; c++)
        if (sim.every(r => r[c] !== null)) wouldClearCols.add(c);
    }
  }

  // ─── Drop ─────────────────────────────────────────────────────────────────

  const dropAt = useCallback((row: number, col: number, pieceOverride?: Piece, trayIdx?: number) => {
    if (gameOverRef.current) return;
    const curGrid = gridRef.current;
    const curTray = trayRef.current;
    const curSel = trayIdx ?? selRef.current;
    const piece = pieceOverride ?? curTray[curSel];
    if (!piece || !canPlace(curGrid, piece, row, col)) return;

    const placed = placePiece(curGrid, piece, row, col);
    const { grid: cleared, linesCleared } = clearLines(placed);
    const result = calculateScore(scoreRef.current, comboRef.current, countCells(piece.shape), linesCleared);

    const newTray = [...curTray] as Tray;
    newTray[curSel] = null;
    const allUsed = newTray.every(p => p === null);
    const newRecent = [...recentRef.current, getPieceIdx(piece)].slice(-6);
    const finalTray: Tray = allUsed
      ? drawWeightedTray(newRecent, cleared) as Tray
      : newTray;

    let nextSel = allUsed ? 0 : curSel;
    if (!allUsed) {
      for (let i = 1; i <= 3; i++) {
        const idx = (curSel + i) % 3;
        if (finalTray[idx]) { nextSel = idx; break; }
      }
    }

    const isOver = !hasAnyValidMove(cleared, finalTray);
    const newBestCombo = Math.max(bestComboRef.current, result.newCombo);

    const isRecord = result.newScore > personalBestRef.current;
    if (isOver && isRecord) {
      saveClassicBest(result.newScore);
      setIsNewRecord(true);
      setPersonalBest(result.newScore);
    } else if (isOver) {
      saveClassicBest(result.newScore);
    }

    if (linesCleared > 0) {
      setLinesJustCleared(true);
      setTimeout(() => setLinesJustCleared(false), 600);
      const flashR = new Set<number>(), flashC = new Set<number>();
      for (let r = 0; r < 8; r++)
        if (placed[r].every(c => c !== null)) flashR.add(r);
      for (let c = 0; c < 8; c++)
        if (placed.every(r => r[c] !== null)) flashC.add(c);

      const pColor = COLORS.pieces[piece.color]?.fill ?? COLORS.primary;
      flashColorRef.current = pColor;
      setFlashRows(flashR); setFlashCols(flashC);
      setTimeout(() => { setFlashRows(new Set()); setFlashCols(new Set()); }, 240);

      glowAnim.stopAnimation();
      glowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 80,  useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]).start();

      if (result.newCombo > 1 || linesCleared > 1) {
        const firstRow = flashR.size > 0 ? Math.min(...flashR) : 3;
        const rowY = 8 + firstRow * CELL_STEP + CELL_SIZE / 2;
        const text = result.newCombo > 1 ? `×${result.newCombo} COMBO 🔥` : `${linesCleared} LINES ✨`;
        setComboFloatText(text); setComboFloatRowY(rowY);
        comboFloatY.setValue(0); comboFloatOpacity.setValue(1);
        setComboFloatVisible(true);
        Animated.sequence([
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(comboFloatY,       { toValue: -50, duration: 600, useNativeDriver: true }),
            Animated.timing(comboFloatOpacity, { toValue: 0,   duration: 600, useNativeDriver: true }),
          ]),
        ]).start(() => setComboFloatVisible(false));
      }
    }

    if (linesCleared > 0) {
      hapticsRef.current.lineCleared();
      soundRef.current.playClear();
      if (result.newCombo > 1) {
        hapticsRef.current.comboAchieved();
        soundRef.current.playCombo();
      }
    } else {
      hapticsRef.current.piecePlaced();
      soundRef.current.playPlace();
    }
    if (isOver) {
      hapticsRef.current.levelFailed();
      soundRef.current.playFail();
    }

    setGrid(cleared); setTray(finalTray); setSelected(nextSel);
    setScore(result.newScore); setCombo(result.newCombo);
    setBestCombo(newBestCombo);
    setLinesTotal(l => l + linesCleared);
    setPiecesPlaced(p => p + 1);
    setRecentIndices(newRecent);
    setGhost(null); setGhostValid(false);
    if (isOver) {
      setTimeout(() => {
        showInterstitial(() => setGameOver(true));
      }, 600);
    }
  }, []);

  // ─── Pan responders ────────────────────────────────────────────────────────

  const panResponders = useRef([0, 1, 2].map(idx =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        if (gameOverRef.current) return;
        setSelected(idx); setIsDragging(true);
        hapticsRef.current.piecePicked();
      },
      onPanResponderMove: (e) => {
        if (gameOverRef.current) return;
        const piece = trayRef.current[idx];
        if (!piece || !gridOrigin.current) return;
        const { row, col } = fingerToCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        setGhost(c); setGhostValid(canPlace(gridRef.current, piece, c.row, c.col));
      },
      onPanResponderRelease: (e) => {
        setIsDragging(false); setGhost(null); setGhostValid(false);
        if (gameOverRef.current) return;
        const piece = trayRef.current[idx];
        if (!piece || !gridOrigin.current) return;
        const { row, col } = fingerToCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        dropAt(c.row, c.col, piece, idx);
      },
      onPanResponderTerminate: () => { setIsDragging(false); setGhost(null); setGhostValid(false); },
    })
  )).current;

  function handleCellTap(row: number, col: number) {
    if (!activePiece || gameOver || isDragging) return;
    const c = clamp(row - Math.floor(activePiece.shape.length / 2), col - Math.floor(activePiece.shape[0].length / 2), activePiece);
    dropAt(c.row, c.col);
  }

  function restart() {
    const g = createGrid();
    setGrid(g); setTray(drawWeightedTray([], g) as Tray);
    setSelected(0); setScore(0); setCombo(0); setBestCombo(0);
    setLinesTotal(0); setPiecesPlaced(0); setGameOver(false);
    setIsNewRecord(false); setRecentIndices([]);
    setGhost(null); setGhostValid(false); setIsDragging(false);
    setFlashRows(new Set()); setFlashCols(new Set()); setLinesJustCleared(false);
    setComboFloatVisible(false); glowAnim.setValue(0);
  }

  function handleWatchAd() {
    showRewarded(() => {
      const freshTray = drawWeightedTray([], gridRef.current) as Tray;
      setTray(freshTray);
      setGameOver(false);
      setCombo(0);
      setIsDragging(false);
    });
  }

  function handleBack() {
    if (gameOver || piecesPlaced === 0) { router.back(); return; }
    Alert.alert(
      "Leave game?",
      "Your current run will be lost.",
      [
        { text: "Keep Playing", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View
      style={styles.container}
      onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
        containerOrigin.current = { x: px, y: py };
      })}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.modeLabel}>∞ CLASSIC</Text>
          {combo > 1 && <Text style={styles.comboText}>🔥 ×{combo}</Text>}
        </View>

        <View style={styles.bestBox}>
          <Text style={styles.bestBoxLabel}>BEST</Text>
          <Text style={styles.bestBoxNum}>
            {Math.max(personalBest, score).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <AnimatedScore
          value={score}
          style={styles.score}
          duration={350}
          flash={linesJustCleared}
        />
        {score > 0 && score > personalBest && (
          <View style={styles.newRecordBadge}>
            <Text style={styles.newRecordText}>🏆 NEW RECORD</Text>
          </View>
        )}
      </View>

      {/* Grid */}
      <View style={styles.gridWrapper}>

        <Animated.View style={[styles.gridGlow, {
          opacity: glowAnim,
          borderColor: flashColorRef.current,
          shadowColor: flashColorRef.current,
        }]} pointerEvents="none" />

        {comboFloatVisible && (
          <Animated.View style={[styles.comboFloat, {
            top: comboFloatRowY - 20,
            opacity: comboFloatOpacity,
            transform: [{ translateY: comboFloatY }],
          }]} pointerEvents="none">
            <Text style={styles.comboFloatText}>{comboFloatText}</Text>
          </Animated.View>
        )}

        <Animated.View
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
                const isFlashing = flashRows.has(r) || flashCols.has(c);
                const color = cell !== null ? COLORS.pieces[cell] : null;

                return (
                  <TouchableOpacity key={c} activeOpacity={0.8}
                    onPress={() => handleCellTap(r, c)}
                    style={[
                      styles.cell,
                      cell !== null && {
                        backgroundColor: color!.fill,
                        shadowColor: color!.fill,
                        shadowOpacity: 0.45, shadowRadius: 3,
                        shadowOffset: { width: 0, height: 2 },
                      },
                      isFlashing && cell !== null && { backgroundColor: flashColorRef.current, opacity: 1 },
                      isFlashing && cell === null && { backgroundColor: flashColorRef.current, opacity: 0.55 },
                      !isGhost && !isFlashing && willClear && cell === null && { backgroundColor: COLORS.accent, opacity: 0.18 },
                    ]}
                  />
                );
              })}
            </View>
          ))}

        </Animated.View>

        {/* Placement overlay — sibling of gridContainer inside gridWrapper, matching Rush structure */}
        {isDragging && ghost && activePiece && (
          <View style={styles.placementOverlay} pointerEvents="none">
            {Array.from({ length: 8 }, (_, r) => (
              <View key={r} style={styles.row}>
                {Array.from({ length: 8 }, (_, c) => {
                  const isGhost = ghostCells.has(`${r},${c}`);
                  const gc      = COLORS.pieces[activePiece.color];
                  if (isGhost && ghostValid) {
                    return <View key={c} style={[styles.overlayCell, { backgroundColor: gc.fill, opacity: 1, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" }]} />;
                  }
                  if (isGhost && !ghostValid) {
                    return (
                      <View key={c} style={[styles.overlayCell, { backgroundColor: gc.fill, opacity: 0.85, borderWidth: 2, borderColor: COLORS.danger }]}>
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
        {isDragging ? "Release to place" : "Drag a piece · or select then tap grid"}
      </Text>

      {/* Tray */}
      <View style={styles.tray}>
        {tray.map((piece, i) => !piece
          ? (
            <View key={i} style={styles.trayEmpty}>
              <View style={styles.trayEmptyDot} />
              <View style={styles.trayEmptyDot} />
              <View style={styles.trayEmptyDot} />
            </View>
          )
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

      {/* Single banner ad — sits flush below the tray, no extra gap */}
      {BannerAd && BannerAdSize && (
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          />
        </View>
      )}

      {gameOver && (
        <GameOverScreen
          score={score}
          best={personalBest}
          isNewRecord={isNewRecord}
          piecesPlaced={piecesPlaced}
          linesCleared={linesTotal}
          bestCombo={bestCombo}
          onReplay={restart}
          onHome={() => router.back()}
          onWatchAd={handleWatchAd}
        />
      )}
    </View>
  );
}

// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    paddingTop: 52, paddingHorizontal: 16, alignItems: "center",
  },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", width: "100%", height: 44, marginBottom: 4,
  },
  back: {
    color: COLORS.textDim, fontSize: 16,
    fontFamily: "FredokaOne_400Regular",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  modeLabel: {
    color: COLORS.textDim, fontSize: 11,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 2,
  },
  comboText: {
    color: COLORS.accent, fontSize: 13,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
  },
  bestBox: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4, alignItems: "center",
  },
  bestBoxLabel: {
    color: COLORS.textDim, fontSize: 9,
    fontFamily: "FredokaOne_400Regular", letterSpacing: 2,
  },
  bestBoxNum: {
    color: COLORS.text, fontSize: 14,
    fontFamily: "LuckiestGuy_400Regular",
  },
  scoreRow: { alignItems: "center", marginBottom: 10, width: "100%" },
  score: {
    color: COLORS.text, fontSize: 52,
    fontFamily: "LuckiestGuy_400Regular",
    textAlign: "center", lineHeight: 58, letterSpacing: 2,
  },
  newRecordBadge: {
    backgroundColor: "rgba(255,230,109,0.12)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.accent, marginTop: 4,
  },
  newRecordText: {
    color: COLORS.accent, fontSize: 12,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
  },
  gridWrapper: { position: "relative" as any },
  gridGlow: {
    position: "absolute" as any,
    top: -5, left: -5, right: -5, bottom: -5,
    borderRadius: 20, borderWidth: 3,
    borderColor: COLORS.primary,
    shadowOpacity: 1, shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  comboFloat: {
    position: "absolute" as any,
    left: 0, right: 0, alignItems: "center", zIndex: 20,
  },
  comboFloatText: {
    color: "#FFFFFF", fontSize: 22,
    fontFamily: "LuckiestGuy_400Regular", letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  gridContainer: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 8, gap: GAP,
    position: "relative" as any,
  },
  row: { flexDirection: "row", gap: GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_R,
    backgroundColor: COLORS.cellEmpty,
    alignItems: "center", justifyContent: "center",
  },
  placementOverlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
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
  hint: {
    color: COLORS.textDim, fontSize: 12,
    fontFamily: "FredokaOne_400Regular",
    marginTop: 8, marginBottom: 4,
  },
  tray: {
    flexDirection: "row", gap: 10, marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18, padding: 12, alignItems: "center", justifyContent: "center",
  },
  traySlot: {
    padding: 10, borderRadius: 12, borderWidth: 2, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
    minWidth: 72, minHeight: 56, backgroundColor: "rgba(255,255,255,0.04)",
  },
  traySlotSelected: {
    borderColor: "#19db6c", backgroundColor: "rgba(78,205,196,0.1)",
    transform: [{ scale: 1.05 }],
  },
  trayEmpty: {
    minWidth: 72, minHeight: 56, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    borderStyle: "dashed", alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 4,
  },
  trayEmptyDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)",
  },
  bannerContainer: {
    width: "100%", alignItems: "center", marginTop: 20,
  },
});