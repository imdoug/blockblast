// app/index.tsx

import { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { COLORS } from "../src/constants/theme";
import {
  loadHighestLevel, loadTodaysDailyResult, updateAndLoadStreak,
} from "../src/store/storage";

export default function HomeScreen() {
  const [highestLevel, setHighestLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyDone, setDailyDone] = useState(false);

  useFocusEffect(useCallback(() => {
    async function load() {
      const [level, s, daily] = await Promise.all([
        loadHighestLevel(), updateAndLoadStreak(), loadTodaysDailyResult(),
      ]);
      setHighestLevel(level); setStreak(s); setDailyDone(daily !== null);
    }
    load();
  }, []));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>BLOCKBLAST</Text>
      <Text style={styles.subtitle}>Block puzzle · clear lines · score big</Text>
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
      <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push(`/level/${highestLevel}`)}>
        <Text style={styles.btnPrimaryText}>▶  Play Level {highestLevel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push("/campaign")}>
        <Text style={styles.btnSecondaryText}>☰  All Levels</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnGhost} onPress={() => router.push("/game")}>
        <Text style={styles.btnGhostText}>∞  Classic Mode</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  title: { fontSize: 44, fontWeight: "bold", color: COLORS.primary, letterSpacing: 4, marginBottom: 2 },
  subtitle: { color: COLORS.textDim, fontSize: 13, marginBottom: 4 },
  streakRow: { backgroundColor: "rgba(255,107,107,0.1)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,107,107,0.25)" },
  streakText: { color: "#FF6B6B", fontSize: 14, fontWeight: "bold" },
  btnDaily: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(78,205,196,0.1)", borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, width: "100%", borderWidth: 1.5, borderColor: COLORS.primary, marginBottom: 4 },
  btnDailyDone: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" },
  btnDailyIcon: { fontSize: 28 },
  btnDailyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "bold" },
  btnDailySubtitle: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 40, paddingVertical: 15, width: "100%", alignItems: "center" },
  btnPrimaryText: { color: COLORS.background, fontSize: 17, fontWeight: "bold" },
  btnSecondary: { backgroundColor: "rgba(78,205,196,0.08)", borderRadius: 16, paddingHorizontal: 40, paddingVertical: 13, width: "100%", alignItems: "center", borderWidth: 1.5, borderColor: COLORS.primary },
  btnSecondaryText: { color: COLORS.primary, fontSize: 15, fontWeight: "bold" },
  btnGhost: { borderRadius: 16, paddingHorizontal: 40, paddingVertical: 10, width: "100%", alignItems: "center" },
  btnGhostText: { color: COLORS.textDim, fontSize: 14 },
});