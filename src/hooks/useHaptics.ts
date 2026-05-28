// src/hooks/useHaptics.ts
//
// Module-level flag so toggling in Settings instantly affects all screens.
// When _enabled is false every function silently does nothing —
// no need to check in each call site.

let Haptics: any = null;
try { Haptics = require("expo-haptics"); } catch {}

let _enabled = true; // module-level: shared across all hook instances

export function setHapticsEnabled(v: boolean) { _enabled = v; }
export function getHapticsEnabled() { return _enabled; }

export function useHaptics() {
  function trigger(fn: () => void) {
    if (!_enabled || !Haptics) return;
    try { fn(); } catch {}
  }

  return {
    piecePicked:    () => trigger(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    piecePlaced:    () => trigger(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
    lineCleared:    () => trigger(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
    invalidDrop:    () => trigger(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    levelComplete:  () => trigger(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    levelFailed:    () => trigger(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    comboAchieved:  () => trigger(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        try { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
      }, 80);
    }),
  };
}