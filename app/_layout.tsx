// app/_layout.tsx

import { Stack } from "expo-router";
import { useEffect } from "react";
import { loadHapticsEnabled, loadSoundEnabled } from "../src/store/storage";
import { setHapticsEnabled } from "../src/hooks/useHaptics";

export default function Layout() {
  // Load saved preferences on app start so every screen
  // immediately respects the user's last settings
  useEffect(() => {
    async function initPrefs() {
      const hapticsOn = await loadHapticsEnabled();
      setHapticsEnabled(hapticsOn);
      // Sound preference loaded by useSound hook directly
    }
    initPrefs();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F1B35" },
        animation: "slide_from_right",
      }}
    />
  );
}