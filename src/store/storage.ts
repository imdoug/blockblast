// src/store/storage.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── DEV MODE ─────────────────────────────────────────────────────────────────
// Set DEV_UNLOCK_ALL to true while testing to skip the level progression lock.
// All 99 levels will be immediately accessible from the level select screen.
// SET THIS TO FALSE BEFORE SHIPPING TO THE APP STORE.

export const DEV_UNLOCK_ALL = false; // ← FLIP TO false BEFORE PUBLISHING

const KEYS = {
  HIGHEST_LEVEL:     "bb_highest_level",
  LEVEL_STARS:       "bb_level_stars",
  CLASSIC_BEST:      "bb_classic_best",
  STREAK:            "bb_streak",
  DAILY_RESULT:      "bb_daily_result",
  OBSTACLE_TIP_SEEN: "bb_obstacle_tip_seen",
  HAPTICS_ENABLED:   "bb_haptics_enabled",
  SOUND_ENABLED:     "bb_sound_enabled",
  ONBOARDING_SEEN:   "bb_onboarding_seen",
} as const;

// ─── Level Progress ───────────────────────────────────────────────────────────

export async function loadHighestLevel(): Promise<number> {
  if (DEV_UNLOCK_ALL) return 99; // ← unlocks everything for testing
  try {
    const val = await AsyncStorage.getItem(KEYS.HIGHEST_LEVEL);
    return val ? parseInt(val, 10) : 1;
  } catch { return 1; }
}

export async function saveHighestLevel(levelId: number): Promise<void> {
  if (DEV_UNLOCK_ALL) return; // don't write during dev — keeps testing clean
  try {
    const current = await loadHighestLevel();
    if (levelId + 1 > current)
      await AsyncStorage.setItem(KEYS.HIGHEST_LEVEL, String(levelId + 1));
  } catch {}
}

// ─── Stars ────────────────────────────────────────────────────────────────────

export async function loadAllStars(): Promise<Record<number, number>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LEVEL_STARS);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function saveLevelStars(levelId: number, stars: number): Promise<void> {
  try {
    const all = await loadAllStars();
    if ((all[levelId] ?? 0) < stars) {
      all[levelId] = stars;
      await AsyncStorage.setItem(KEYS.LEVEL_STARS, JSON.stringify(all));
    }
  } catch {}
}

// ─── Classic Best ─────────────────────────────────────────────────────────────

export async function loadClassicBest(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(KEYS.CLASSIC_BEST);
    return val ? parseInt(val, 10) : 0;
  } catch { return 0; }
}

export async function saveClassicBest(score: number): Promise<void> {
  try {
    const current = await loadClassicBest();
    if (score > current)
      await AsyncStorage.setItem(KEYS.CLASSIC_BEST, String(score));
  } catch {}
}

// ─── Streak ───────────────────────────────────────────────────────────────────

interface StreakData { count: number; lastDate: string; }

export async function updateAndLoadStreak(): Promise<number> {
  // READ-ONLY — just returns current streak count.
  // Streak is incremented only when the user COMPLETES the daily challenge.
  // See incrementStreakOnDailyComplete() below.
  try {
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    const streak: StreakData = raw ? JSON.parse(raw) : { count: 0, lastDate: "" };

    // If user missed yesterday, streak has broken — return 0
    const today     = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    if (streak.lastDate !== today && streak.lastDate !== yesterday) {
      // Streak broken — reset silently
      await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify({ count: 0, lastDate: streak.lastDate }));
      return 0;
    }
    return streak.count;
  } catch { return 1; }
}

export async function loadStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    return raw ? (JSON.parse(raw) as StreakData).count : 0;
  } catch { return 0; }
}

// ─── Daily Result ─────────────────────────────────────────────────────────────

interface DailyResult { date: string; score: number; stars: number; }

export async function loadTodaysDailyResult(): Promise<DailyResult | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_RESULT);
    if (!raw) return null;
    const result: DailyResult = JSON.parse(raw);
    return result.date === new Date().toISOString().split("T")[0] ? result : null;
  } catch { return null; }
}

export async function saveDailyResult(score: number, stars: number): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    await AsyncStorage.setItem(KEYS.DAILY_RESULT, JSON.stringify({ date: today, score, stars }));
  } catch {}
}

// ─── Settings ────────────────────────────────────────────────────────────────
// Haptics and sound preferences. Default is true (on) for both.
// We store as "false" string only when disabled — missing key = enabled.

export async function loadHapticsEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.HAPTICS_ENABLED);
    return val !== "false";
  } catch { return true; }
}

export async function saveHapticsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.HAPTICS_ENABLED, enabled ? "true" : "false");
  } catch {}
}

export async function loadSoundEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.SOUND_ENABLED);
    return val !== "false";
  } catch { return true; }
}

export async function saveSoundEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SOUND_ENABLED, enabled ? "true" : "false");
  } catch {}
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.ONBOARDING_SEEN);
    return val === "true";
  } catch { return false; }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.ONBOARDING_SEEN, "true");
  } catch {}
}

// ─── Daily streak — only increments on actual daily challenge completion ────────

export async function incrementStreakOnDailyComplete(): Promise<number> {
  try {
    const today     = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    const raw       = await AsyncStorage.getItem(KEYS.STREAK);
    const streak: StreakData = raw ? JSON.parse(raw) : { count: 0, lastDate: "" };

    // Already completed today — don't double-count
    if (streak.lastDate === today) return streak.count;

    // Continuing streak (played yesterday) or starting fresh
    const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
    await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify({ count: newCount, lastDate: today }));
    return newCount;
  } catch { return 0; }
}

// ─── Obstacle tutorial ───────────────────────────────────────────────────────
// Tracks whether the one-time obstacle tutorial tooltip has been shown.
// Once seen it never appears again — we store a simple boolean flag.

export async function hasSeenObstacleTip(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.OBSTACLE_TIP_SEEN);
    return val === "true";
  } catch { return false; }
}

export async function markObstacleTipSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.OBSTACLE_TIP_SEEN, "true");
  } catch {}
}

// ─── Dev helper ───────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    console.log("[Storage] All data cleared");
  } catch {}
}