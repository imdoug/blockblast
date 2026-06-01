import { Platform } from "react-native";

const IS_DEV = __DEV__;

// ─── RevenueCat ───────────────────────────────────────────────────────────────
export const REVENUECAT_KEY = Platform.select({
  ios:     "appl_tKAfBKFCeyYEwKcDYEozJbQwKxN", // ← your BloxBurst iOS key
  android: "",
})!;

// ─── AdMob ────────────────────────────────────────────────────────────────────
export const ADMOB_APP_ID = Platform.select({
  ios:     "ca-app-pub-4649688048415899~5057012442", // ← your iOS App ID
  android: "",
})!;

const TEST_IDS = {
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded:     "ca-app-pub-3940256099942544/5224354917",
  banner:       "ca-app-pub-3940256099942544/6300978111",
};

const PROD_IDS = {
  interstitial: Platform.select({
    ios:     "ca-app-pub-4649688048415899/2945854421", // ← bloxburst_interstitial_ios
    android: "",
  })!,
  rewarded: Platform.select({
    ios:     "ca-app-pub-4649688048415899/4562188424", // ← bloxburst_rewarded_ios
    android: "",
  })!,
  banner: Platform.select({
    ios:     "ca-app-pub-4649688048415899/8250151993", // ← bloxburst_banner_ios
    android: "",
  })!,
};

export const AD_UNIT_IDS = IS_DEV ? TEST_IDS : PROD_IDS;
// export const AD_UNIT_IDS = TEST_IDS;

export const PRIVACY_POLICY_URL = "https://imdoug.github.io/bloxburst-privacy/";