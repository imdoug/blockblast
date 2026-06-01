// src/hooks/useAds.ts
//
// AdMob integration — interstitial and rewarded ads.
// Both hooks gracefully no-op if react-native-google-mobile-ads
// is not installed, so the app runs cleanly during development.
//
// Install:
//   npm install react-native-google-mobile-ads --legacy-peer-deps
//   npx expo install expo-tracking-transparency
//
// Add to app.json plugins:
//   ["react-native-google-mobile-ads", { "iosAppId": "ca-app-pub-XXXX~YYYY" }]

import { useEffect, useRef } from "react";
import { AD_UNIT_IDS } from "../constants/config";

// ─── Safe imports ─────────────────────────────────────────────────────────────
// Wrapped in try/catch so the app compiles and runs even without the package.

let InterstitialAd: any   = null;
let RewardedAd: any       = null;
let AdEventType: any      = null;
let RewardedAdEventType: any = null;

try {
  const admob       = require("react-native-google-mobile-ads");
  InterstitialAd    = admob.InterstitialAd;
  RewardedAd        = admob.RewardedAd;
  AdEventType       = admob.AdEventType;
  RewardedAdEventType = admob.RewardedAdEventType;
} catch {}

// ─── Interstitial ─────────────────────────────────────────────────────────────
// Use on: game over in Classic mode, transitioning between levels.
// Always preloads the next ad immediately after one is shown.
//
// Usage:
//   const { showInterstitial } = useInterstitialAd();
//   showInterstitial(() => { /* callback when ad closes or unavailable */ });

export function useInterstitialAd() {
  const adRef      = useRef<any>(null);
  const isLoaded   = useRef(false);
  const listeners  = useRef<(() => void)[]>([]);

  function removeListeners() {
    listeners.current.forEach(fn => { try { fn(); } catch {} });
    listeners.current = [];
  }

  function loadAd() {
    if (!InterstitialAd) return;
    removeListeners();
    try {
      adRef.current = InterstitialAd.createForAdRequest(
        AD_UNIT_IDS.interstitial,
        { requestNonPersonalizedAdsOnly: false }
      );

      listeners.current.push(
        adRef.current.addAdEventListener(AdEventType.LOADED, () => {
          isLoaded.current = true;
        }),
        adRef.current.addAdEventListener(AdEventType.CLOSED, () => {
          isLoaded.current = false;
          loadAd(); // preload the next one immediately
        }),
        adRef.current.addAdEventListener(AdEventType.ERROR, () => {
          isLoaded.current = false;
          setTimeout(loadAd, 10_000); // retry after 10s on error
        })
      );

      adRef.current.load();
    } catch {}
  }

  useEffect(() => {
    loadAd();
    return removeListeners;
  }, []);

  // Show the ad. If not ready, calls onComplete immediately so gameplay continues.
  function showInterstitial(onComplete?: () => void) {
    if (!adRef.current || !isLoaded.current) {
      onComplete?.();
      return;
    }
    try {
      removeListeners();
      listeners.current.push(
        adRef.current.addAdEventListener(AdEventType.CLOSED, () => {
          isLoaded.current = false;
          onComplete?.();
          loadAd();
        }),
        adRef.current.addAdEventListener(AdEventType.ERROR, () => {
          isLoaded.current = false;
          onComplete?.();
          loadAd();
        })
      );
      adRef.current.show();
    } catch {
      onComplete?.();
    }
  }

  return { showInterstitial };
}

// ─── Rewarded ─────────────────────────────────────────────────────────────────
// Use on: "Watch Ad for +3 Pieces" button on game over / stuck screens.
//
// Design decision: if the ad fails to load or show for any reason, we still
// grant the reward. Players tapped the button in good faith — punishing them
// for an ad network failure creates a terrible UX and support requests.
//
// Usage:
//   const { showRewarded } = useRewardedAd();
//   showRewarded(
//     () => { /* grant reward — called even if ad fails */ },
//     () => { /* optional: called when ad closes */ }
//   );

export function useRewardedAd() {
  const adRef      = useRef<any>(null);
  const isLoaded   = useRef(false);
  const listeners  = useRef<(() => void)[]>([]);

  function removeListeners() {
    listeners.current.forEach(fn => { try { fn(); } catch {} });
    listeners.current = [];
  }

  function loadAd() {
    if (!RewardedAd) return;
    removeListeners();
    try {
      adRef.current = RewardedAd.createForAdRequest(
        AD_UNIT_IDS.rewarded,
        { requestNonPersonalizedAdsOnly: false }
      );

      listeners.current.push(
        adRef.current.addAdEventListener(RewardedAdEventType.LOADED, () => {
          isLoaded.current = true;
        }),
        adRef.current.addAdEventListener(AdEventType.ERROR, () => {
          isLoaded.current = false;
          setTimeout(loadAd, 10_000);
        })
      );

      adRef.current.load();
    } catch {}
  }

  useEffect(() => {
    loadAd();
    return removeListeners;
  }, []);

  function showRewarded(onRewarded: () => void, onClosed?: () => void) {
    // If ad not ready — grant reward anyway and preload silently
    if (!adRef.current || !isLoaded.current) {
      onRewarded();
      return;
    }
    try {
      removeListeners();
      let rewardGranted = false;

      listeners.current.push(
        adRef.current.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD, () => {
            rewardGranted = true;
            onRewarded();
          }
        ),
        adRef.current.addAdEventListener(AdEventType.CLOSED, () => {
          isLoaded.current = false;
          // Grant reward on close even if EARNED_REWARD didn't fire
          // (some ad formats don't fire it on skip)
          if (!rewardGranted) onRewarded();
          onClosed?.();
          loadAd();
        }),
        adRef.current.addAdEventListener(AdEventType.ERROR, () => {
          isLoaded.current = false;
          if (!rewardGranted) onRewarded();
          onClosed?.();
          loadAd();
        })
      );

      adRef.current.show();
    } catch {
      onRewarded();
    }
  }

  return { showRewarded };
}