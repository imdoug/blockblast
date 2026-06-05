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
  loadClassicBest, loadAllStars, hasSeenOnboarding,
} from "../src/store/storage";

const BTN_CHALLENGE  = require("../assets/buttons/Button_Challenge.png");
const BTN_PLAY       = require("../assets/buttons/Button_Play.png");
const BTN_ALL_LEVELS = require("../assets/buttons/Button_AllLevels.png");
const BTN_CLASSIC    = require("../assets/buttons/Button_Classic.png");
const BTN_RUSH       = require("../assets/buttons/Button_Rush.png");
const BTN_STARS      = require("../assets/buttons/Button_Stars.png");
const BTN_STREAK     = require("../assets/buttons/Button_Streak.png");
const BTN_TROPHY     = require("../assets/buttons/Button_Trophy.png");
const BTN_SETTINGS = require("../assets/buttons/Button_setting.png");

export default function HomeScreen() {
  const [highestLevel, setHighestLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyDone, setDailyDone] = useState(false);
  const [classicBest, setClassicBest] = useState(0);
  const [totalStars, setTotalStars] = useState(0);

  const [fontsLoaded] = useFonts({
    LuckiestGuy_400Regular,
    FredokaOne_400Regular,
  });

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

      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => router.push("/settings")}
        activeOpacity={0.7}
      >
        <Image source={BTN_SETTINGS} style={styles.settingsIcon} resizeMode="contain" />
      </TouchableOpacity>

      {/* <Text style={styles.subtitle}>Block puzzle · clear lines · score big</Text> */}

      {/* Stats row — Trophy + Stars side by side */}
      {(classicBest > 0 || totalStars > 0) && (
        <View style={styles.statsRow}>
          <View style={styles.statWrapper}>
            <Image source={BTN_TROPHY} style={styles.statBtnBg} resizeMode="stretch" />
            <View style={styles.statTextArea}>
              <Text style={styles.statValue} numberOfLines={1}>
                {classicBest > 0 ? classicBest.toLocaleString() : "0"}
              </Text>
              <Text style={styles.statLabel}>classic best</Text>
            </View>
          </View>

          <View style={styles.statWrapper}>
            <Image source={BTN_STARS} style={styles.statBtnBg} resizeMode="stretch" />
            <View style={styles.statTextArea}>
              <Text style={styles.statValue} numberOfLines={1}>
                {totalStars} / 297
              </Text>
              <Text style={styles.statLabel}>stars earned</Text>
            </View>
          </View>
        </View>
      )}

      {/* Streak */}
      {streak > 0 && (
        <View style={styles.streakWrapper}>
          <Image source={BTN_STREAK} style={styles.streakBg} resizeMode="stretch" />
          <Text style={styles.streakText}>🔥 {streak} day streak</Text>
        </View>
      )}

      {/* Daily Challenge */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.mainBtnWrapper}
        onPress={() => router.push("/daily")}
      >
        <Image source={BTN_CHALLENGE} style={styles.mainBtnBg} resizeMode="stretch" />
        <View style={styles.mainBtnTextArea}>
          <Text style={[styles.mainBtnTitle, { color: "#f40c54" }]} numberOfLines={1}>
            {dailyDone ? "DAILY DONE!" : "DAILY CHALLENGE"}
          </Text>
          <Text style={[styles.mainBtnSub, { color: "#c06080" }]} numberOfLines={1}>
            {dailyDone ? "Come back tomorrow" : "Today's puzzle awaits!"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Play Level */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.mainBtnWrapper}
        onPress={() => router.push(`/level/${highestLevel}`)}
      >
        <Image source={BTN_PLAY} style={styles.mainBtnBg} resizeMode="stretch" />
        <View style={styles.mainBtnTextArea}>
          <Text style={[styles.mainBtnTitle, { color: "#0aaff8", fontSize: 28, marginLeft: 20, marginTop: 6
           }]} numberOfLines={1}>
            PLAY LEVEL {highestLevel}
          </Text>
        </View>
      </TouchableOpacity>

      {/* All Levels */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.allLevelsWrapper}
        onPress={() => router.push("/campaign")}
      >
        <Image source={BTN_ALL_LEVELS} style={styles.mainBtnBg} resizeMode="stretch" />
        <View style={styles.allLevelsCenterArea}>
          <Text style={styles.allLevelsTitle} numberOfLines={1}>ALL LEVELS</Text>
        </View>
      </TouchableOpacity>

      {/* Classic Mode */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.mainBtnWrapper}
        onPress={() => router.push("/game")}
      >
        <Image source={BTN_CLASSIC} style={styles.mainBtnBg} resizeMode="stretch" />
        <View style={styles.mainBtnTextArea}>
          <Text style={[styles.mainBtnTitle, { color: "#19db6c" }]} numberOfLines={1}>
            CLASSIC MODE
          </Text>
          <Text style={[styles.mainBtnSub, { color: "#2a9c54" }]} numberOfLines={1}>
            Numbers decay – race to clear!
          </Text>
        </View>
      </TouchableOpacity>

      {/* Rush Mode */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.mainBtnWrapper}
        onPress={() => router.push("/rush")}
      >
        <Image source={BTN_RUSH} style={styles.mainBtnBg} resizeMode="stretch" />
        <View style={styles.mainBtnTextArea}>
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

// The icon occupies roughly the left 22% of each button image.
// TEXT_OFFSET pushes content past the icon; the remaining flex space
// is centred so text sits in the middle of the dark right portion.
const ICON_OFFSET = "22%";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
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
  subtitle: {
    fontFamily: "FredokaOne_400Regular",
    color: COLORS.textDim,
    fontSize: 13,
    marginBottom: 2,
  },

  // ── Stats ──────────────────────────────────────────────
    statsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    marginTop: 120,
  },
  statWrapper: {
    flex: .8,           // equal width — each gets exactly 50% minus the gap
    height: 50,
  },
  statBtnBg: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  statTextArea: {
    position: "absolute",
    left: "36%",       // icon in this asset is ~35% wide
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  statValue: {
    fontFamily: "LuckiestGuy_400Regular",
    color: "#FFE066",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontFamily: "FredokaOne_400Regular",
    color: "#ffe600",
    fontSize: 11,
    marginTop: 1,
  },

  // ── Streak ─────────────────────────────────────────────
  streakWrapper: {
    height: 40,
    alignSelf: "center",
    // width driven by content; use a fixed or percent width
    width: "60%",
  },
  streakBg: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  streakText: {
    flex: 1,
    textAlign: "center",
    lineHeight: 40,
    fontFamily: "LuckiestGuy_400Regular",
    color: "#FF7C30",
    fontSize: 15,
    letterSpacing: 1,
  },

  // ── Main buttons (Challenge / Play / Classic / Rush) ───
  mainBtnWrapper: {
    width: "100%",
    height: 72,
  },
  mainBtnBg: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  // Text lives in the right portion only — centred vertically, left-aligned inside its zone
  mainBtnTextArea: {
    position: "absolute",
    left: ICON_OFFSET,   // skip the icon
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  mainBtnTitle: {
    fontFamily: "LuckiestGuy_400Regular",
    fontSize: 20,
    letterSpacing: 1.5,
    marginLeft: 40,   // nudge back left to partially overlap the icon for better balance
  },
  mainBtnSub: {
    fontFamily: "FredokaOne_400Regular",
    fontSize: 12,
    marginTop: 2,
    marginLeft: 40,
  },

  // ── All Levels (no icon, text centred across full width) ─
  allLevelsWrapper: {
    width: "100%",
    height: 42,
  },
  allLevelsCenterArea: {
    position: "absolute",
    // The AllLevels asset has a small icon on the left; skip it the same way
    left: ICON_OFFSET,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  allLevelsTitle: {
    fontFamily: "LuckiestGuy_400Regular",
    color: "#0aaff8",
    fontSize: 17,
    letterSpacing: 1.5,
    marginLeft: -35,   // nudge left to balance the small icon on the left of this asset
  },
});