// app/index.tsx

import { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { useFonts } from "expo-font";
import { LuckiestGuy_400Regular } from "@expo-google-fonts/luckiest-guy";
import { FredokaOne_400Regular } from "@expo-google-fonts/fredoka-one";
import { COLORS } from "../src/constants/theme";
import {
  loadHighestLevel, loadTodaysDailyResult, updateAndLoadStreak,
  loadClassicBest, loadRushBest, loadAllStars, hasSeenOnboarding,
} from "../src/store/storage";

// ── Icons only (no more BTN_* background images) ──────────────────────────────
const ICON_ALL_LEVELS  = require("../assets/icons/Icon_AllLevels.png");
const ICON_CHALLENGE   = require("../assets/icons/icon_Challenge.png");
const ICON_CLASSIC     = require("../assets/icons/icon_Classic.png");
const ICON_PLAY        = require("../assets/icons/icon_Play.png");
const ICON_RUSH        = require("../assets/icons/icon_Rush.png");
const ICON_STARS       = require("../assets/icons/icon_Stars.png");
const ICON_STREAK      = require("../assets/icons/icon_Streak.png");
const ICON_TROPHY      = require("../assets/icons/icon_Trophy.png");

const BTN_SETTINGS = require("../assets/buttons/Button_setting.png");

export default function HomeScreen() {
  const [highestLevel, setHighestLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyDone, setDailyDone] = useState(false);
  const [classicBest, setClassicBest] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [rushBest, setRushBest] = useState(0);

  const [fontsLoaded] = useFonts({
    LuckiestGuy_400Regular,
    FredokaOne_400Regular,
  });

  useFocusEffect(useCallback(() => {
    async function load() {
      const [level, s, daily, classic, rush, stars, onboarded] = await Promise.all([
        loadHighestLevel(),
        updateAndLoadStreak(),
        loadTodaysDailyResult(),
        loadClassicBest(),
        loadRushBest(),
        loadAllStars(),
        hasSeenOnboarding(),
      ]);

      setHighestLevel(level);
      setStreak(s);
      setDailyDone(daily !== null);
      setClassicBest(classic);
      setRushBest(rush);
      setTotalStars(Object.values(stars).reduce((sum, s) => sum + s, 0));

      if (!onboarded) router.replace("/onboarding");
    }
    load();
  }, []));

  if (!fontsLoaded) return null;

  return (
    <ImageBackground
      source={require("../assets/images/homescreen.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar style="light" />

      {/* Settings */}
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => router.push("/settings")}
        activeOpacity={0.7}
      >
        <Image source={BTN_SETTINGS} style={styles.settingsIcon} resizeMode="contain" />
      </TouchableOpacity>

      {/* ── Stats row ── */}
      {(classicBest > 0 || rushBest > 0 || totalStars > 0) && (
  <View style={styles.statsRow}>
    {/* Trophy / Classic Best */}
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.statCard, { borderColor: "#FFE600" }]}
    >
      <Image source={ICON_TROPHY} style={styles.statIcon} resizeMode="contain" />
      <View style={styles.statTextArea}>
        <Text style={[styles.statValue, { color: "#FFE600" }]} numberOfLines={1}>
          {classicBest > 0 ? classicBest.toLocaleString() : "0"}
        </Text>
        <Text style={[styles.statLabel, { color: "#ffe600" }]}>classic</Text>
      </View>
    </TouchableOpacity>

    {/* Stars */}
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.statCard, { borderColor: "#FFE600" }]}
    >
      <Image source={ICON_STARS} style={styles.statIcon} resizeMode="contain" />
      <View style={styles.statTextArea}>
        <Text style={[styles.statValue, { color: "#FFE600" }]} numberOfLines={1}>
          {totalStars}
        </Text>
        <Text style={[styles.statLabel, { color: "#FFE600" }]}>stars</Text>
      </View>
    </TouchableOpacity>

    {/* Rush Best */}
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.statCard, { borderColor: "#FFE600" }]}
    >
      <Image source={ICON_STARS} style={styles.statIcon} resizeMode="contain" />
      <View style={styles.statTextArea}>
        <Text style={[styles.statValue, { color: "#FFE600" }]} numberOfLines={1}>
          {rushBest > 0 ? rushBest.toLocaleString() : "0"}
        </Text>
        <Text style={[styles.statLabel, { color: "#FFE600" }]}>rush</Text>
      </View>
    </TouchableOpacity>
  </View>
)}

      {/* ── Streak ── */}
      {streak > 0 && (
        <View style={[styles.streakCard, { borderColor: "#FF7C30" }]}>
          <Image source={ICON_STREAK} style={styles.streakIcon} resizeMode="contain" />
          <Text style={styles.streakText}>{streak} day streak </Text>
        </View>
      )}

      {/* ── Daily Challenge ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.mainBtnDaily, { borderColor: "#f40c54" }]}
        onPress={() => router.push("/daily")}
      >
        <Image source={ICON_CHALLENGE} style={styles.mainBtnIconDaily} resizeMode="contain" />
        <View style={styles.mainBtnText}>
          <Text style={[styles.mainBtnTitle, { color: "#f40c54" }]} numberOfLines={1}>
            {dailyDone ? "DAILY DONE!" : "DAILY CHALLENGE"}
          </Text>
          <Text style={[styles.mainBtnSub, { color: "#c06080" }]} numberOfLines={1}>
            {dailyDone ? "Come back tomorrow" : "Today's puzzle awaits!"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── Play Level ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.mainBtnPlay, { borderColor: "#0aaff8" }]}
        onPress={() => router.push(`/level/${highestLevel}`)}
      >
        <Image source={ICON_PLAY} style={styles.mainBtnIconPlay} resizeMode="contain" />
        <View style={styles.mainBtnText}>
          <Text style={[styles.mainBtnTitle, { color: "#0aaff8", fontSize: 28 }]} numberOfLines={1}>
            PLAY LEVEL {highestLevel}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── All Levels ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.allLevelsBtn, { borderColor: "#0aaff8" }]}
        onPress={() => router.push("/campaign")}
      >
        <Image source={ICON_ALL_LEVELS} style={styles.allLevelsIcon} resizeMode="contain" />
        <Text style={[styles.allLevelsTitle, { color: "#0aaff8" }]} numberOfLines={1}>
          ALL LEVELS
        </Text>
      </TouchableOpacity>

      {/* ── Classic Mode ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.mainBtnClassic, { borderColor: "#19db6c" }]}
        onPress={() => router.push("/game")}
      >
        <Image source={ICON_CLASSIC} style={styles.mainBtnIconClassic} resizeMode="contain" />
        <View style={styles.mainBtnText}>
          <Text style={[styles.mainBtnTitle, { color: "#19db6c" }]} numberOfLines={1}>
            CLASSIC MODE
          </Text>
          <Text style={[styles.mainBtnSub, { color: "#2a9c54" }]} numberOfLines={1}>
            Numbers decay – race to clear!
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── Rush Mode ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.mainBtnRush, { borderColor: "#feca19" }]}
        onPress={() => router.push("/rush")}
      >
        <Image source={ICON_RUSH} style={styles.mainBtnIconRush} resizeMode="contain" />
        <View style={styles.mainBtnText}>
          <Text style={[styles.mainBtnTitle, { color: "#feca19" }]} numberOfLines={1}>
            RUSH MODE
          </Text>
          <Text style={[styles.mainBtnSub, { color: "#b09030" }]} numberOfLines={1}>
            Numbers decay – race to clear!
          </Text>
        </View>
      </TouchableOpacity>

    </ImageBackground>
  );
}

// ─── Shared card look ──────────────────────────────────────────────────────────
// Dark semi-transparent background + 2px coloured border + rounded corners.
const CARD_BG      = "rgba(10, 12, 24, 0.72)";
const CARD_RADIUS  = 16;
const BORDER_W     = 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },

  // ── Settings ────────────────────────────────────────────
  settingsBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 48,
    height: 48,
    zIndex: 99,
  },
  settingsIcon: {
    width: "100%",
    height: "100%",
  },

  // ── Stats row ───────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    marginTop: 160,
  },
  statCard: {
    flex: 1,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 230, 0, 0.12)",
    borderWidth: BORDER_W,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 10,
    gap: 8,
  },
  statIcon: {
    width: 32,
    height: 32,
  },
  statTextArea: {
    flex: 1,
    justifyContent: "center",
  },
  statValue: {
    fontFamily: "LuckiestGuy_400Regular",
    fontSize: 20,
    letterSpacing: 0.5,
    textShadowColor: "rgba(0, 0, 0, 1)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  statLabel: {
    fontFamily: "FredokaOne_400Regular",
    fontSize: 11,
    marginTop: -4,
  },

  // ── Streak ──────────────────────────────────────────────
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255, 124, 48, 0.12)",
    borderWidth: BORDER_W,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  streakIcon: {
    width: 26,
    height: 26,
  },
  streakText: {
    fontFamily: "LuckiestGuy_400Regular",
    color: "#FF7C30",
    fontSize: 15,
    letterSpacing: 1,
    marginTop: 4,
    marginLeft: -4,
    textShadowColor: "rgba(0, 0, 0, 1)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },

  // ── Main buttons (Challenge / Play / Classic / Rush) ────
  mainBtn: {
    width: "100%",
    height: 72,
    flexDirection: "row",
    alignItems: "center",
  backgroundColor: "rgba(10, 12, 24, 0.72)",
    borderWidth: BORDER_W,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    gap: 14,
  },
  mainBtnIcon: {
    width: 44,
    height: 44,
    flexShrink: 0,
  },
  mainBtnIconDaily: {
    width: 62,
    height: 62,
    flexShrink: 0,
  },
  mainBtnDaily:{
    width: "100%",
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: BORDER_W,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    gap: 14,
    backgroundColor: "rgba(244, 12, 84, 0.12)", 
  },
  mainBtnIconPlay: {
    width: 44,
    height: 44,
    flexShrink: 0,
    marginLeft: 12,
  },
  mainBtnPlay:{
    width: "100%",
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: BORDER_W,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    gap: 14,
    backgroundColor: "rgba(10, 175, 248, 0.12)",
  },
  mainBtnClassic:{
    width: "100%",
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: BORDER_W,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    gap: 14,
    backgroundColor: "rgba(25, 219, 108, 0.12)",
  },
  mainBtnIconClassic: {
    width: 62,
    height: 62,
    flexShrink: 0,
  },
  mainBtnRush:{
    width: "100%",
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: BORDER_W,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    gap: 14,
    backgroundColor: "rgba(254, 202, 25, 0.12)",
  },
  mainBtnIconRush: {
    width: 62,
    height: 62,
    flexShrink: 0,
    marginLeft: 2,
  },
  mainBtnText: {
    flex: 1,
    justifyContent: "center",
  },
  mainBtnTitle: {
    fontFamily: "LuckiestGuy_400Regular",
    fontSize: 20,
    letterSpacing: 1.5,
    textShadowColor: "rgba(0, 0, 0, 1)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
    marginTop: 2,
  },
  mainBtnSub: {
    fontFamily: "FredokaOne_400Regular",
    fontSize: 12,
    marginTop: -4,
  },

  // ── All Levels (shorter pill) ────────────────────────────
  allLevelsBtn: {
    width: "100%",
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 175, 248, 0.12)",
    borderRadius: CARD_RADIUS,
    gap: 10,
    paddingHorizontal: 14,
  },
  allLevelsIcon: {
    width: 28,
    height: 28,
  },
  allLevelsTitle: {
    fontFamily: "LuckiestGuy_400Regular",
    fontSize: 17,
    letterSpacing: 1.5,
    marginTop: 4,
    textShadowColor: "rgba(0, 0, 0, 1)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
});