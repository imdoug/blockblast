// src/store/storage.ts
//
// All persistent data lives here. Components and hooks never call AsyncStorage
// directly — they go through these helpers. This means if we ever swap the
// storage backend (e.g. to SQLite for larger data), we change it in one place.
//
// All functions are async because AsyncStorage operations are non-blocking I/O.
// Never await storage in a render function — call from useEffect or event handlers.

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Keys ─────────────────────────────────────────────────────────────────────
// Using constants prevents typos. All keys are prefixed with "bb_" (blockblast)
// to avoid collisions if other libraries also use AsyncStorage.

const KEYS = {
  HIGHEST_LEVEL:  "bb_highest_level",   // number: highest level unlocked (1-99)
  LEVEL_STARS:    "bb_level_stars",     // JSON: Record<number, 0|1|2|3>
  CLASSIC_BEST:   "bb_classic_best",    // number: best score in classic mode
  STREAK:         "bb_streak",          // JSON: { count: number, lastDate: string }
  DAILY_RESULT:   "bb_daily_result",    // JSON: { date: string, score: number, stars: number }
} as const;

// ─── Level Progress ───────────────────────────────────────────────────────────

// Returns the highest level the player has unlocked. Default is 1.
export async function loadHighestLevel(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(KEYS.HIGHEST_LEVEL);
    return val ? parseInt(val, 10) : 1;
  } catch {
    return 1;
  }
}

// Call this when a player PASSES a level (score >= targetScore).
// Only saves if this level is higher than what was previously saved —
// levels can only go forward, never backward.
export async function saveHighestLevel(levelId: number): Promise<void> {
  try {
    const current = await loadHighestLevel();
    if (levelId + 1 > current) {
      // Unlock the NEXT level, not the current one
      await AsyncStorage.setItem(KEYS.HIGHEST_LEVEL, String(levelId + 1));
    }
  } catch {
    // Storage failure should never crash the game — silently ignore
  }
}

// ─── Star Ratings ─────────────────────────────────────────────────────────────

// Returns a map of levelId → stars earned (0 = never played, 1/2/3 = completed)
export async function loadAllStars(): Promise<Record<number, number>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LEVEL_STARS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Saves the star rating for a level. Stars can only increase — if the player
// already has 3 stars on a level, replaying and getting 2 stars won't downgrade.
export async function saveLevelStars(levelId: number, stars: number): Promise<void> {
  try {
    const all = await loadAllStars();
    if ((all[levelId] ?? 0) < stars) {
      all[levelId] = stars;
      await AsyncStorage.setItem(KEYS.LEVEL_STARS, JSON.stringify(all));
    }
  } catch {}
}

// ─── Classic Mode Best Score ──────────────────────────────────────────────────

export async function loadClassicBest(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(KEYS.CLASSIC_BEST);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export async function saveClassicBest(score: number): Promise<void> {
  try {
    const current = await loadClassicBest();
    if (score > current) {
      await AsyncStorage.setItem(KEYS.CLASSIC_BEST, String(score));
    }
  } catch {}
}

// ─── Daily Streak ─────────────────────────────────────────────────────────────

interface StreakData {
  count: number;
  lastDate: string; // ISO date string "YYYY-MM-DD"
}

// Returns current streak count.
// Call this at the start of each session to update the streak.
// Logic:
//   - Same day as lastDate: streak unchanged (already played today)
//   - Day after lastDate: streak += 1 (consecutive day)
//   - Any other: streak resets to 1 (gap in play)
export async function updateAndLoadStreak(): Promise<number> {
  try {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    const streak: StreakData = raw
      ? JSON.parse(raw)
      : { count: 0, lastDate: "" };

    if (streak.lastDate === today) {
      // Already played today — return current count without changing anything
      return streak.count;
    }

    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .split("T")[0];

    const newCount =
      streak.lastDate === yesterday
        ? streak.count + 1   // Consecutive day
        : 1;                 // Streak broken or first play

    const updated: StreakData = { count: newCount, lastDate: today };
    await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(updated));
    return newCount;
  } catch {
    return 1;
  }
}

export async function loadStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    if (!raw) return 0;
    const streak: StreakData = JSON.parse(raw);
    return streak.count;
  } catch {
    return 0;
  }
}

// ─── Daily Challenge Result ───────────────────────────────────────────────────

interface DailyResult {
  date: string;
  score: number;
  stars: number;
}

export async function loadTodaysDailyResult(): Promise<DailyResult | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_RESULT);
    if (!raw) return null;
    const result: DailyResult = JSON.parse(raw);
    const today = new Date().toISOString().split("T")[0];
    return result.date === today ? result : null;
  } catch {
    return null;
  }
}

export async function saveDailyResult(score: number, stars: number): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const result: DailyResult = { date: today, score, stars };
    await AsyncStorage.setItem(KEYS.DAILY_RESULT, JSON.stringify(result));
  } catch {}
}

// ─── Debug helper ─────────────────────────────────────────────────────────────

// Call this during development to wipe all saved data and start fresh.
// Remove before shipping.
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    console.log("[Storage] All data cleared");
  } catch {}
}