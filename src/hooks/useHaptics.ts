// src/hooks/useHaptics.ts
//
// Centralized haptic feedback. All game events call these functions.
// If expo-haptics is not installed, every call silently does nothing —
// so you can add this hook now and install the package later without errors.
//
// To install: npx expo install expo-haptics

let Haptics: any = null;
try {
  Haptics = require("expo-haptics");
} catch {
  // expo-haptics not installed yet — all functions will no-op
}

export function useHaptics() {
  function piecePicked() {
    // Light tap when the player lifts a piece from the tray
    try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }

  function piecePlaced() {
    // Satisfying medium thud when a piece lands on the grid
    try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  }

  function lineCleared() {
    // Strong pulse when a row or column clears — the most satisfying moment
    try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  }

  function invalidDrop() {
    // Error buzz when the player tries to place where it doesn't fit
    try { Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  }

  function levelComplete() {
    // Success notification on win
    try { Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  }

  function levelFailed() {
    // Warning on fail — softer than error
    try { Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
  }

  function comboAchieved() {
    // Double tap feel for combo — two medium impacts close together
    try {
      Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
      }, 80);
    } catch {}
  }

  return {
    piecePicked,
    piecePlaced,
    lineCleared,
    invalidDrop,
    levelComplete,
    levelFailed,
    comboAchieved,
  };
}