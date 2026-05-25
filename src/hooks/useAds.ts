// Stubbed until AdMob is configured with real App IDs
// Replace this entire file with the full version from Section 6.2 when ready

export function useAds() {
  function showInterstitial(onClose?: () => void) {
    onClose?.();
  }

  function showRewarded(onEarned: () => void, onClose?: () => void) {
    // In stub mode, immediately grant the reward for testing
    onEarned();
    onClose?.();
  }

  return { showInterstitial, showRewarded };
}