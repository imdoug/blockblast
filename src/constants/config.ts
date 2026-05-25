import { Platform } from 'react-native';
 
// IMPORTANT: Use test IDs during development.
// Clicking real ads during development violates AdMob Terms of Service
// and can get your account banned.
const IS_TEST = __DEV__;
 
const TEST_IDS = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded:     'ca-app-pub-3940256099942544/5224354917',
  banner:       'ca-app-pub-3940256099942544/6300978111',
};
 
const PROD_IDS = {
  interstitial: Platform.select({
    ios:     'ca-app-pub-XXXXXXXX/YYYYYYYY',  // Your iOS interstitial unit ID
    android: 'ca-app-pub-XXXXXXXX/ZZZZZZZZ',  // Your Android interstitial unit ID
  })!,
  rewarded: Platform.select({
    ios:     'ca-app-pub-XXXXXXXX/YYYYYYYY',
    android: 'ca-app-pub-XXXXXXXX/ZZZZZZZZ',
  })!,
  banner: Platform.select({
    ios:     'ca-app-pub-XXXXXXXX/YYYYYYYY',
    android: 'ca-app-pub-XXXXXXXX/ZZZZZZZZ',
  })!,
};
 
export const AD_UNIT_IDS = IS_TEST ? TEST_IDS : PROD_IDS;
export const REVENUECAT_API_KEY = Platform.select({
  ios:     'appl_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  android: 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
})!;
