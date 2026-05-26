// src/store/storage.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── DEV MODE ─────────────────────────────────────────────────────────────────
// Set DEV_UNLOCK_ALL to true while testing to skip the level progression lock.
// All 99 levels will be immediately accessible from the level select screen.
// SET THIS TO FALSE BEFORE SHIPPING TO THE APP STORE.

export const DEV_UNLOCK_ALL = true; // ← FLIP TO false BEFORE PUBLISHING

const KEYS = {
  HIGHEST_LEVEL: "bb_highest_level",
  LEVEL_STARS:   "bb_level_stars",
  CLASSIC_BEST:  "bb_classic_best",
  STREAK:        "bb_streak",
  DAILY_RESULT:  "bb_daily_result",
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
  try {
    const today = new Date().toISOString().split("T")[0];
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    const streak: StreakData = raw ? JSON.parse(raw) : { count: 0, lastDate: "" };
    if (streak.lastDate === today) return streak.count;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
    await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify({ count: newCount, lastDate: today }));
    return newCount;
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

// ─── Dev helper ───────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    console.log("[Storage] All data cleared");
  } catch {}
}