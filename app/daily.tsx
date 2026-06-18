// app/daily.tsx
//
// Daily Challenge screen.
// Every player in the world gets the exact same puzzle each day.
// The seed is derived from today's UTC date — same date = same seed = same pieces.
// Once completed, the result is locked until midnight UTC.

import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  PanResponder, Animated, Dimensions,
} from "react-native";
import { useRef, useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { COLORS, SIZES, TEXT } from "../src/constants/theme";
import { createGrid, canPlace, placePiece, clearLines, hasAnyValidMove } from "../src/game/grid";
import { getDailySeed, randomPieceSeeded, seededRandom, PIECES } from "../src/game/pieces";
import { calculateScore, countCells } from "../src/game/scoring";
import { loadTodaysDailyResult, saveDailyResult, incrementStreakOnDailyComplete, updateAndLoadStreak } from "../src/store/storage";
import { Grid, Piece, Tray } from "../src/types";

// ─── Daily level config ────────────────────────────────────────────────────────
const DAILY_PIECE_COUNT = 20;
const DAILY_TARGET      = 3000;

// ─── Difficulty curve ─────────────────────────────────────────────────────────
// Pieces are bucketed by complexity. The first few slots pull only from easy
// buckets; by the end of the tray the full pool is in play.
//
// Complexity proxy: cell count + bounding-box span
//   easy   — small squares, simple L shapes (≤4 cells, compact)
//   medium — straight bars, T-shapes (4–5 cells, moderate span)
//   hard   — S/Z, long bars, irregular 5-cell shapes
//
// pieceIndex → difficulty tier (0 = easy only, 1 = easy+medium, 2 = all)
function difficultyTier(pieceIndex: number): 0 | 1 | 2 {
  if (pieceIndex < 6)  return 0; // first 6 pieces: easy only
  if (pieceIndex < 12) return 1; // next 6: easy + medium
  return 2;                       // remainder: full pool
}

function classifyPiece(piece: Piece): "easy" | "medium" | "hard" {
  const cells = piece.shape.flat().filter(Boolean).length;
  const rows  = piece.shape.length;
  const cols  = piece.shape[0].length;
  const span  = Math.max(rows, cols);
  if (cells <= 3 || (cells === 4 && span <= 2)) return "easy";
  if (cells === 4 || (cells === 5 && span <= 3)) return "medium";
  return "hard";
}

function pickPieceForTier(rng: () => number, tier: 0 | 1 | 2): Piece {
  const allowed = (p: Piece) => {
    const c = classifyPiece(p);
    if (tier === 0) return c === "easy";
    if (tier === 1) return c === "easy" || c === "medium";
    return true;
  };
  const pool = PIECES.filter(allowed);
  const src  = pool.length > 0 ? pool : PIECES;
  const idx  = Math.floor(rng() * src.length);
  return { ...src[idx], color: src[idx].color };
}

// ─── Responsive sizing ─────────────────────────────────────────────────────────
const SCREEN_H  = Dimensions.get("window").height;
const SCREEN_W  = Dimensions.get("window").width;
const GAP       = 4;
const AVAILABLE = Math.min(SCREEN_H * 0.52, SCREEN_W - 32);
const RAW_CELL  = Math.floor(AVAILABLE / 8) - GAP;
const CELL_SIZE = Math.max(30, Math.min(RAW_CELL, 46));
const CELL_STEP = CELL_SIZE + GAP;
const CELL_R    = Math.round(CELL_SIZE * 0.22);
const LIFT      = 110;

type Phase = "playing" | "won" | "failed" | "stuck" | "already_done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fingerToCell(fx: number, fy: number, origin: { x: number; y: number }, piece: Piece) {
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

function getStars(score: number): number {
  if (score >= DAILY_TARGET * 2)   return 3;
  if (score >= DAILY_TARGET * 1.5) return 2;
  if (score >= DAILY_TARGET)       return 1;
  return 0;
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
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

function ScoreBar({ score, piecesRemaining }: { score: number; piecesRemaining: number }) {
  const progress = Math.min(score / DAILY_TARGET, 1);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 350, useNativeDriver: false }).start();
  }, [progress]);

  const barColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [COLORS.danger, COLORS.accent, COLORS.primary],
  });
  const isLow     = piecesRemaining <= 5;
  const isVeryLow = piecesRemaining <= 2;

  return (
    <View style={sbS.container}>
      <View style={sbS.row}>
        <View>
          <Text style={sbS.dailyLabel}>📅  DAILY CHALLENGE</Text>
          <Text style={sbS.dateText}>{formatToday()}</Text>
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
      <Text style={sbS.scoreText}>
        {score.toLocaleString()}
        <Text style={sbS.targetText}> / {DAILY_TARGET.toLocaleString()} to pass</Text>
      </Text>
    </View>
  );
}

const sbS = StyleSheet.create({
  container: { width: "100%", gap: 5, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dailyLabel: { color: COLORS.primary, fontSize: 11, ...TEXT.badge },
  dateText:   { color: COLORS.textDim, fontSize: 12, marginTop: 2, ...TEXT.body },
  counter: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 5, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", minWidth: 64,
  },
  cLow:     { borderColor: COLORS.accent, backgroundColor: "rgba(255,230,109,0.08)" },
  cVeryLow: { borderColor: COLORS.danger, backgroundColor: "rgba(255,107,107,0.1)" },
  cNum:   { color: COLORS.text,    fontSize: 20, lineHeight: 22, ...TEXT.number },
  cLabel: { color: COLORS.textDim, fontSize: 9,  ...TEXT.label },
  track: { height: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" },
  fill:  { height: "100%", borderRadius: 5 },
  tick:  { position: "absolute", right: 0, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  scoreText:  { color: COLORS.text,    fontSize: 15, ...TEXT.number },
  targetText: { color: COLORS.textDim, fontSize: 12, ...TEXT.body },
});

// ─── Already Done Screen ──────────────────────────────────────────────────────

function AlreadyDoneScreen({ score, stars }: { score: number; stars: number }) {
  const now      = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diff     = midnight.getTime() - now.getTime();
  const hours    = Math.floor(diff / 3_600_000);
  const mins     = Math.floor((diff % 3_600_000) / 60_000);

  return (
    <View style={adS.container}>
      <Text style={adS.icon}>✅</Text>
      <Text style={adS.title}>Today's done!</Text>
      <Text style={adS.date}>{formatToday()}</Text>
      <View style={adS.scoreBox}>
        <Text style={adS.scoreLabel}>YOUR SCORE</Text>
        <Text style={adS.scoreNum}>{score.toLocaleString()}</Text>
        <View style={adS.starsRow}>
          {[1, 2, 3].map(s => (
            <View style={adS.starsRow}>
              {[1].map(s => (
                <Image
                  key={s}
                  source={s <= stars
                    ? require("../assets/icons/icon_Stars.png")
                    : require("../assets/icons/empty_star.png")}
                  style={{ width: 32, height: 32, resizeMode: "contain", opacity: s > stars ? 0.25 : 1 }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={adS.countdownBox}>
        <Text style={adS.countdownLabel}>Next challenge in</Text>
        <Text style={adS.countdown}>{hours}h {mins}m</Text>
      </View>
      <TouchableOpacity style={adS.btn} onPress={() => router.back()}>
        <Text style={adS.btnText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const adS = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: "center", justifyContent: "center",
    padding: 32, gap: 16,
  },
  icon:  { fontSize: 56 },
  title: { color: COLORS.text,    fontSize: 28, ...TEXT.title },
  date:  { color: COLORS.textDim, fontSize: 14, ...TEXT.body },
    scoreBox: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16,
    paddingHorizontal: 40, paddingVertical: 20,
    alignItems: "center", gap: 6, width: "100%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  scoreLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 3, ...TEXT.body },
  scoreNum:   { color: COLORS.primary, fontSize: 48, ...TEXT.score },
  starsRow:   { flexDirection: "row", gap: 8 },
  star:    { fontSize: 28 },
  starDim: { opacity: 0.2 },
  countdownBox: {
    backgroundColor: "rgba(78,205,196,0.08)", borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
    alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "rgba(78,205,196,0.2)",
  },
  countdownLabel: { color: COLORS.textDim, fontSize: 12, ...TEXT.body },
  countdown: { color: COLORS.primary, fontSize: 32, ...TEXT.number },
  btn:     { marginTop: 8 },
  btnText: { color: COLORS.textDim, fontSize: 16, ...TEXT.nav },
});

// ─── Results Overlay ──────────────────────────────────────────────────────────

function ResultsOverlay({ phase, score, onHome }: {
  phase: Phase; score: number; onHome: () => void;
}) {
  const stars = getStars(score);
  const isWon = phase === "won";

  const shareText =
    `📅 BlockBlast Daily ${formatToday()}\n` +
    `${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}\n` +
    `Score: ${score.toLocaleString()}`;

  return (
    <View style={roS.overlay}>
      <View style={roS.modal}>
        <Image
          source={isWon
            ? require("../assets/icons/icon_Trophy.png")
            : require("../assets/icons/icon_sad_face.png")}
          style={roS.icon}
        />
        <Text style={roS.title}>
          {isWon ? "Challenge Complete!" : phase === "stuck" ? "No Moves Left!" : "Not Quite!"}
        </Text>
        <Text style={roS.date}>{formatToday()}</Text>

        {isWon && (
          <View style={roS.starsRow}>
            {[1, 2, 3].map(s => (
              <Image
                key={s}
                source={s <= stars
                  ? require("../assets/icons/icon_Stars.png")
                  : require("../assets/icons/empty_star.png")}
                style={[roS.starImg, s > stars && roS.starDim]}
              />
            ))}
          </View>
        )}

        <View style={roS.scoreBox}>
          <Text style={roS.scoreLabel}>SCORE</Text>
          <Text style={[roS.scoreNum, { color: isWon ? COLORS.primary : COLORS.danger }]}>
            {score.toLocaleString()}
          </Text>
          {!isWon && (
            <Text style={roS.gapText}>
              {Math.round((score / DAILY_TARGET) * 100)}% of target
            </Text>
          )}
        </View>

        <View style={roS.shareBox}>
          <Text style={roS.shareText}>{shareText}</Text>
        </View>

        <Text style={roS.comeBack}>Come back tomorrow for a new challenge!</Text>

        <TouchableOpacity style={roS.btn} onPress={onHome}>
          <Text style={roS.btnText}>← Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const roS = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    backgroundColor: "#1B2A4A", borderRadius: 28,
    paddingHorizontal: 28, paddingVertical: 32,
    alignItems: "center", gap: 10, width: "90%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000", shadowOpacity: 0.6,
    shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
  },
  icon:  { width: 52, height: 52, resizeMode: "contain" },
  title:    { color: COLORS.text, fontSize: 22, textAlign: "center", ...TEXT.title },
  date:     { color: COLORS.textDim, fontSize: 13, ...TEXT.body },
  starsRow: { flexDirection: "row", gap: 8 },
  starImg:  { width: 28, height: 28 },
  starDim:  { opacity: 0.25 },
  scoreBox: {
    alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
    width: "100%", gap: 2,
  },
  scoreLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 3, ...TEXT.body },
  scoreNum:   { fontSize: 40, ...TEXT.score },
  gapText:    { color: COLORS.textDim, fontSize: 12, marginTop: 4, ...TEXT.body },
  shareBox: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10,
    padding: 12, width: "100%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  shareText: { color: COLORS.textDim, fontSize: 13, textAlign: "center", lineHeight: 20, ...TEXT.body },
  comeBack:  { color: COLORS.primary, fontSize: 13, textAlign: "center", ...TEXT.body },
  btn:     { marginTop: 4 },
  btnText: { color: COLORS.textDim, fontSize: 15, ...TEXT.nav },
});

// ─── Daily Game Screen ────────────────────────────────────────────────────────

export default function DailyScreen() {
  const seed = getDailySeed();
  const rng  = seededRandom(seed);

  // Pre-generate ALL pieces upfront using the difficulty curve.
  // pieceIndex drives the tier; seeded RNG drives the pick within that tier.
  // Same seed + same curve = same sequence on every device, every day.
  const dailyPieces = useRef<Piece[]>(
    Array.from({ length: DAILY_PIECE_COUNT + 9 }, (_, i) =>
      pickPieceForTier(rng, difficultyTier(i))
    )
  ).current;
  const pieceIndex = useRef(0);

  function nextPiece(): Piece {
    const p = dailyPieces[pieceIndex.current % dailyPieces.length];
    pieceIndex.current++;
    return p;
  }

  const [grid, setGrid] = useState<Grid>(() => createGrid());
  const [tray, setTray] = useState<Tray>(() => [nextPiece(), nextPiece(), nextPiece()]);
  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [piecesRemaining, setPiecesRemaining] = useState(DAILY_PIECE_COUNT);
  const [phase, setPhase] = useState<Phase>("playing");
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [ghostValid, setGhostValid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState<{ score: number; stars: number } | null>(null);
  const [streak, setStreak] = useState(0);

  const gridOrigin      = useRef<{ x: number; y: number } | null>(null);
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPosition    = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const gridRef     = useRef(grid);            gridRef.current     = grid;
  const trayRef     = useRef(tray);            trayRef.current     = tray;
  const selectedRef = useRef(selected);        selectedRef.current = selected;
  const scoreRef    = useRef(score);           scoreRef.current    = score;
  const comboRef    = useRef(combo);           comboRef.current    = combo;
  const piecesRef   = useRef(piecesRemaining); piecesRef.current   = piecesRemaining;
  const phaseRef    = useRef(phase);           phaseRef.current    = phase;

  useEffect(() => {
    async function check() {
      const result = await loadTodaysDailyResult();
      if (result) setAlreadyDone({ score: result.score, stars: result.stars });
      const s = await updateAndLoadStreak();
      setStreak(s);
    }
    check();
  }, []);

  // Save result when phase reaches a terminal state.
  // Streak only increments on "won" — failed and stuck don't count.
  useEffect(() => {
    if (phase === "won" || phase === "failed" || phase === "stuck") {
      const stars = getStars(score);
      saveDailyResult(score, stars);
      if (phase === "won") {
        incrementStreakOnDailyComplete();
      }
    }
  }, [phase]);

  const activePiece = tray[selected];

  const ghostCells     = new Set<string>();
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

  const dropAt = useCallback((row: number, col: number, pieceOverride?: Piece, trayIdx?: number) => {
    if (phaseRef.current !== "playing") return;
    const curGrid = gridRef.current;
    const curTray = trayRef.current;
    const curSel  = trayIdx ?? selectedRef.current;
    const piece   = pieceOverride ?? curTray[curSel];
    if (!piece || !canPlace(curGrid, piece, row, col)) return;

    const placed = placePiece(curGrid, piece, row, col);
    const { grid: cleared, linesCleared } = clearLines(placed);
    const result = calculateScore(scoreRef.current, comboRef.current, countCells(piece.shape), linesCleared);

    const newTray = [...curTray] as Tray;
    newTray[curSel] = null;
    const allUsed   = newTray.every(p => p === null);
    const finalTray: Tray = allUsed
      ? [nextPiece(), nextPiece(), nextPiece()]
      : newTray;

    let nextSel = allUsed ? 0 : curSel;
    if (!allUsed) {
      for (let i = 1; i <= 3; i++) {
        const idx = (curSel + i) % 3;
        if (finalTray[idx]) { nextSel = idx; break; }
      }
    }

    const newPieces = piecesRef.current - 1;
    let newPhase: Phase = "playing";
    if (newPieces <= 0)
      newPhase = result.newScore >= DAILY_TARGET ? "won" : "failed";
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
  }, []);

  const panResponders = useRef([0, 1, 2].map(idx =>
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (e) => {
        if (phaseRef.current !== "playing") return;
        setSelected(idx); setIsDragging(true);
        dragPosition.setValue({
          x: e.nativeEvent.pageX - containerOrigin.current.x,
          y: e.nativeEvent.pageY - containerOrigin.current.y - LIFT,
        });
      },

      onPanResponderMove: (e) => {
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece) return;
        dragPosition.setValue({
          x: e.nativeEvent.pageX - containerOrigin.current.x,
          y: e.nativeEvent.pageY - containerOrigin.current.y - LIFT,
        });
        if (!gridOrigin.current) return;
        const { row, col } = fingerToCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        setGhost(c);
        setGhostValid(canPlace(gridRef.current, piece, c.row, c.col));
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
    const c = clamp(
      row - Math.floor(activePiece.shape.length / 2),
      col - Math.floor(activePiece.shape[0].length / 2),
      activePiece
    );
    dropAt(c.row, c.col);
  }

  if (alreadyDone) {
    return <AlreadyDoneScreen score={alreadyDone.score} stars={alreadyDone.stars} />;
  }

  return (
    <View
      style={styles.container}
      onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
        containerOrigin.current = { x: px, y: py };
      })}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        {streak > 1 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak} day streak</Text>
          </View>
        )}
        {combo > 1 && (
          <View style={styles.comboBadge}>
            <Text style={styles.comboText}>⚡ ×{combo}</Text>
          </View>
        )}
      </View>

      <ScoreBar score={score} piecesRemaining={piecesRemaining} />

      <View style={styles.gridWrapper}>
        <View
          style={styles.gridContainer}
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
        </View>

        {/* Placement overlay */}
        {isDragging && ghost && activePiece && (
          <View style={styles.placementOverlay} pointerEvents="none">
            {Array.from({ length: 8 }, (_, r) => (
              <View key={r} style={styles.row}>
                {Array.from({ length: 8 }, (_, c) => {
                  const isGhost = ghostCells.has(`${r},${c}`);
                  const gc = COLORS.pieces[activePiece.color];
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

      {phase !== "playing" && (
        <ResultsOverlay phase={phase} score={score} onHome={() => router.back()} />
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
    width: "100%", height: 44, marginBottom: 4, gap: 10,
  },
  back: { color: COLORS.textDim, fontSize: 16, ...TEXT.nav },
  streakBadge: {
    backgroundColor: "rgba(255,107,107,0.12)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(255,107,107,0.3)",
  },
  streakText: { color: "#FF6B6B", fontSize: 12, ...TEXT.body },
  comboBadge: {
    backgroundColor: "rgba(255,230,109,0.12)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.accent,
  },
  comboText: { color: COLORS.accent, fontSize: 12, ...TEXT.badge },
  gridWrapper: { position: "relative" as any },
  gridContainer: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 8, gap: GAP,
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
  row:  { flexDirection: "row", gap: GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: CELL_R, backgroundColor: COLORS.cellEmpty,
  },
  hint: { color: COLORS.textDim, fontSize: 11, marginTop: 8, marginBottom: 4, ...TEXT.hint },
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