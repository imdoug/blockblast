// app/_layout.tsx

import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { loadHapticsEnabled } from "../src/store/storage";
import { setHapticsEnabled } from "../src/hooks/useHaptics";

// Safe imports — graceful no-op if packages not installed
let mobileAds: any = null;
try { mobileAds = require("react-native-google-mobile-ads").default; } catch {}

let requestTrackingPermissionsAsync: any = null;
try {
  requestTrackingPermissionsAsync =
    require("expo-tracking-transparency").requestTrackingPermissionsAsync;
} catch {}

export default function Layout() {
  useEffect(() => {
    async function init() {
      // ── Haptics preference ───────────────────────────────────────────────
      const hapticsOn = await loadHapticsEnabled();
      setHapticsEnabled(hapticsOn);

      // ── AdMob initialisation ─────────────────────────────────────────────
      // Initialize AdMob first — this sets up the SDK regardless of ATT status.
      // Ads will show (non-personalised) even if the user declines tracking.
      if (mobileAds) {
        try { await mobileAds().initialize(); } catch {}
      }

      // ── ATT permission (iOS only) ────────────────────────────────────────
      // Apple requires ATT to be shown in context — not on cold launch.
      // We show it here on the first app open after install, which is
      // acceptable. The ideal UX is to show it after the user has played
      // one level (so they've experienced the app first), but that requires
      // passing a callback from the game screen, which adds complexity.
      //
      // To delay ATT to after first level:
      //   1. Remove this block from here
      //   2. Call requestATTPermission() from level/[id].tsx onWin
      //   3. Store "attRequested" in AsyncStorage so it only fires once
      if (Platform.OS === "ios" && requestTrackingPermissionsAsync) {
        try {
          await requestTrackingPermissionsAsync();
        } catch {}
      }
    }

    init();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F1B35" },
        animation: "slide_from_right",
        gestureEnabled: false,
      }}
    />
  );
}