// app/campaign.tsx
//
// Level select screen. Shows all 99 levels as a scrollable grid.
// Each tile shows: level number, stars earned, lock state.
// A level is unlocked when its ID <= highestUnlockedLevel.

import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { COLORS } from "../src/constants/theme";
import { LEVELS } from "../src/game/levels";
import { loadHighestLevel, loadAllStars } from "../src/store/storage";

const SCREEN_W = Dimensions.get("window").width;
const COLS = 5;
const TILE_GAP = 10;
const TILE_SIZE = Math.floor((SCREEN_W - 32 - TILE_GAP * (COLS - 1)) / COLS);

// ─── Level Tile ───────────────────────────────────────────────────────────────

function LevelTile({
  levelId,
  stars,
  isLocked,
  isCurrent,
  onPress,
}: {
  levelId: number;
  stars: number;
  isLocked: boolean;
  isCurrent: boolean;
  onPress: () => void;
}) {
  const isCompleted = stars > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLocked}
      activeOpacity={0.75}
      style={[
        tileStyles.tile,
        isCompleted && tileStyles.tileCompleted,
        isCurrent && tileStyles.tileCurrent,
        isLocked && tileStyles.tileLocked,
      ]}
    >
      {isLocked ? (
        <Text style={tileStyles.lockIcon}>🔒</Text>
      ) : (
        <>
          <Text style={[tileStyles.levelNum, isLocked && tileStyles.levelNumLocked]}>
            {levelId}
          </Text>
          {/* Stars row */}
          <View style={tileStyles.starsRow}>
            {[1, 2, 3].map((s) => (
              <Text
                key={s}
                style={[tileStyles.star, s > stars && tileStyles.starEmpty]}
              >
                ★
              </Text>
            ))}
          </View>
        </>
      )}

      {/* "PLAY" badge on current level */}
      {isCurrent && !isLocked && (
        <View style={tileStyles.playBadge}>
          <Text style={tileStyles.playBadgeText}>▶</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: 4,
  },
  tileCompleted: {
    backgroundColor: "rgba(78,205,196,0.1)",
    borderColor: "rgba(78,205,196,0.25)",
  },
  tileCurrent: {
    backgroundColor: "rgba(78,205,196,0.18)",
    borderColor: COLORS.primary,
  },
  tileLocked: {
    backgroundColor: "rgba(255,255,255,0.02)",
    opacity: 0.45,
  },
  lockIcon: { fontSize: 16 },
  levelNum: {
    color: COLORS.text,
    fontSize: TILE_SIZE > 60 ? 16 : 14,
    fontWeight: "bold",
  },
  levelNumLocked: { color: COLORS.textDim },
  starsRow: { flexDirection: "row", gap: 1 },
  star: { fontSize: 9, color: COLORS.accent },
  starEmpty: { color: "rgba(255,255,255,0.15)" },
  playBadge: {
    position: "absolute",
    top: 4,
    right: 6,
  },
  playBadgeText: { fontSize: 8, color: COLORS.primary },
});

// ─── Campaign Screen ──────────────────────────────────────────────────────────

export default function CampaignScreen() {
  const [highestLevel, setHighestLevel] = useState(1);
  const [allStars, setAllStars] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // useFocusEffect reloads data every time the screen comes into focus.
  // This is important: when the player finishes a level and comes back,
  // the campaign screen needs to reflect newly earned stars and unlocks.
  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [highest, stars] = await Promise.all([
          loadHighestLevel(),
          loadAllStars(),
        ]);
        setHighestLevel(highest);
        setAllStars(stars);
        setIsLoading(false);
      }
      load();
    }, [])
  );

  // Group levels into rows of COLS for the grid
  const rows: number[][] = [];
  for (let i = 0; i < LEVELS.length; i += COLS) {
    rows.push(LEVELS.slice(i, i + COLS).map((l) => l.id));
  }

  // Total star count for the header
  const totalStars = Object.values(allStars).reduce((sum, s) => sum + s, 0);
  const maxStars = LEVELS.length * 3;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Campaign</Text>
        <View style={styles.starSummary}>
          <Text style={styles.starSummaryText}>⭐ {totalStars}</Text>
          <Text style={styles.starSummaryMax}>/{maxStars}</Text>
        </View>
      </View>

      {/* Progress summary bar */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Level {Math.min(highestLevel, 99)} of 99
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(Math.min(highestLevel - 1, 99) / 99) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Level grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((levelId) => {
                const isLocked = levelId > highestLevel;
                const isCurrent = levelId === highestLevel;
                const stars = allStars[levelId] ?? 0;
                return (
                  <LevelTile
                    key={levelId}
                    levelId={levelId}
                    stars={stars}
                    isLocked={isLocked}
                    isCurrent={isCurrent}
                    onPress={() => router.push(`/level/${levelId}`)}
                  />
                );
              })}
              {/* Fill empty slots in last row */}
              {row.length < COLS &&
                Array.from({ length: COLS - row.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={{ width: TILE_SIZE }} />
                ))}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 56,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  back: { color: COLORS.textDim, fontSize: 16 },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
  },
  starSummary: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  starSummaryText: { color: COLORS.accent, fontSize: 16, fontWeight: "bold" },
  starSummaryMax: { color: COLORS.textDim, fontSize: 12 },
  progressRow: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 6,
  },
  progressText: {
    color: COLORS.textDim,
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  grid: {
    paddingHorizontal: 16,
    gap: TILE_GAP,
  },
  row: {
    flexDirection: "row",
    gap: TILE_GAP,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: COLORS.textDim, fontSize: 16 },
});