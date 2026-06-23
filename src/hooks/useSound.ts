// src/hooks/useSound.ts
import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// Set audio mode once at module level — ensures sounds play even in silent mode
setAudioModeAsync({
  playsInSilentMode: true,
  interruptionMode: 'mixWithOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
});

const SOUNDS = {
  place:  require('../../assets/sounds/place.mp3'),
  clear:  require('../../assets/sounds/clear.mp3'),
  combo:  require('../../assets/sounds/combo.mp3'),
  notify: require('../../assets/sounds/notify.mp3'),
  fail:   require('../../assets/sounds/fail.mp3'),
  win:    require('../../assets/sounds/win.mp3'), 
} as const;

export function useSound() {
  const enabledRef = useRef<boolean>(true);
  const activeRef  = useRef<Set<AudioPlayer>>(new Set());

  const triggerSound = useCallback((source: typeof SOUNDS[keyof typeof SOUNDS]) => {
    if (!enabledRef.current) return;
    const p = createAudioPlayer(source);
    activeRef.current.add(p);
    p.play();
    // Poll for completion to clean up — avoids needing event listener API
    const interval = setInterval(() => {
      if (p.currentTime > 0 && !p.playing) {
        activeRef.current.delete(p);
        p.remove();
        clearInterval(interval);
      }
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current.forEach(p => p.remove());
      activeRef.current.clear();
    };
  }, []);

  const playPlace = useCallback(() => triggerSound(SOUNDS.place),  [triggerSound]);
  const playClear = useCallback(() => triggerSound(SOUNDS.clear),  [triggerSound]);
  const playCombo = useCallback(() => triggerSound(SOUNDS.combo),  [triggerSound]);
  const playWin = useCallback(() => triggerSound(SOUNDS.win), [triggerSound]);
  const playFail  = useCallback(() => triggerSound(SOUNDS.fail),   [triggerSound]);

  const setEnabled = useCallback((v: boolean) => { enabledRef.current = v; }, []);
  const isEnabled  = useCallback(() => enabledRef.current, []);

  return { playPlace, playClear, playCombo, playWin, playFail, setEnabled, isEnabled };
}