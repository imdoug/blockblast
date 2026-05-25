// src/hooks/useSound.ts
//
// Centralized sound effects using expo-av.
// All sounds are pre-loaded once when the hook mounts so there is
// zero latency when they play during gameplay.
//
// To install: npx expo install expo-av
//
// Sound files go in: assets/sounds/
//   place.mp3    — short click/thud on piece placement
//   clear.mp3    — bright chime on line clear
//   combo.mp3    — ascending tone on combo
//   win.mp3      — upbeat fanfare on level complete
//   fail.mp3     — low deflating tone on level fail
//
// Free sound sources:
//   freesound.org (filter by CC0 license)
//   kenney.nl/assets (completely free, no attribution)

import { useEffect, useRef } from "react";

let Audio: any = null;
try {
  Audio = require("expo-av").Audio;
} catch {
  // expo-av not installed yet — all functions will no-op
}

// Sound file paths — update these if you rename files
const SOUND_FILES = {
  place: require("../../assets/sounds/place.mp3"),
  clear: require("../../assets/sounds/clear.mp3"),
  combo: require("../../assets/sounds/combo.mp3"),
  win:   require("../../assets/sounds/win.mp3"),
  fail:  require("../../assets/sounds/fail.mp3"),
} as const;

type SoundName = keyof typeof SOUND_FILES;

export function useSound() {
  const sounds = useRef<Partial<Record<SoundName, any>>>({});
  const enabled = useRef(true); // Can be toggled from settings

  useEffect(() => {
    if (!Audio) return;

    // Pre-load all sounds on mount
    async function load() {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        for (const [name, file] of Object.entries(SOUND_FILES)) {
          try {
            const { sound } = await Audio.Sound.createAsync(file, { volume: 0.7 });
            sounds.current[name as SoundName] = sound;
          } catch {
            // Individual sound load failure shouldn't crash the game
          }
        }
      } catch {}
    }
    load();

    // Unload all sounds on unmount to free memory
    return () => {
      for (const sound of Object.values(sounds.current)) {
        try { sound?.unloadAsync(); } catch {}
      }
    };
  }, []);

  async function play(name: SoundName) {
    if (!enabled.current || !Audio) return;
    try {
      const sound = sounds.current[name];
      if (!sound) return;
      // Rewind to start before playing so rapid repeats work correctly
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {}
  }

  return {
    playPlace:   () => play("place"),
    playClear:   () => play("clear"),
    playCombo:   () => play("combo"),
    playWin:     () => play("win"),
    playFail:    () => play("fail"),
    setEnabled:  (v: boolean) => { enabled.current = v; },
  };
}