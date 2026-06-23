// app/level/[id].tsx

import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  PanResponder, Animated, Dimensions, ImageBackground, Image,
} from "react-native";
import { useRef, useState, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS, TEXT } from "../../src/constants/theme";
import {
  createGrid, createObstacleGrid,
  canPlace, placePiece, clearLines, hasAnyValidMove,
} from "../../src/game/grid";
import { drawWeightedTray, PIECES } from "../../src/game/pieces";
import { calculateScore, countCells } from "../../src/game/scoring";
import { getLevel, LevelConfig } from "../../src/game/levels";
import {
  saveHighestLevel, saveLevelStars,
  hasSeenObstacleTip, markObstacleTipSeen,
} from "../../src/store/storage";
import { AnimatedScore } from "../../src/components/AnimatedScore";
import { Grid, Piece, Tray, ObstacleGrid, GamePhase } from "../../src/types";
import { useHaptics } from "../../src/hooks/useHaptics";

// Banner ad — safe import, gracefully no-ops if package not installed
let BannerAd: any = null;
let BannerAdSize: any = null;
try {
  const admob = require("react-native-google-mobile-ads");
  BannerAd    = admob.BannerAd;
  BannerAdSize = admob.BannerAdSize;
} catch {}
import { useSound } from "../../src/hooks/useSound";
import { useRewardedAd } from "../../src/hooks/useAds";
import { AD_UNIT_IDS } from "../../src/constants/config";

// ─── Sizing ───────────────────────────────────────────────────────────────────

const SCREEN_H  = Dimensions.get("window").height;
const SCREEN_W  = Dimensions.get("window").width;
const GAP       = 4;
const AVAILABLE = Math.min(SCREEN_H - 44 - 90 - 28 - 92 - 120, SCREEN_W - 32);
const CELL_SIZE = Math.max(30, Math.min(Math.floor(AVAILABLE / 8) - GAP, 46));
const CELL_STEP = CELL_SIZE + GAP;
const CELL_R    = Math.round(CELL_SIZE * 0.22);
const LIFT      = 60;

// ─── Obstacle helpers ─────────────────────────────────────────────────────────

// Returns the local image source for each obstacle type
function obstacleImage(maxDur: number) {
  if (maxDur >= 4) return require("../../assets/pieces/bomb.png");
  if (maxDur === 3) return require("../../assets/pieces/stone.png");
  return require("../../assets/pieces/wood.png");
}

// obstacleBg removed — using image backgrounds now

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

function getStars(score: number, level: LevelConfig): number {
  if (score >= level.star3Score) return 3;
  if (score >= level.star2Score) return 2;
  if (score >= level.targetScore) return 1;
  return 0;
}

function getPieceIdx(piece: Piece): number {
  return PIECES.findIndex(p => JSON.stringify(p.shape) === JSON.stringify(piece.shape)) ?? 0;
}

function ObstacleIcon({ durability, size = 14 }: { durability: number; size?: number }) {
  const source = durability >= 4
    ? require("../../assets/pieces/bomb.png")
    : durability >= 3
      ? require("../../assets/pieces/stone.png")
      : require("../../assets/pieces/wood.png");
  return <Image source={source} style={{ width: size, height: size, resizeMode: "contain" }} />;
}

// ─── MiniPiece ────────────────────────────────────────────────────────────────

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

// Placement overlay handles ghost — no floating DragShadow needed

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, level, linesJustCleared, obsRemaining }: {
  score: number;
  level: LevelConfig;
  linesJustCleared: boolean;
  obsRemaining: number;
}) {
  // Bar fills 0 → star3Score so all 3 stars fit on the bar
  const maxScore = level.star3Score;
  const progress = Math.min(score / maxScore, 1);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 350, useNativeDriver: false }).start();
  }, [progress]);

  const barColor = anim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: [COLORS.danger, COLORS.accent, COLORS.primary],
  });

  // Star thresholds as percentages along the bar
  const thresholds = [
    { pct: level.targetScore / maxScore, lit: score >= level.targetScore },
    { pct: level.star2Score  / maxScore, lit: score >= level.star2Score  },
    { pct: 1.0,                           lit: score >= level.star3Score  },
  ];

  // Goal text — shows obstacle requirement when relevant
  const hasObstacles = level.obstacles.length > 0;
  const goalMet      = score >= level.star3Score;

  // Use the actual obstacle emoji matching what's shown in the grid
  const maxObsDur   = hasObstacles
    ? Math.max(...level.obstacles.map((o: any) => o.durability))
    : 2;
  const obsEmoji    = maxObsDur >= 4 ? "💣" : maxObsDur >= 3 ? "🪨" : "🪵";
  const obsGoalText = hasObstacles && obsRemaining > 0
    ? ` + destroy ${obsRemaining} ${obsEmoji}`
    : "";

  return (
    <View style={sbS.container}>
      <Text style={sbS.levelLabel}>LEVEL {level.id}</Text>

      <AnimatedScore
        value={score}
        style={sbS.scoreNum}
        duration={350}
        flash={linesJustCleared}
      />

      {/* Goal text — shows star3Score as the target */}
      <Text style={sbS.goalText}>
      {goalMet ? (
              obsRemaining > 0 ? (
                <View style={sbS.goalRow}>
                  <Text style={sbS.goalText}>Destroy {obsRemaining} </Text>
                  <ObstacleIcon durability={maxObsDur} size={13} />
                  <Text style={sbS.goalText}> to win!</Text>
                </View>
              ) : (
                <Text style={sbS.goalText}>Goal reached! 🎉</Text>
              )
            ) : (
              <View style={sbS.goalRow}>
                <Text style={sbS.goalText}>Goal: {level.star3Score.toLocaleString()}</Text>
                {hasObstacles && obsRemaining > 0 && (
                  <>
                    <Text style={sbS.goalText}> + destroy {obsRemaining} </Text>
                    <ObstacleIcon durability={maxObsDur} size={13} />
                  </>
                )}
              </View>
            )}
      </Text>

      {/* Progress bar with 3 star markers */}
      <View style={sbS.trackWrapper}>
        {/* Stars above the bar */}
        {thresholds.map((t, i) => (
          <View
            key={i}
            style={[sbS.starMarker, { left: `${Math.min(t.pct * 100, 98)}%` as any }]}
          >
            <Image
              source={t.lit
                ? require("../../assets/icons/icon_Stars.png")
                : require("../../assets/icons/empty_star.png")}
              style={{ width: 18, height: 18, resizeMode: "contain", opacity: t.lit ? 1 : 0.3 }}
            />
          </View>
        ))}

        {/* Progress track */}
        <View style={sbS.track}>
          <Animated.View style={[sbS.fill, {
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            backgroundColor: barColor,
          }]} />
        </View>
      </View>
    </View>
  );
}

const sbS = StyleSheet.create({
  goalRow: { flexDirection: "row", alignItems: "center" },
  container:  { width: "100%", alignItems: "center", gap: 4, marginBottom: 8 },
  levelLabel: { ...TEXT.label, color: COLORS.primary, fontSize: 11 },
  scoreNum: { ...TEXT.score, fontSize: 52, color: COLORS.text, lineHeight: 56, textAlign: "center" },
  goalText: { ...TEXT.hint, color: COLORS.textDim, fontSize: 12 },
  trackWrapper: {
    width: "100%",
    paddingTop: 20, // space for stars above bar
    position: "relative" as any,
  },
  starMarker: {
    position: "absolute" as any,
    top: 0,
    transform: [{ translateX: -8 }],
    alignItems: "center",
  },
  starIcon: { ...TEXT.number, fontSize: 16, color: "rgba(255,255,255,0.2)" },
  starLit:  { color: COLORS.accent },
  track: {
    height: 8, width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4, overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
});

// ─── ResultsScreen ────────────────────────────────────────────────────────────

function ResultsScreen({ phase, score, level, onReplay, onNext, onHome, onWatchAd }: {
  phase: GamePhase; score: number; level: LevelConfig;
  onReplay: () => void; onNext: () => void;
  onHome: () => void; onWatchAd: () => void;
}) {
  const stars  = getStars(score, level);
  const isWon  = phase === "won";
  const gap    = Math.abs(level.targetScore - score);
  const pct    = Math.min(100, Math.round((score / level.targetScore) * 100));

  return (
    <View style={rsS.overlay}>
      <View style={rsS.modal}>
          <Image
            source={isWon
              ? require("../../assets/icons/icon_Trophy.png")
              : require("../../assets/icons/icon_sad_face.png")}
            style={rsS.icon}
          />
        <Text style={rsS.title}>
          {isWon
            ? (level.id === 99 ? "You finished! 🏆" : "Level Complete!")
            : phase === "stuck" ? "No Moves Left!" : "So Close!"}
        </Text>

         {isWon && (
          <View style={rsS.starsRow}>
            {[1, 2, 3].map(s => (
              <Image
                key={s}
                source={s <= stars
                  ? require("../../assets/icons/icon_Stars.png")
                  : require("../../assets/icons/empty_star.png")}
                style={{ width: 36, height: 36, resizeMode: "contain", opacity: s > stars ? 0.25 : 1 }}
              />
            ))}
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
              <View style={rsS.btnInner}>
                <Text style={rsS.btnPrimaryText}>Next Level</Text>
                <Image source={require("../../assets/icons/arrow-right.png")} style={rsS.btnArrowRight} />
              </View>
            </TouchableOpacity>
            )}
            <TouchableOpacity style={rsS.btnOutline} onPress={onReplay}>
              <Text style={rsS.btnOutlineText}>Play Again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={rsS.btnAd} onPress={onWatchAd}>
              <Text style={rsS.btnAdText}> Watch Ad for +3 Pieces</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rsS.btnPrimary} onPress={onReplay}>
              <Text style={rsS.btnPrimaryText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}

       <TouchableOpacity onPress={onHome} style={rsS.homeBtn}>
        <Image source={require("../../assets/icons/arrow-left.png")} style={rsS.btnArrow} />
        <Text style={rsS.homeLink}>Levels</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
}

const rsS = StyleSheet.create({
  btnInner:     { flexDirection: "row", alignItems: "center", gap: 8 },
  btnArrowRight: { width: 20, height: 15, resizeMode: "contain", tintColor: COLORS.background },
  homeBtn:  { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  btnArrow: { width: 22, height: 16, resizeMode: "contain" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    backgroundColor: "#091526",
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 36,
    alignItems: "center",
    gap: 12,
    width: "88%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  icon:      { width: 56, height: 56, resizeMode: "contain" },
  title: { ...TEXT.title, color: COLORS.text, fontSize: 22, textAlign: "center" },
  starsRow:  { flexDirection: "row", gap: 8 },
  star:      { fontSize: 30 },
  starDim:   { opacity: 0.2 },
  scoreBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    width: "100%",
    gap: 2,
  },
  scoreLabel: { ...TEXT.label, color: COLORS.textDim, fontSize: 11, marginBottom: 12 },
  scoreNum: { ...TEXT.score, fontSize: 42 },
  gapText: { ...TEXT.hint, color: COLORS.textDim, fontSize: 12, marginTop: 4, textAlign: "center" },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 13,
    width: "100%",
    alignItems: "center",
  },
  btnPrimaryText: { ...TEXT.button, color: COLORS.background, fontSize: 16 },
  btnOutline: {
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  btnOutlineText: { ...TEXT.button, color: COLORS.primary, fontSize: 15 },
  btnAd: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
    width: "100%",
    alignItems: "center",
  },
  btnAdText: { ...TEXT.button, color: COLORS.background, fontSize: 14 },
  homeLink: { ...TEXT.nav, color: COLORS.textDim, fontSize: 13 },
});

// ─── Tooltip styles ───────────────────────────────────────────────────────────

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
    backgroundColor: "#091526",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(8,175,247,0.15)",
  },
  emojiRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  emojiImg: { width: 36, height: 36, resizeMode: "contain" },
  title: { ...TEXT.title, color: COLORS.accent, fontSize: 22 },
  body: { ...TEXT.body, color: "rgba(255,255,255,0.75)", fontSize: 15, textAlign: "center", lineHeight: 22 },
  divider: { width: "40%", height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dismiss: { ...TEXT.hint, color: "rgba(255,255,255,0.4)", fontSize: 13 },
});

// ─── LevelScreen ──────────────────────────────────────────────────────────────

export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const levelId = Math.max(1, Math.min(99, parseInt(id ?? "1", 10)));
  const level   = getLevel(levelId);

  // ── State ───────────────────────────────────────────────────────────────────
  const [grid,             setGrid]             = useState<Grid>(() => createGrid());
  const [obstacles,        setObstacles]        = useState<ObstacleGrid>(() => createObstacleGrid(level.obstacles));
  const [tray,             setTray]             = useState<Tray>(() => {
    const g = createGrid(), o = createObstacleGrid(level.obstacles);
    return drawWeightedTray([], g, o) as Tray;
  });
  const [selected,         setSelected]         = useState(0);
  const [score,            setScore]            = useState(0);
  const [combo,            setCombo]            = useState(0);
  const [piecesRemaining,  setPiecesRemaining]  = useState(level.pieceCount);
  const [phase,            setPhase]            = useState<GamePhase>("playing");
  const [ghost,            setGhost]            = useState<{ row: number; col: number } | null>(null);
  const [ghostValid,       setGhostValid]       = useState(false);
  const [isDragging,       setIsDragging]       = useState(false);
  const [recentIndices,    setRecentIndices]    = useState<number[]>([]);
  const [piecesPlaced,     setPiecesPlaced]     = useState(0);
  const [linesJustCleared, setLinesJustCleared] = useState(false);
  const [goalReached,     setGoalReached]     = useState(false);
  const [goalDismissed,   setGoalDismissed]   = useState(false);
  const [goalToastVisible,setGoalToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [showObstacleTip,  setShowObstacleTip]  = useState(false);

  // Animation state
  const [flashRows,         setFlashRows]         = useState<Set<number>>(new Set());
  const [flashCols,         setFlashCols]         = useState<Set<number>>(new Set());
  const [hitObstacles,      setHitObstacles]      = useState<Set<string>>(new Set());
  const [destroyedObstacles,setDestroyedObstacles]= useState<Set<string>>(new Set());
  const [obstaclePop,       setObstaclePop]       = useState<string | null>(null);
  const obsPopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Glow animation — pulses on line clear
  const glowAnim  = useRef(new Animated.Value(0)).current;

  // Flash piece color — row turns piece color before clearing
  const flashColorRef = useRef<string>(COLORS.primary); // ref = synchronous, no stale state

  // Combo float — appears at cleared row, floats up and fades
  const [comboFloatText,    setComboFloatText]    = useState("");
  const [comboFloatVisible, setComboFloatVisible] = useState(false);
  const [comboFloatRowY,    setComboFloatRowY]    = useState(100);
  const comboFloatY       = useRef(new Animated.Value(0)).current;
  const comboFloatOpacity = useRef(new Animated.Value(1)).current;

  // Refs
  const gridOrigin      = useRef<{ x: number; y: number } | null>(null);
  const containerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // No dragPosition needed — placement overlay handles ghost display

  const gridRef    = useRef(grid);    gridRef.current    = grid;
  const obsRef     = useRef(obstacles); obsRef.current   = obstacles;
  const trayRef    = useRef(tray);    trayRef.current    = tray;
  const selRef     = useRef(selected); selRef.current    = selected;
  const scoreRef   = useRef(score);   scoreRef.current   = score;
  const comboRef   = useRef(combo);   comboRef.current   = combo;
  const piecesRef  = useRef(piecesRemaining); piecesRef.current = piecesRemaining;
  const phaseRef   = useRef(phase);   phaseRef.current   = phase;
  const recentRef  = useRef(recentIndices); recentRef.current = recentIndices;
  const PIECES_LIMIT_ENABLED = false;

  // Haptics + sound
  const haptics    = useHaptics();
  const sound      = useSound();
  const hapticsRef = useRef(haptics); hapticsRef.current = haptics;
  const soundRef   = useRef(sound);   soundRef.current   = sound;
  const { showRewarded } = useRewardedAd();

  // ── Obstacle tooltip ────────────────────────────────────────────────────────
  useEffect(() => {
    if (level.obstacles.length > 0) {
      hasSeenObstacleTip().then(seen => { if (!seen) setShowObstacleTip(true); });
    }
  }, []);

  function dismissObstacleTip() {
    markObstacleTipSeen();
    setShowObstacleTip(false);
  }

  // ── Save on win ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "won") {
      saveHighestLevel(levelId);
      saveLevelStars(levelId, getStars(score, level));
    }
  }, [phase]);

  // ── Ghost preview ───────────────────────────────────────────────────────────
  const activePiece    = tray[selected];
  const ghostCells     = new Set<string>();
  const wouldClearRows = new Set<number>();
  const wouldClearCols = new Set<number>();

  // Always populate ghostCells so overlay shows piece even over occupied spots
  if (ghost && activePiece) {
    for (let r = 0; r < activePiece.shape.length; r++)
      for (let c = 0; c < activePiece.shape[r].length; c++)
        if (activePiece.shape[r][c]) ghostCells.add(`${ghost.row + r},${ghost.col + c}`);
    // Only compute would-clear hints when placement is actually valid
    if (ghostValid) {
      const sim = placePiece(grid, activePiece, ghost.row, ghost.col);
      for (let r = 0; r < 8; r++)
        if (sim[r].every((c, ci) => c !== null || obstacles[r][ci] !== null)) wouldClearRows.add(r);
      for (let c = 0; c < 8; c++)
        if (sim.every((row, ri) => row[c] !== null || obstacles[ri][c] !== null)) wouldClearCols.add(c);
    }
  }

  // ── Goal toast — brief "🎉 Goal Reached!" celebration ────────────────────────
  function showGoalToast() {
    setGoalToastVisible(true);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setGoalToastVisible(false));
  }

  // ── Drop ────────────────────────────────────────────────────────────────────

  const dropAt = useCallback((row: number, col: number, pieceOverride?: Piece, trayIdx?: number) => {
    if (phaseRef.current !== "playing") return;
    const curGrid = gridRef.current, curObs = obsRef.current;
    const curTray = trayRef.current, curSel = trayIdx ?? selRef.current;
    const piece   = pieceOverride ?? curTray[curSel];
    if (!piece || !canPlace(curGrid, piece, row, col, curObs)) return;

    const placed = placePiece(curGrid, piece, row, col);
    const { grid: cleared, obstacles: clearedObs, linesCleared, obstaclesHit, obstaclesDestroyed } =
      clearLines(placed, curObs);
    const result = calculateScore(
      scoreRef.current, comboRef.current,
      countCells(piece.shape), linesCleared,
      obstaclesHit, obstaclesDestroyed
    );

    // Update tray
    const newTray = [...curTray] as Tray;
    newTray[curSel] = null;
    const allUsed   = newTray.every(p => p === null);
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

    // Phase
    const newPieces = piecesRef.current - 1;
    let newPhase: GamePhase = "playing";
    // Win requires 3-star score AND all obstacles destroyed
    const obsLeft    = clearedObs.flat().filter(Boolean).length;
    const trueWin    = (s: number) => s >= level.star3Score && (level.obstacles.length === 0 || obsLeft === 0);

    // Check win FIRST — immediate level complete the moment all conditions are met
    // Player doesn't need to use remaining pieces
    if (trueWin(result.newScore)) {
      newPhase = "won";
    } else if (newPieces <= 0 && PIECES_LIMIT_ENABLED){
      newPhase = "failed";
    } else if (!hasAnyValidMove(cleared, finalTray, clearedObs)) {
      newPhase = "stuck";
    }

    // Toast fires when score FIRST crosses star3Score threshold
    const obsLeft2 = clearedObs.flat().filter(Boolean).length;
    if (
      result.newScore >= level.star3Score &&
      scoreRef.current < level.star3Score &&
      newPhase !== "won" // don't show toast if level already ended
    ) {
      showGoalToast();

      // Finish/Keep Going buttons only appear when no obstacles remain
      if (level.obstacles.length === 0 || obsLeft2 === 0) {
        setGoalReached(true);
        setGoalDismissed(false);
      }
    }

    // Flash cleared rows/cols
    if (linesCleared > 0) {
      const flashR = new Set<number>(), flashC = new Set<number>();
      for (let r = 0; r < 8; r++)
        if (placed[r].every((c, ci) => c !== null || curObs[r][ci] !== null)) flashR.add(r);
      for (let c = 0; c < 8; c++)
        if (placed.every((row, ri) => row[c] !== null || curObs[ri][c] !== null)) flashC.add(c);

      // Row flash uses the piece color (not white)
      const pColor = COLORS.pieces[piece.color]?.fill ?? COLORS.primary;
      flashColorRef.current = pColor; // sync update before re-render
      setFlashRows(flashR); setFlashCols(flashC);
      setTimeout(() => { setFlashRows(new Set()); setFlashCols(new Set()); }, 240);
      setLinesJustCleared(true);
      setTimeout(() => setLinesJustCleared(false), 600);

      // Grid glow — pulse on every clear
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 80,  useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]).start();

      // Combo float — show above cleared row when combo > 1 or multi-line
      if (result.newCombo > 1 || linesCleared > 1) {
        const firstRow = flashR.size > 0 ? Math.min(...flashR) : (flashC.size > 0 ? 3 : 3);
        const rowY = 8 + firstRow * CELL_STEP + CELL_SIZE / 2;
        const text = result.newCombo > 1
          ? `×${result.newCombo} COMBO 🔥`
          : `${linesCleared} LINES ✨`;
        setComboFloatText(text);
        setComboFloatRowY(rowY);
        comboFloatY.setValue(0);
        comboFloatOpacity.setValue(1);
        setComboFloatVisible(true);
        Animated.sequence([
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(comboFloatY,      { toValue: -50, duration: 600, useNativeDriver: true }),
            Animated.timing(comboFloatOpacity,{ toValue: 0,   duration: 600, useNativeDriver: true }),
          ]),
        ]).start(() => setComboFloatVisible(false));
      }
    }

    // Obstacle animations
    if (obstaclesHit > 0) {
      const hitSet = new Set<string>(), destroySet = new Set<string>();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const wasThere = curObs[r][c] !== null;
          const nowGone  = clearedObs[r][c] === null;
          if (wasThere && nowGone) destroySet.add(`${r},${c}`);
          else if (wasThere && !nowGone && clearedObs[r][c]!.durability < curObs[r][c]!.durability)
            hitSet.add(`${r},${c}`);
        }
      }
      if (hitSet.size > 0) { setHitObstacles(hitSet); setTimeout(() => setHitObstacles(new Set()), 350); }
      if (destroySet.size > 0) { setDestroyedObstacles(destroySet); setTimeout(() => setDestroyedObstacles(new Set()), 500); }
    }

    // Obstacle bonus pop
    if (result.obstaclePoints > 0) {
      if (obsPopTimer.current) clearTimeout(obsPopTimer.current);
      const text = obstaclesDestroyed > 0
        ? `${obstaclesDestroyed > 1 ? obstaclesDestroyed + "x " : ""}SMASHED! +${result.obstaclePoints}`
        : `Block hit! +${result.obstaclePoints}`;
      setObstaclePop(text);
      obsPopTimer.current = setTimeout(() => setObstaclePop(null), 1100);
    }

    // Commit state
    setGrid(cleared); setObstacles(clearedObs); setTray(finalTray);
    setSelected(nextSel); setScore(result.newScore); setCombo(result.newCombo);
    setPiecesRemaining(newPieces); setPhase(newPhase);
    setRecentIndices(newRecent); setPiecesPlaced(p => p + 1);
    setGhost(null); setGhostValid(false);

    // Haptics + sound
    if (linesCleared > 0) {
      hapticsRef.current.lineCleared();
      soundRef.current.playClear();
      if (result.newCombo > 1) { hapticsRef.current.comboAchieved(); soundRef.current.playCombo(); }
    } else {
      hapticsRef.current.piecePlaced();
      soundRef.current.playPlace();
    }
    if (newPhase === "won") { hapticsRef.current.levelComplete(); soundRef.current.playWin(); }
    else if (newPhase === "failed" || newPhase === "stuck") { hapticsRef.current.levelFailed(); soundRef.current.playFail(); }
  }, [level]);

  // ── Pan responders ──────────────────────────────────────────────────────────

  const panResponders = useRef([0, 1, 2].map(idx =>
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,

      onPanResponderGrant: (e) => {
        if (phaseRef.current !== "playing") return;
        setSelected(idx); setIsDragging(true);
        hapticsRef.current.piecePicked();

      },
      onPanResponderMove: (e) => {
        if (phaseRef.current !== "playing") return;
        const piece = trayRef.current[idx];
        if (!piece) return;
        // no floating shadow — ghost shows in grid only
        if (!gridOrigin.current) return;
        const { row, col } = fingerToCell(e.nativeEvent.pageX, e.nativeEvent.pageY - LIFT, gridOrigin.current, piece);
        const c = clamp(row, col, piece);
        setGhost(c);
        setGhostValid(canPlace(gridRef.current, piece, c.row, c.col, obsRef.current));
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

  // ── Tap to place ────────────────────────────────────────────────────────────

  function handleCellTap(row: number, col: number) {
    if (!activePiece || phase !== "playing" || isDragging) return;
    const c = clamp(
      row - Math.floor(activePiece.shape.length / 2),
      col - Math.floor(activePiece.shape[0].length / 2),
      activePiece
    );
    dropAt(c.row, c.col);
  }

  // ── Restart ─────────────────────────────────────────────────────────────────

  function restart() {
    const g = createGrid(), o = createObstacleGrid(level.obstacles);
    setGrid(g); setObstacles(o);
    setTray(drawWeightedTray([], g, o) as Tray);
    setSelected(0); setScore(0); setCombo(0);
    setPiecesRemaining(level.pieceCount); setPhase("playing");
    setPiecesPlaced(0); setLinesJustCleared(false);
    setGoalReached(false); setGoalDismissed(false); setGoalToastVisible(false);
    setGhost(null); setGhostValid(false); setIsDragging(false); setRecentIndices([]);
    setFlashRows(new Set()); setFlashCols(new Set());
    setHitObstacles(new Set()); setDestroyedObstacles(new Set());
    setObstaclePop(null);
  }

  // ── Back with confirmation ───────────────────────────────────────────────────

  function handleBack() {
    if (phase !== "playing" || piecesPlaced === 0) { router.back(); return; }
    Alert.alert(
      "Leave level?",
      "Your current progress will be lost.",
      [
        { text: "Keep Playing", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]
    );
  }

  const obsRemaining = obstacles.flat().filter(Boolean).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View
      style={styles.container}
      onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
        containerOrigin.current = { x: px, y: py };
      })}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerSide}>
        <Image source={require("../../assets/icons/arrow-left.png")} style={styles.backArrow} />
        <Text style={styles.back}>Levels</Text>
      </TouchableOpacity>

        {/* Logo — centered in header */}
        <View style={styles.headerCenter}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.headerSide}>
          {combo > 1 && (
            <View style={styles.comboBadge}>
              <Text style={styles.comboText}>🔥 ×{combo}</Text>
            </View>
          )}
          {/* {level.obstacles.length > 0 && (
            <Text style={styles.obsRemaining}>🧱 {obsRemaining}</Text>
          )} */}
        </View>
      </View>

      {/* Score bar */}
      <ScoreBar score={score} level={level} linesJustCleared={linesJustCleared} obsRemaining={obsRemaining} />

      {/* Obstacle bonus pop — absolutely positioned so it doesn't shift layout */}
      {obstaclePop && (
        <View style={styles.obstaclePopBanner} pointerEvents="none">
          <Text style={styles.obstaclePopText}>{obstaclePop}</Text>
        </View>
      )}

      {/* Grid */}
      {/* Grid wrapper holds real grid + placement overlay */}
      <View style={styles.gridWrapper}>

      {/* ── Glow effect — animated border on line clear ── */}
      <Animated.View style={[styles.gridGlow, {
        opacity: glowAnim,
        borderColor: flashColorRef.current,
        shadowColor: flashColorRef.current,
      }]} pointerEvents="none" />

      {/* ── Combo float — appears at cleared row ── */}
      {comboFloatVisible && (
        <Animated.View
          style={[styles.comboFloat, {
            top: comboFloatRowY - 20,
            opacity: comboFloatOpacity,
            transform: [{ translateY: comboFloatY }],
          }]}
          pointerEvents="none"
        >
          <Text style={styles.comboFloatText}>{comboFloatText}</Text>
        </Animated.View>
      )}

      {/* ── Real grid ── */}
      <View
        style={styles.gridContainer}
        onLayout={e => e.target.measure((_x, _y, _w, _h, px, py) => {
          gridOrigin.current = { x: px + 8, y: py + 8 };
        })}
      >
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => {
              const key         = `${r},${c}`;

              const willClear   = wouldClearRows.has(r) || wouldClearCols.has(c);
              const isFlashing  = flashRows.has(r) || flashCols.has(c);
              const obs         = obstacles[r][c];
              const isHit       = hitObstacles.has(key);
              const isDestroyed = destroyedObstacles.has(key);
              const color       = cell !== null ? COLORS.pieces[cell] : null;


              // Obstacle cell — full opacity image, only number changes
              if (obs !== null) {
                return (
                  <ImageBackground
                    key={c}
                    source={obstacleImage(obs.maxDurability)}
                    style={[
                      styles.cell,
                      { overflow: "hidden" },
                      willClear && { borderWidth: 2, borderColor: COLORS.accent },
                    ]}
                    imageStyle={{ resizeMode: "cover" }}
                  >
                    {/* Durability number — the only thing that changes */}
                    <View style={styles.obstacleNumOverlay}>
                      <Text style={[styles.obstacleNumText, { fontSize: CELL_SIZE > 38 ? 11 : 9 }]}>
                        {obs.durability}
                      </Text>
                    </View>
                  </ImageBackground>
                );
              }

              // Destroyed burst
              if (isDestroyed) {
                return (
                  <View key={c} style={[styles.cell, styles.destroyBurst]}>
                    <Text style={{ fontSize: CELL_SIZE * 0.5 }}>💥</Text>
                  </View>
                );
              }

              // Normal cell
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.8}
                  onPress={() => handleCellTap(r, c)}
                  style={[
                    styles.cell,
                    cell !== null && { backgroundColor: color!.fill, shadowColor: color!.fill, shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
                    isFlashing && cell !== null && { backgroundColor: flashColorRef.current, opacity: 1 },
                    isFlashing && cell === null && { backgroundColor: flashColorRef.current, opacity: 0.55 },

                    !isFlashing && willClear && cell === null && { backgroundColor: COLORS.accent, opacity: 0.18 },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* ── Placement overlay — pixel-perfect on top of real grid ── */}
      {isDragging && ghost && activePiece && (
        <View style={styles.placementOverlay} pointerEvents="none">
          {Array.from({ length: 8 }, (_, r) => (
            <View key={r} style={styles.row}>
              {Array.from({ length: 8 }, (_, c) => {
                const isGhost = ghostCells.has(`${r},${c}`);
                const gc      = COLORS.pieces[activePiece.color];

                // Valid placement — piece color with border
                if (isGhost && ghostValid) {
                  return (
                    <View key={c} style={[
                      styles.overlayCell,
                      { backgroundColor: gc.fill, opacity: 1, borderWidth: 2, borderColor: gc.fill },
                    ]} />
                  );
                }

                // Invalid placement — piece color background + block.png overlay
                if (isGhost && !ghostValid) {
                  return (
                    <View key={c} style={[
                      styles.overlayCell,
                      { backgroundColor: gc.fill, borderWidth: 2, borderColor: "#050d38" },
                    ]}>
                      <Image
                        source={require("../../assets/pieces/block.png")}
                        style={styles.blockOverlay}
                        resizeMode="cover"
                      />
                    </View>
                  );
                }

                // Empty overlay cell
                return <View key={c} style={styles.overlayCell} />;
              })}
            </View>
          ))}
        </View>
      )}

      </View>{/* end gridWrapper */}

      {/* Hint */}
      <Text style={styles.hint}>
        {isDragging
          ? "Release to place"
          : level.obstacles.length > 0
            ? "Fill rows with obstacles to chip them away"
            : "Drag a piece · or select then tap grid"}
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
            <View
              key={i}
              style={[styles.traySlot, selected === i && styles.traySlotSelected]}
              {...panResponders[i].panHandlers}
            >
              <MiniPiece piece={piece} />
            </View>
          )
        )}
      </View>



      {/* Goal reached banner — appears below tray, stays out of the way */}
      {goalReached && !goalDismissed && phase === "playing" && obsRemaining === 0 && score >= level.star3Score && (
        <View style={styles.goalBanner}>
          <Text style={styles.goalBannerTitle}>🎉 Goal reached!</Text>
          <View style={styles.goalBtnRow}>
            <TouchableOpacity
              style={styles.goalBtnFinish}
              onPress={() => setPhase("won")}
            >
              <Text style={styles.goalBtnFinishText}>🏆  Finish Level</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goalBtnKeep}
              onPress={() => setGoalDismissed(true)}
            >
              <Text style={styles.goalBtnKeepText}>▶  Keep Going</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}



      {/* Goal reached toast — brief auto-dismissing celebration */}
      {goalToastVisible && (
        <Animated.View style={[styles.goalToast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.goalToastEmoji}>🎉</Text>
          <Text style={styles.goalToastTitle}>Goal Reached!</Text>
          {obsRemaining > 0 && (
           <View style={styles.goalToastSubRow}>
            <Text style={styles.goalToastSub}>Now destroy the {obsRemaining} </Text>
            <ObstacleIcon durability={Math.max(...level.obstacles.map((o: any) => o.durability))} size={14} />
            <Text style={styles.goalToastSub}> to win!</Text>
          </View>
          )}
        </Animated.View>
      )}

      {/* Obstacle tutorial tooltip */}
      {showObstacleTip && (
        <TouchableOpacity
          style={tipS.overlay}
          activeOpacity={1}
          onPress={dismissObstacleTip}
        >
          <View style={tipS.card}>
            <View style={tipS.emojiRow}>
              <Image source={require("../../assets/pieces/wood.png")}  style={tipS.emojiImg} />
              <Image source={require("../../assets/pieces/stone.png")} style={tipS.emojiImg} />
              <Image source={require("../../assets/pieces/bomb.png")}  style={tipS.emojiImg} />
            </View>
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

      {/* Results */}


      {phase !== "playing" && (
        <ResultsScreen
          phase={phase}
          score={score}
          level={level}
          onReplay={restart}
          onNext={() => router.replace(`/level/${levelId + 1}`)}
          onHome={() => router.back()}
          onWatchAd={() => {
            // Show real rewarded ad — reward granted even if ad unavailable
            showRewarded(() => {
              const freshTray = drawWeightedTray([], gridRef.current, obsRef.current) as Tray;
              setTray(freshTray);
              setPiecesRemaining(p => p + 3);
              setCombo(0);
              setPhase("playing");
            });
          }}
        />
      )}
      {/* Banner ad — absolute bottom, always visible */}
      {BannerAd && BannerAdSize && (
        <View style={styles.bannerWrapper}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          />
        </View>
      )}
    </View>
  );
}
// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backArrow: { width: 22, height: 16, resizeMode: "contain" },
  goalToastSubRow: { flexDirection: "row", alignItems: "center" },
  container: {
    flex: 1, backgroundColor: COLORS.background,
    paddingTop: 52, paddingHorizontal: 16, alignItems: "center",
  },
  header: {
    flexDirection: "row", alignItems: "center",
    width: "100%", height: 52, marginBottom: 4,
  },
  headerSide: {
    width: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: {
    height: 36,
    width: 120,
  },
  back: { ...TEXT.nav, color: COLORS.textDim, fontSize: 16 },
  comboBadge: {
    backgroundColor: "rgba(255,217,61,0.12)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.accent,
  },
  comboText: { ...TEXT.badge, color: COLORS.accent, fontSize: 13 },
  obsRemaining: { ...TEXT.badge, marginLeft: "auto", color: COLORS.accent, fontSize: 13 },
  obstaclePopBanner: {
    position: "absolute" as any, top: "42%" as any,
    left: 32, right: 32, zIndex: 50,
    backgroundColor: "rgba(100,55,10,0.96)",
    borderRadius: 18, paddingHorizontal: 20, paddingVertical: 14,
    borderWidth: 1, borderColor: "rgba(200,140,60,0.4)", alignItems: "center",
  },
  obstaclePopText: { ...TEXT.badge, color: COLORS.accent, fontSize: 14, textAlign: "center" },
  gridWrapper:  { position: "relative" as any },
  bannerWrapper: {
    position: "absolute" as any,
    bottom: 0, left: 0, right: 0,
    alignItems: "center", zIndex: 10,
  },
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
    ...TEXT.button,
    color: COLORS.text, fontSize: 22, fontWeight: "bold", letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  gridContainer: {
    backgroundColor: COLORS.gridBg, borderRadius: 14, padding: 8, gap: GAP,
  },
  row: { flexDirection: "row", gap: GAP },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_R,
    backgroundColor: COLORS.cellEmpty,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  obstacleDmgOverlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#000000",
  },
  obstacleNumOverlay: {
    position: "absolute" as any, bottom: 2, right: 3,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 4,
    paddingHorizontal: 3, paddingVertical: 1, minWidth: 14, alignItems: "center",
  },
  obstacleNumText: { color: COLORS.accent, fontWeight: "bold", lineHeight: 13 },
  crackOverlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 2, borderColor: "rgba(255,80,0,0.7)",
    borderRadius: CELL_R, borderStyle: "dashed",
  },
  destroyBurst: {
    backgroundColor: "rgba(255,180,0,0.3)",
    borderWidth: 1, borderColor: "rgba(255,180,0,0.5)",
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
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: CELL_R,
    opacity: 0.85,
  },
  hint: { ...TEXT.hint, color: COLORS.textDim, fontSize: 11, marginTop: 8, marginBottom: 4 },
  tray: {
    flexDirection: "row", gap: 10, marginTop: 8,
    backgroundColor: COLORS.gridBg,
    borderRadius: 18, padding: 12, alignItems: "center", justifyContent: "center",
  },
  traySlot: {
    padding: 10, borderRadius: 12, borderWidth: 2, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
    minWidth: 72, minHeight: 56, backgroundColor: "rgba(255,255,255,0.04)",
  },
  traySlotSelected: {
    borderColor: COLORS.primary, backgroundColor: "rgba(78,205,196,0.1)",
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
  pieceCountRow: { marginTop: 6, alignItems: "center" },
  pieceCountText: { color: COLORS.textDim, fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  goalToast: {
    position: "absolute" as any,
    top: "30%" as any,
    left: 32, right: 32,
    zIndex: 60,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  goalToastEmoji:  { fontSize: 36 },
  goalToastTitle: {
    color: COLORS.background,
    fontSize: 22, fontWeight: "bold", letterSpacing: 0.5,
  },
  goalToastSub: {
    color: "rgba(15,27,53,0.7)",
    fontSize: 13, textAlign: "center",
  },
  goalBanner: {
    marginTop: 8, width: "100%",
    backgroundColor: "rgba(8,175,247,0.08)",
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 8,
  },
  goalBannerTitle: { ...TEXT.label, color: COLORS.primary, fontSize: 13 },
  goalBtnRow:     { flexDirection: "row", gap: 8, width: "100%" },
  goalBtnFinish: {
    flex: 1, backgroundColor: COLORS.primary,
    borderRadius: 10, paddingVertical: 7, alignItems: "center",
  },
  goalBtnFinishText: { ...TEXT.button, color: COLORS.background, fontSize: 12 },
  goalBtnKeep: {
    flex: 1, backgroundColor: "rgba(78,205,196,0.1)",
    borderRadius: 10, paddingVertical: 7, alignItems: "center",
    borderWidth: 1, borderColor: COLORS.primary,
  },
  goalBtnKeepText: { ...TEXT.button, color: COLORS.primary, fontSize: 12 },
});