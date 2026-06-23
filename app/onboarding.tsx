// app/onboarding.tsx
//
// Shows once on first launch. Stores completion in AsyncStorage.
// 4 slides with animated transitions and mini visual demos.

import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Animated, Dimensions,
} from "react-native";
import { useRef, useState } from "react";
import { router } from "expo-router";
import { COLORS, TEXT} from "../src/constants/theme";
import { markOnboardingSeen } from "../src/store/storage";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Slide data ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    emoji: "🎮",
    title: "Welcome to BloxBurst",
    body: "Drag pieces from the tray onto the grid. Fit them anywhere they'll land.",
    accent: "#4ECDC4",
    demo: "drag",
  },
  {
    emoji: "💥",
    title: "Clear Lines to Score",
    body: "Fill an entire row or column to clear it and earn points. Chain multiple clears for combo bonuses!",
    accent: "#FFE66D",
    demo: "clear",
  },
  {
    emoji: "🧱",
    title: "Obstacle Blocks",
    body: "Some levels have obstacle blocks. Fill the row through them to chip away at their number. Destroy them for bonus points!",
    accent: "#A67C52",
    demo: "obstacle",
  },
  {
    emoji: "🏆",
    title: "You're Ready!",
    body: "Complete levels to unlock more. Come back daily for the Daily Challenge — everyone gets the same puzzle!",
    accent: "#FFE66D",
    demo: "ready",
  },
];

// ─── Mini demo grids ──────────────────────────────────────────────────────────

const CELL = 28;
const GAP  = 3;

function DemoCell({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <View style={{
      width: CELL, height: CELL, borderRadius: 6, margin: GAP / 2,
      backgroundColor: color, opacity,
    }} />
  );
}

function DemoDrag() {
  // Shows a mini grid with a piece being dragged toward it
  return (
    <View style={demoS.container}>
      <View style={demoS.grid}>
        {/* 4x4 mini grid */}
        {[0,1,2,3].map(r => (
          <View key={r} style={{ flexDirection: "row" }}>
            {[0,1,2,3].map(c => {
              const filled = (r === 0 && c <= 2) || (r === 1 && c === 0);
              const color = r === 0 && c <= 2 ? "#4ECDC4"
                          : r === 1 && c === 0 ? "#FF6B6B"
                          : "rgba(255,255,255,0.06)";
              return <DemoCell key={c} color={color} opacity={filled ? 1 : 1} />;
            })}
          </View>
        ))}
      </View>
      <Image source={require("../assets/icons/arrow-right.png")} style={demoS.arrowImg} />
      {/* Piece being dragged */}
      <View style={demoS.piece}>
        {[[1,1],[1,0]].map((row, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {row.map((cell, c) => (
              <DemoCell key={c} color={cell ? "#FF6B6B" : "transparent"} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function DemoClear() {
  // Shows a row about to clear (highlighted) and the result
  return (
    <View style={demoS.container}>
      <View>
        {[0,1,2,3].map(r => (
          <View key={r} style={{ flexDirection: "row" }}>
            {[0,1,2,3].map(c => {
              // Row 2 is the "about to clear" row
              const isFullRow = r === 2;
              const colors = ["#FF6B6B","#4ECDC4","#FFE66D","#A8E6CF",
                              "#6C5CE7","#FD9644","#54A0FF","#FF8B94"];
              const colorIdx = (r * 4 + c) % colors.length;
              const empty = !isFullRow && (r === 3 && c > 1);
              return (
                <DemoCell
                  key={c}
                  color={isFullRow ? "#FFE66D" : empty ? "rgba(255,255,255,0.06)" : colors[colorIdx]}
                  opacity={isFullRow ? 0.9 : 1}
                />
              );
            })}
          </View>
        ))}
      </View>
      <Image source={require("../assets/icons/arrow-right.png")} style={demoS.arrowImg} />
      <View>
        {[0,1,2,3].map(r => (
          <View key={r} style={{ flexDirection: "row" }}>
            {[0,1,2,3].map(c => {
              // Row 2 is now cleared
              const wasFullRow = r === 2;
              const colors = ["#FF6B6B","#4ECDC4","#FFE66D","#A8E6CF",
                              "#6C5CE7","#FD9644","#54A0FF","#FF8B94"];
              const colorIdx = (r * 4 + c) % colors.length;
              const empty = wasFullRow || (r === 3 && c > 1);
              return (
                <DemoCell
                  key={c}
                  color={empty ? "rgba(255,255,255,0.06)" : colors[colorIdx]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function DemoObstacle() {
  return (
    <View style={demoS.container}>
      <View>
        {[0,1,2,3].map(r => (
          <View key={r} style={{ flexDirection: "row" }}>
            {[0,1,2,3].map(c => {
              const isObs = r === 1 && c === 2;
              const colors = ["#4ECDC4","#FF6B6B","#FFE66D","#A8E6CF"];
              const filled = !isObs && Math.random() > 0.4;
              return (
                <View key={c} style={{
                  width: CELL, height: CELL, borderRadius: 6, margin: GAP / 2,
                  backgroundColor: isObs ? "#6B4C2A"
                    : (r === 1 ? (c < 2 ? colors[c] : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.06)"),
                  alignItems: "center", justifyContent: "center",
                  borderWidth: isObs ? 1 : 0,
                  borderColor: "rgba(0,0,0,0.3)",
                }}>
                  {isObs && <Text style={{ fontSize: 10, color: "#E8C99A", ...TEXT.number }}>3</Text>}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Image source={require("../assets/icons/arrow-right.png")} style={demoS.arrowImg} />
      <View>
        {[0,1,2,3].map(r => (
          <View key={r} style={{ flexDirection: "row" }}>
            {[0,1,2,3].map(c => {
              const isObs = r === 1 && c === 2;
              // After clearing row 1, obstacle takes a hit (3→2)
              const colors = ["#4ECDC4","#FF6B6B","#FFE66D","#A8E6CF"];
              return (
                <View key={c} style={{
                  width: CELL, height: CELL, borderRadius: 6, margin: GAP / 2,
                  backgroundColor: isObs ? "#8B6340"
                    : r === 1 ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.06)",
                  alignItems: "center", justifyContent: "center",
                  borderWidth: isObs ? 1 : 0,
                  borderColor: "rgba(0,0,0,0.3)",
                }}>
                  {isObs && <Text style={{ fontSize: 10, color: "#E8C99A", ...TEXT.number }}>2</Text>}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function DemoReady() {
  // Show a colorful full grid with star
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View>
        {[0,1,2,3].map(r => (
          <View key={r} style={{ flexDirection: "row" }}>
            {[0,1,2,3].map(c => {
              const colors = ["#FF6B6B","#4ECDC4","#FFE66D","#A8E6CF",
                              "#6C5CE7","#FD9644","#54A0FF","#FF8B94"];
              return (
                <DemoCell key={c} color={colors[(r * 4 + c) % colors.length]} />
              );
            })}
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 32 }}>⭐⭐⭐</Text>
    </View>
  );
}

const demoS = StyleSheet.create({
  arrowImg: { width: 24, height: 18, resizeMode: "contain", tintColor: COLORS.textDim },
  container: { flexDirection: "row", alignItems: "center", gap: 12 },
  grid: {},
  piece: {},
});

// ─── Main onboarding ──────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  function goToSlide(next: number) {
    // Fade out + slide left, then swap content, fade in + slide from right
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(next);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  async function finish() {
    await markOnboardingSeen();
    router.replace("/");
  }

  function handleNext() {
    if (current < SLIDES.length - 1) {
      goToSlide(current + 1);
    } else {
      finish();
    }
  }

  async function handleSkip() {
    await markOnboardingSeen();
    router.replace("/");
  }

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <View style={s.container}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slide content */}
      <Animated.View style={[
        s.slideContent,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}>
        {/* Emoji */}
        <Text style={s.emoji}>{slide.emoji}</Text>

        {/* Title */}
        <Text style={[s.title, { color: slide.accent }]}>{slide.title}</Text>

        {/* Body */}
        <Text style={s.body}>{slide.body}</Text>

        {/* Demo visual */}
        <View style={[s.demoBox, { borderColor: `${slide.accent}33` }]}>
          {slide.demo === "drag"     && <DemoDrag />}
          {slide.demo === "clear"    && <DemoClear />}
          {slide.demo === "obstacle" && <DemoObstacle />}
          {slide.demo === "ready"    && <DemoReady />}
        </View>
      </Animated.View>

      {/* Progress dots */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[
            s.dot,
            i === current && { backgroundColor: slide.accent, width: 24 },
          ]} />
        ))}
      </View>

      {/* Next / Get started button */}
      <TouchableOpacity
        style={[s.nextBtn, { backgroundColor: slide.accent }]}
        onPress={handleNext}
        activeOpacity={0.85}
      >
        <View style={s.nextBtnInner}>
          <Text style={s.nextText}>
            {isLast ? "Let's Play!" : "Next"}
          </Text>
          <Image source={require("../assets/icons/arrow-right.png")} style={s.nextArrow} />
        </View>
      </TouchableOpacity>

      {/* Subtle page counter */}
      <Text style={s.counter}>{current + 1} / {SLIDES.length}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  nextBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextArrow: {
    width: 20,
    height: 15,
    resizeMode: "contain",
    tintColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 48,
    gap: 24,
  },
  skipBtn: {
    position: "absolute",
    top: 60, right: 24,
  },
  skipText: {
    color: COLORS.textDim,
    fontSize: 15,
    ...TEXT.nav,
  },
  slideContent: {
    alignItems: "center",
    gap: 16,
    flex: 1,
    justifyContent: "center",
  },
  emoji: { fontSize: 64 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 0.5,
    ...TEXT.title,
  },
  body: {
    color: COLORS.textDim,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
    ...TEXT.body,
  },
  demoBox: {
    marginTop: 8,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  nextBtn: {
    borderRadius: 16,
    paddingHorizontal: 48,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
  },
  nextText: {
    color: COLORS.background,
    fontSize: 17,
    fontWeight: "bold",
     ...TEXT.nav,
  },
  counter: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: -12,
    ...TEXT.label,
  },
});