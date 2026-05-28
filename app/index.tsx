// app/index.tsx

import { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { COLORS } from "../src/constants/theme";
import {
  loadHighestLevel, loadTodaysDailyResult, updateAndLoadStreak,
  loadClassicBest, loadAllStars, hasSeenOnboarding,
} from "../src/store/storage";

export default function HomeScreen() {
  const [highestLevel, setHighestLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyDone, setDailyDone] = useState(false);
  const [classicBest, setClassicBest] = useState(0);
  const [totalStars, setTotalStars] = useState(0);

  useFocusEffect(useCallback(() => {
    async function load() {
      const [level, s, daily, best, stars, onboarded] = await Promise.all([
        loadHighestLevel(), updateAndLoadStreak(), loadTodaysDailyResult(),
        loadClassicBest(), loadAllStars(), hasSeenOnboarding(),
      ]);
      setHighestLevel(level);
      setStreak(s);
      setDailyDone(daily !== null);
      setClassicBest(best);
      setTotalStars(Object.values(stars).reduce((sum, s) => sum + s, 0));

      // Redirect to onboarding on very first launch
      if (!onboarded) {
        router.replace("/onboarding");
      }
    }
    load();
  }, []));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Settings button — absolutely positioned top right */}
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => router.push("/settings")}
        activeOpacity={0.7}
      >
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>

      <Text style={styles.title}>BLOXBURST</Text>
      <Text style={styles.subtitle}>Block puzzle · clear lines · score big</Text>

      {/* Stats row — personal best + total stars */}
      {(classicBest > 0 || totalStars > 0) && (
        <View style={styles.statsRow}>
          {classicBest > 0 && (
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>🏆</Text>
              <View>
                <Text style={styles.statValue}>{classicBest.toLocaleString()}</Text>
                <Text style={styles.statLabel}>classic best</Text>
              </View>
            </View>
          )}
          {totalStars > 0 && (
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>⭐</Text>
              <View>
                <Text style={styles.statValue}>{totalStars} / 297</Text>
                <Text style={styles.statLabel}>stars earned</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>🔥 {streak} day streak</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btnDaily, dailyDone && styles.btnDailyDone]}
        onPress={() => router.push("/daily")}
      >
        <Text style={styles.btnDailyIcon}>{dailyDone ? "✅" : "📅"}</Text>
        <View>
          <Text style={styles.btnDailyTitle}>{dailyDone ? "Daily Done!" : "Daily Challenge"}</Text>
          <Text style={styles.btnDailySubtitle}>
            {dailyDone ? "Come back tomorrow" : "Today's puzzle · everyone plays the same"}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => router.push(`/level/${highestLevel}`)}
      >
        <Text style={styles.btnPrimaryText}>▶  Play Level {highestLevel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnSecondary}
        onPress={() => router.push("/campaign")}
      >
        <Text style={styles.btnSecondaryText}>☰  All Levels</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnGhost}
        onPress={() => router.push("/game")}
      >
        <Text style={styles.btnGhostText}>∞  Classic Mode</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnRush}
        onPress={() => router.push("/rush")}
      >
        <Text style={styles.btnRushText}>⚡  Rush Mode</Text>
        <Text style={styles.btnRushSub}>Numbers decay — race to clear!</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  statIcon: { fontSize: 20 },
  statValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
    lineHeight: 18,
  },
  statLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  settingsBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 99,
  },
  settingsIcon: { fontSize: 20 },
  title: {
    fontSize: 44, fontWeight: "bold",
    color: COLORS.primary, letterSpacing: 4, marginBottom: 2,
  },
  subtitle: { color: COLORS.textDim, fontSize: 13, marginBottom: 4 },
  streakRow: {
    backgroundColor: "rgba(255,107,107,0.1)",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,107,107,0.25)",
  },
  streakText: { color: "#FF6B6B", fontSize: 14, fontWeight: "bold" },
  btnDaily: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(78,205,196,0.1)",
    borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16,
    width: "100%", borderWidth: 1.5, borderColor: COLORS.primary, marginBottom: 4,
  },
  btnDailyDone: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  btnDailyIcon: { fontSize: 28 },
  btnDailyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "bold" },
  btnDailySubtitle: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  btnPrimary: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingHorizontal: 40, paddingVertical: 15,
    width: "100%", alignItems: "center",
  },
  btnPrimaryText: { color: COLORS.background, fontSize: 17, fontWeight: "bold" },
  btnSecondary: {
    backgroundColor: "rgba(78,205,196,0.08)", borderRadius: 16,
    paddingHorizontal: 40, paddingVertical: 13,
    width: "100%", alignItems: "center",
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  btnSecondaryText: { color: COLORS.primary, fontSize: 15, fontWeight: "bold" },
  btnGhost: {
    borderRadius: 16, paddingHorizontal: 40, paddingVertical: 10,
    width: "100%", alignItems: "center",
  },
  btnGhostText: { color: COLORS.textDim, fontSize: 14 },
  btnRush: {
    backgroundColor: "rgba(255,230,109,0.08)", borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 13,
    width: "100%", alignItems: "center",
    borderWidth: 1.5, borderColor: COLORS.accent,
  },
  btnRushText: { color: COLORS.accent, fontSize: 16, fontWeight: "bold" },
  btnRushSub: { color: COLORS.textDim, fontSize: 11, marginTop: 2 },
});