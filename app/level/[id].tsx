// app/level/[id].tsx

import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  PanResponder, Animated, Dimensions,
} from "react-native";
import { useRef, useState, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS, SIZES } from "../../src/constants/theme";
import {
  createGrid, createObstacleGrid,
  canPlace, placePiece, clearLines, hasAnyValidMove,
} from "../../src/game/grid";
import { drawWeightedTray, PIECES } from "../../src/game/pieces";
import { calculateScore, countCells } from "../../src/game/scoring";
import { getLevel, LevelConfig } from "../../src/game/levels";
import { saveHighestLevel, saveLevelStars, hasSeenObstacleTip, markObstacleTipSeen } from "../../src/store/storage";
import { AnimatedScore } from "../../src/components/AnimatedScore";
import { Grid, Piece, Tray, ObstacleGrid, GamePhase } from "../../src/types";
import { useHaptics } from "../../src/hooks/useHaptics";
import { useSound } from "../../src/hooks/useSound";

// ─── Sizing ───────────────────────────────────────────────────────────────────
const SCREEN_H  = Dimensions.get("window").height;
const SCREEN_W  = Dimensions.get("window").width;
const GAP       = 4;
const AVAILABLE = Math.min(SCREEN_H - 44 - 90 - 28 - 92 - 120, SCREEN_W - 32);
const CELL_SIZE = Math.max(30, Math.min(Math.floor(AVAILABLE / 8) - GAP, 46));
const CELL_STEP = CELL_SIZE + GAP;
const CELL_R    = Math.round(CELL_SIZE * 0.22);
const LIFT      = 110;

// ─── Obstacle helpers ─────────────────────────────────────────────────────────

// Emoji based on MAX durability (type doesn't change as it takes hits)
function obstacleEmoji(maxDur: number): string {
  if (maxDur >= 4) return "💣"; // 💣 bomb
  if (maxDur === 3) return "🪨"; // 🪨 rock
  return "🪵";                   // 🪵 wood
}

// Background color behind emoji — dims as durability drops
function obstacleBg(dur: number, maxDur: number): string {
  const r = dur / maxDur;
  if (r > 0.7) return "rgba(80,50,20,0.85)";
  if (r > 0.4) return "rgba(100,60,20,0.85)";
  return "rgba(140,40,20,0.9)";
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

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

function getStars(score: number, level: LevelConfig): number {
  if (score >= level.star3Score) return 3;
  if (score >= level.star2Score) return 2;
  if (score >= level.targetScore) return 1;
  return 0;
}

function getPieceIdx(piece: Piece): number {
  return PIECES.findIndex(p => JSON.stringify(p.shape) === JSON.stringify(piece.shape)) ?? 0;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ScoreBar({ score, level, piecesRemaining }: {
  score: number; level: LevelConfig; piecesRemaining: number;
}) {
  const progress = Math.min(score / level.targetScore, 1);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 350, useNativeDriver: false }).start();
  }, [progress]);
  const barColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [COLORS.danger, COLORS.accent, COLORS.primary],
  });
  const isLow = piecesRemaining <= 5, isVeryLow = piecesRemaining <= 2;
  return (
    <View style={sbS.container}>
      <View style={sbS.row}>
        <View>
          <Text style={sbS.levelLabel}>LEVEL {level.id}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <AnimatedScore value={score} style={sbS.scoreText} duration={400} />
            <Text style={sbS.targetText}>/ {level.targetScore.toLocaleString()}</Text>
          </View>
        </View>
        <View style={[sbS.counter, isLow && sbS.cLow, isVeryLow && sbS.cVeryLow]}>
          <Text style={[sbS.cNum, isLow && { color: COLORS.accent }, isVeryLow && { color: COLORS.danger }]}>
            {piecesRemaining}
          </Text>
          <Text style={sbS.cLabel}>left</Text>
        </View>
      </View>
      <View style={sbS.track}>
        <Animated.View style={[sbS.fill, {
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          backgroundColor: barColor,
        }]} />
        <View style={sbS.tick} />
      </View>
    </View>
  );
}

const sbS = StyleSheet.create({
  container: { width: "100%", gap: 5, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelLabel: { color: COLORS.primary, fontSize: 12, fontWeight: "bold", letterSpacing: 2 },
  scoreText: { color: COLORS.text, fontSize: 16, fontWeight: "bold", marginTop: 1 },
  targetText: { color: COLORS.textDim, fontSize: 12, fontWeight: "normal" },
  counter: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 5, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", minWidth: 64,
  },
  cLow: { borderColor: COLORS.accent, backgroundColor: "rgba(255,230,109,0.08)" },
  cVeryLow: { borderColor: COLORS.danger, backgroundColor: "rgba(255,107,107,0.1)" },
  cNum: { color: COLORS.text, fontSize: 20, fontWeight: "bold", lineHeight: 22 },
  cLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 1 },
  track: { height: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  tick: { position: "absolute", right: 0, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.3)" },
});

function ResultsScreen({ phase, score, level, onReplay, onNext, onHome, onWatchAd }: {
  phase: GamePhase; score: number; level: LevelConfig;
  onReplay: () => void; onNext: () => void; onHome: () => void; onWatchAd: () => void;
}) {
  const stars = getStars(score, level);
  const isWon = phase === "won";
  const gap = Math.abs(level.targetScore - score);
  const pct = Math.min(100, Math.round((score / level.targetScore) * 100));
  return (
    <View style={rsS.overlay}>
      <View style={rsS.modal}>
        <Text style={rsS.icon}>{isWon ? "🎉" : "😞"}</Text>
        <Text style={rsS.title}>
          {isWon ? (level.id === 99 ? "You finished! 🏆" : "Level Complete!")
                 : phase === "stuck" ? "No Moves Left!" : "So Close!"}
        </Text>
        {isWon && (
          <View style={rsS.starsRow}>
            {[1, 2, 3].map(s => <Text key={s} style={[rsS.star, s > stars && rsS.starDim]}>⭐</Text>)}
          </View>
        )}
        <View style={rsS.scoreBox}>
          <Text style={rsS.scoreLabel}>SCORE</Text>
          <Text style={[rsS.scoreNum, { color: isWon ? COLORS.primary : COLORS.danger }]}>
            {score.toLocaleString()}
          </Text>
          {!isWon && (
            <Text style={rsS.gapText}>
              {score >= level.targetScore
                ? "Target reached — board is full!"
                : `${pct}% of target · ${gap.toLocaleString()} pts short`}
            </Text>
          )}
        </View>
        {isWon ? (
          <>
            {level.id < 99 && (
              <TouchableOpacity style={rsS.btnPrimary} onPress={onNext}>
                <Text style={rsS.btnPrimaryText}>Next Level →</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={rsS.btnOutline} onPress={onReplay}>
              <Text style={rsS.btnOutlineText}>Play Again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={rsS.btnAd} onPress={onWatchAd}>
              <Text style={rsS.btnAdText}>📺  Watch Ad for +3 Pieces</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rsS.btnPrimary} onPress={onReplay}>
              <Text style={rsS.btnPrimaryText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={onHome} style={{ marginTop: 4 }}>
          <Text style={rsS.homeLink}>← Levels</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rsS = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.82)", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { backgroundColor: "#1B2A4A", borderRadius: 28, paddingHorizontal: 32, paddingVertical: 36, alignItems: "center", gap: 12, width: "88%", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  icon: { fontSize: 48 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "bold", textAlign: "center" },
  starsRow: { flexDirection: "row", gap: 8 },
  star: { fontSize: 30 },
  starDim: { opacity: 0.2 },
  scoreBox: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, width: "100%", gap: 2 },
  scoreLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 3 },
  scoreNum: { fontSize: 42, fontWeight: "bold" },
  gapText: { color: COLORS.textDim, fontSize: 12, marginTop: 4, textAlign: "center" },
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13, width: "100%", alignItems: "center" },
  btnPrimaryText: { color: COLORS.background, fontSize: 16, fontWeight: "bold" },
  btnOutline: { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 12, width: "100%", alignItems: "center", borderWidth: 1.5, borderColor: COLORS.primary },
  btnOutlineText: { color: COLORS.primary, fontSize: 15, fontWeight: "bold" },
  btnAd: { backgroundColor: COLORS.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13, width: "100%", alignItems: "center" },
  btnAdText: { color: COLORS.background, fontSize: 14, fontWeight: "bold" },
  homeLink: { color: COLORS.textDim, fontSize: 13 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const levelId = Math.max(1, Math.min(99, parseInt(id ?? "1", 10)));
  const level = getLevel(levelId);

  const [grid, setGrid] = useState<Grid>(() => createGrid());
  const [obstacles, setObstacles] = useState<ObstacleGrid>(() => createObstacleGrid(level.obstacles));
  const [tray, setTray] = useState<Tray>(() => {
    const g = createGrid(), o = createObstacleGrid(level.obstacles);
    return drawWeightedTray([], g, o) as Tray;
  });
  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [piecesRemaining, setPiecesRemaining] = useState(level.pieceCount);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [ghostValid, setGhostValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [recentIndices, setRecentIndices] = useState<number[]>([]);
  const [piecesPlaced, setPiecesPlaced] = useState(0);

  // ── Obstacle tutorial tooltip ───────────────────────────────────────────────
  const [showObstacleTip, setShowObstacleTip] = useState(false);

  useEffect(() => {
    if (level.obstacles.length > 0) {
      hasSeenObstacleTip().then(seen => {
        if (!seen) setShowObstacleTip(true);
      });
    }
  }, []);

  function dismissObstacleTip() {
    markObstacleTipSeen();
    setShowObstacleTip(false);
  }

  // ── Haptics + Sound ─────────────────────────────────────────────────────────
  const haptics = useHaptics();
  const sound = useSound();
  // Use refs so PanResponder closures always see the latest instances
  const hapticsRef = useRef(haptics); hapticsRef.current = haptics;
  const soundRef = useRef(sound); soundRef.current = sound;

  // ── Animation state ─────────────────────────────────────────────────────────
  // flashRows/Cols: briefly highlight cells that just cleared (200ms flash)
  const [flashRows, setFlashRows] = useState<Set<number>>(new Set());
  const [flashCols, setFlashCols] = useState<Set<number>>(new Set());
  // hitObstacles: obstacles that just took a hit (shake animation)
  const [hitObstacles, setHitObstacles] = useState<Set<string>>(new Set());
  // destroyedObstacles: obstacles that just died (burst animation)
  const [destroyedObstacles, setDestroyedObstacles] = useState<Set<string>>(new Set());
  // Score pop for obstacle bonuses
  const [obstaclePop, setObstaclePop] = useState<string | null>(null);
  const obsPopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gridOrigin = useRef<{ x: number; y: number } | null>(null);
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const gridRef = useRef(grid); gridRef.current = grid;
  const obsRef = useRef(obstacles); obsRef.current = obstacles;
  const trayRef = useRef(tray); trayRef.current = tray;
  const selRef = useRef(selected); selRef.current = selected;
  const scoreRef = useRef(score); scoreRef.current = score;
  const comboRef = useRef(combo); comboRef.current = combo;
  const piecesRef = useRef(piecesRemaining); piecesRef.current = piecesRemaining;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const recentRef = useRef(recentIndices); recentRef.current = recentIndices;

  const activePiece = tray[selected];

  const ghostCells = new Set<string>();
  const wouldClearRows = new Set<number>();
  const wouldClearCols = new Set<number>();
  if (ghost && activePiece && ghostValid) {
    for (let r = 0; r < activePiece.shape.length; r++)
      for (let c = 0; c < activePiece.shape[r].length; c++)
        if (activePiece.shape[r][c]) ghostCells.add(`${ghost.row + r},${ghost.col + c}`);
    const sim = placePiece(grid, activePiece, ghost.row, ghost.col);
    for (let r = 0; r < 8; r++)
      if (sim[r].every((c, ci) => c !== null || obstacles[r][ci] !== null)) wouldClearRows.add(r);
    for (let c = 0; c < 8; c++)
      if (sim.every((row, ri) => row[c] !== null || obstacles[ri][c] !== null)) wouldClearCols.add(c);
  }

  useEffect(() => {
    if (phase === "won") {
      saveHighestLevel(levelId);
      saveLevelStars(levelId, getStars(score, level));
    }
  }, [phase]);

  // ─── Drop ───────────────────────────────────────────────────────────────────

  const dropAt = useCallback((row: number, col: number, pieceOverride?: Piece, trayIdx?: number) => {
    if (phaseRef.current !== "playing") return;
    const curGrid = gridRef.current, curObs = obsRef.current;
    const curTray = trayRef.current, curSel = trayIdx ?? selRef.current;
    const piece = pieceOverride ?? curTray[curSel];
    if (!piece || !canPlace(curGrid, piece, row, col, curObs)) return;

    const placed = placePiece(curGrid, piece, row, col);
    const {
      grid: cleared, obstacles: clearedObs,
      linesCleared, obstaclesHit, obstaclesDestroyed,
    } = clearLines(placed, curObs);

    const result = calculateScore(
      scoreRef.current, comboRef.current,
      countCells(piece.shape), linesCleared,
      obstaclesHit, obstaclesDestroyed
    );

    const newTray = [...curTray] as Tray;
    newTray[curSel] = null;
    const allUsed = newTray.every(p => p === null);
    const newRecent = [...recentRef.current, getPieceIdx(piece)].slice(-6);
    const finalTray: Tray = allUsed
      ? drawWeightedTray(newRecent, cleared, clearedObs) as Tray
      : newTray;

    let nextSel = allUsed ? 0 : curSel;
    if (!allUsed) {
      for (let i = 1; i <= 3; i++) {
        const idx = (curSel + i) % 3;
        if (finalTray[idx]) { nextSel = idx; break; }
      }
    }

    const newPieces = piecesRef.current - 1;
    let newPhase: GamePhase = "playing";
    if (newPieces <= 0) newPhase = result.newScore >= level.targetScore ? "won" : "failed";
    else if (!hasAnyValidMove(cleared, finalTray, clearedObs)) {
      newPhase = result.newScore >= level.targetScore ? "won" : "stuck";
    }

    // ── Row/col clear flash animation ────────────────────────────────────
    // We need to know WHICH rows/cols cleared to flash them.
    // Re-detect from the placed grid (before clearing) using same logic as clearLines.
    if (linesCleared > 0) {
      const flashR = new Set<number>();
      const flashC = new Set<number>();
      for (let r = 0; r < 8; r++)
        if (placed[r].every((c, ci) => c !== null || curObs[r][ci] !== null)) flashR.add(r);
      for (let c = 0; c < 8; c++)
        if (placed.every((row, ri) => row[c] !== null || curObs[ri][c] !== null)) flashC.add(c);
      setFlashRows(flashR);
      setFlashCols(flashC);
      setTimeout(() => { setFlashRows(new Set()); setFlashCols(new Set()); }, 220);
    }

    // ── Obstacle hit/destroy animations ──────────────────────────────────
    if (obstaclesHit > 0) {
      // Find which obstacle cells were hit
      const hitSet = new Set<string>();
      const destroySet = new Set<string>();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const wasThere = curObs[r][c] !== null;
          const nowGone = clearedObs[r][c] === null;
          if (wasThere && nowGone) destroySet.add(`${r},${c}`);
          else if (wasThere && !nowGone && clearedObs[r][c]!.durability < curObs[r][c]!.durability)
            hitSet.add(`${r},${c}`);
        }
      }
      if (hitSet.size > 0) {
        setHitObstacles(hitSet);
        setTimeout(() => setHitObstacles(new Set()), 350);
      }
      if (destroySet.size > 0) {
        setDestroyedObstacles(destroySet);
        setTimeout(() => setDestroyedObstacles(new Set()), 500);
      }
    }

    // ── Obstacle bonus pop ────────────────────────────────────────────────
    if (result.obstaclePoints > 0) {
      if (obsPopTimer.current) clearTimeout(obsPopTimer.current);
      const text = obstaclesDestroyed > 0
        ? `${obstaclesDestroyed > 1 ? obstaclesDestroyed + "x " : ""}SMASHED! +${result.obstaclePoints}`
        : `Block hit! +${result.obstaclePoints}`;
      setObstaclePop(text);
      obsPopTimer.current = setTimeout(() => setObstaclePop(null), 1100);
    }

    setGrid(cleared); setObstacles(clearedObs); setTray(finalTray);
    setSelected(nextSel); setScore(result.newScore); setCombo(result.newCombo);
    setPiecesRemaining(newPieces); setPhase(newPhase);
    setRecentIndices(newRecent); setPiecesPlaced(p => p + 1); setGhost(null); setGhostValid(false);

    // ── Haptic + sound feedback ───────────────────────────────────────────
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
    if (newPhase === "won") {
      hapticsRef.current.levelComplete();
      soundRef.current.playWin();
    } else if (newPhase === "failed" || newPhase === "stuck") {
      hapticsRef.current.levelFailed();
      soundRef.current.playFail();
    }
  }, [level]);

  // ─── Pan responders ──────────────────────────────────────────────────────────

  const panResponders = useRef([0, 1, 2].map(idx =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        if (phaseRef.current !== "playing") return;
        setSelected(idx); setIsDragging(true);
        hapticsRef.current.piecePicked();
        dragPosition.setValue({ x: e.nativeEvent.pageX - containerOrigin.current.x, y: e.nativeEvent.pageY - containerOrigin.current.y - LIFT });
      },
      onPanResponderMove: (e) => {
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece) return;
        dragPosition.setValue({ x: e.nativeEvent.pageX - containerOrigin.current.x, y: e.nativeEvent.pageY - containerOrigin.current.y - LIFT });
        if (!gridOrigin.current) return;
        const { row, col } = fingerToCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        setGhost(c); setGhostValid(canPlace(gridRef.current, piece, c.row, c.col, obsRef.current));
      },
      onPanResponderRelease: (e) => {
        setIsDragging(false); setGhost(null); setGhostValid(false);
        if (phaseRef.current !== "playing") return;
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
    if (!activePiece || phase !== "playing" || isDragging) return;
    const c = clamp(row - Math.floor(activePiece.shape.length / 2), col - Math.floor(activePiece.shape[0].length / 2), activePiece);
    dropAt(c.row, c.col);
  }

  function restart() {
    const g = createGrid(), o = createObstacleGrid(level.obstacles);
    setGrid(g); setObstacles(o);
    setTray(drawWeightedTray([], g, o) as Tray);
    setSelected(0); setScore(0); setCombo(0);
    setPiecesRemaining(level.pieceCount); setPhase("playing");
    setPiecesPlaced(0);
    setGhost(null); setGhostValid(false); setIsDragging(false); setRecentIndices([]);
    setFlashRows(new Set()); setFlashCols(new Set());
    setHitObstacles(new Set()); setDestroyedObstacles(new Set());
    setObstaclePop(null);
  }

  const obsRemaining = obstacles.flat().filter(Boolean).length;

  // ── Back with confirmation ─────────────────────────────────────────────────
  function handleBack() {
    if (phase !== "playing" || piecesPlaced === 0) {
      router.back();
      return;
    }
    Alert.alert(
      "Leave level?",
      "Your current progress will be lost.",
      [
        { text: "Keep Playing", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View
      style={styles.container}
      onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => { containerOrigin.current = { x: px, y: py }; })}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.back}>← Levels</Text>
        </TouchableOpacity>
        {combo > 1 && (
          <View style={styles.comboBadge}><Text style={styles.comboText}>🔥 ×{combo}</Text></View>
        )}
        {level.obstacles.length > 0 && (
          <Text style={styles.obsRemaining}>🧱 {obsRemaining}</Text>
        )}
      </View>

      <ScoreBar score={score} level={level} piecesRemaining={piecesRemaining} />

      {/* Obstacle bonus pop */}
      {obstaclePop && (
        <View style={styles.obstaclePopBanner}>
          <Text style={styles.obstaclePopText}>{obstaclePop}</Text>
        </View>
      )}

      <View
        style={styles.gridContainer}
        onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => { gridOrigin.current = { x: px + 8, y: py + 8 }; })}
      >
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => {
              const key = `${r},${c}`;
              const isGhost = ghostCells.has(key);
              const willClear = wouldClearRows.has(r) || wouldClearCols.has(c);
              const isFlashing = flashRows.has(r) || flashCols.has(c);
              const obs = obstacles[r][c];
              const isHit = hitObstacles.has(key);
              const isDestroyed = destroyedObstacles.has(key);
              const color = cell !== null ? COLORS.pieces[cell] : null;
              const gc = activePiece ? COLORS.pieces[activePiece.color] : null;

              // ── Obstacle cell ──────────────────────────────────────────────
              if (obs !== null) {
                return (
                  <View key={c} style={[
                    styles.cell,
                    { backgroundColor: obstacleBg(obs.durability, obs.maxDurability) },
                    willClear && { borderWidth: 2, borderColor: COLORS.accent },
                    // Shake effect when hit: briefly show brighter background
                    isHit && { backgroundColor: "rgba(200,90,30,0.95)" },
                  ]}>
                    {/* Emoji background */}
                    <Text style={[styles.obstacleEmoji, { fontSize: CELL_SIZE * 0.52 }]}>
                      {obstacleEmoji(obs.maxDurability)}
                    </Text>
                    {/* Durability number overlay */}
                    <View style={styles.obstacleNumOverlay}>
                      <Text style={[styles.obstacleNumText, { fontSize: CELL_SIZE > 38 ? 11 : 9 }]}>
                        {obs.durability}
                      </Text>
                    </View>
                    {/* Crack overlay at low durability */}
                    {obs.durability === 1 && (
                      <View style={styles.crackOverlay} />
                    )}
                  </View>
                );
              }

              // ── Destroyed obstacle burst (brief) ───────────────────────────
              if (isDestroyed) {
                return (
                  <View key={c} style={[styles.cell, styles.destroyBurst]}>
                    <Text style={{ fontSize: CELL_SIZE * 0.5 }}>💥</Text>
                  </View>
                );
              }

              // ── Regular piece/empty cell ───────────────────────────────────
              return (
                <TouchableOpacity key={c} activeOpacity={0.8}
                  onPress={() => handleCellTap(r, c)}
                  style={[
                    styles.cell,
                    // Filled piece
                    cell !== null && {
                      backgroundColor: color!.fill,
                      shadowColor: color!.fill,
                      shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
                    },
                    // Line-clear flash: bright white-yellow overlay
                    isFlashing && cell !== null && { backgroundColor: "#FFFFFF", opacity: 0.9 },
                    isFlashing && cell === null && { backgroundColor: COLORS.accent, opacity: 0.6 },
                    // Ghost
                    !isFlashing && isGhost && ghostValid && { backgroundColor: gc!.fill, opacity: 0.5, borderWidth: 2, borderColor: gc!.fill },
                    !isFlashing && isGhost && !ghostValid && { backgroundColor: COLORS.danger, opacity: 0.38 },
                    // Would-clear hint
                    !isGhost && !isFlashing && willClear && cell === null && { backgroundColor: COLORS.accent, opacity: 0.18 },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.hint}>
        {isDragging ? "Release to place"
          : level.obstacles.length > 0 ? "Fill rows with obstacles to chip them away"
          : "Drag a piece · or select then tap grid"}
      </Text>

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

      {isDragging && activePiece && <DragShadow piece={activePiece} position={dragPosition} />}

      {/* Obstacle tutorial tooltip — shows once on first level with obstacles */}
      {showObstacleTip && (
        <TouchableOpacity
          style={tipS.overlay}
          activeOpacity={1}
          onPress={dismissObstacleTip}
        >
          <View style={tipS.card}>
            <Text style={tipS.emoji}>🪵  🪨  💣</Text>
            <Text style={tipS.title}>Obstacle Blocks!</Text>
            <Text style={tipS.body}>
              Fill the row or column containing a block to hit it.
              Reduce its number to 0 to destroy it and earn big bonus points!
            </Text>
            <View style={tipS.divider} />
            <Text style={tipS.dismiss}>Tap anywhere to continue</Text>
          </View>
        </TouchableOpacity>
      )}

      {phase !== "playing" && (
        <ResultsScreen
          phase={phase} score={score} level={level}
          onReplay={restart}
          onNext={() => router.replace(`/level/${levelId + 1}`)}
          onHome={() => router.back()}
          onWatchAd={() => { setPiecesRemaining(p => p + 3); setPhase("playing"); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 52, paddingHorizontal: 16, alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", width: "100%", height: 44, marginBottom: 4, gap: 10 },
  back: { color: COLORS.textDim, fontSize: 16 },
  comboBadge: { backgroundColor: "rgba(255,230,109,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.accent },
  comboText: { color: COLORS.accent, fontSize: 13, fontWeight: "bold" },
  obsRemaining: { marginLeft: "auto" as any, color: "#A67C52", fontSize: 13, fontWeight: "bold" },
  obstaclePopBanner: {
    backgroundColor: "rgba(140,80,20,0.92)",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 7,
    marginBottom: 6, borderWidth: 1, borderColor: "rgba(200,140,60,0.5)",
  },
  obstaclePopText: { color: "#FFE0A0", fontSize: 14, fontWeight: "bold", textAlign: "center" },
  gridContainer: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 8, gap: GAP },
  row: { flexDirection: "row", gap: GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_R,
    backgroundColor: COLORS.cellEmpty,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  // Obstacle cell parts
  obstacleEmoji: { position: "absolute", opacity: 0.9, lineHeight: CELL_SIZE },
  obstacleNumOverlay: {
    position: "absolute", bottom: 2, right: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1,
    minWidth: 14, alignItems: "center",
  },
  obstacleNumText: { color: "#FFE0A0", fontWeight: "bold", lineHeight: 13 },
  crackOverlay: {
    position: "absolute", inset: 0,
    borderWidth: 2, borderColor: "rgba(255,80,0,0.7)",
    borderRadius: CELL_R, borderStyle: "dashed",
  },
  destroyBurst: { backgroundColor: "rgba(255,180,0,0.3)", borderWidth: 1, borderColor: "rgba(255,180,0,0.5)" },
  hint: { color: COLORS.textDim, fontSize: 11, marginTop: 8, marginBottom: 4 },
  tray: { flexDirection: "row", gap: 10, marginTop: 8, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 12, alignItems: "center", justifyContent: "center" },
  traySlot: { padding: 10, borderRadius: 12, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center", minWidth: 72, minHeight: 56, backgroundColor: "rgba(255,255,255,0.04)" },
  traySlotSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(78,205,196,0.1)", transform: [{ scale: 1.05 }] },
  trayEmpty: {
    minWidth: 72, minHeight: 56, borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 4,
  },
  trayEmptyDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },});
const tipS = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: 24,
  },
  card: {
    backgroundColor: "#1B2A4A",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(166,124,82,0.4)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  emoji: { fontSize: 32, letterSpacing: 8 },
  title: {
    color: "#E8C99A",
    fontSize: 22,
    fontWeight: "bold",
  },
  body: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  divider: {
    width: "40%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dismiss: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
});