// src/hooks/useHaptics.ts
//
// Centralized haptic feedback.
// Silently does nothing if expo-haptics is not installed.
//
// Install: npx expo install expo-haptics

let Haptics: any = null;
try { Haptics = require("expo-haptics"); } catch {}

export function useHaptics() {
  function piecePicked() {
    try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }
  function piecePlaced() {
    try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  }
  function lineCleared() {
    try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  }
  function invalidDrop() {
    try { Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  }
  function levelComplete() {
    try { Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  }
  function levelFailed() {
    try { Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
  }
  function comboAchieved() {
    try {
      Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
      }, 80);
    } catch {}
  }
  return { piecePicked, piecePlaced, lineCleared, invalidDrop, levelComplete, levelFailed, comboAchieved };
}