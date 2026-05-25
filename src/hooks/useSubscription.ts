import { useEffect, useState } from "react";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { REVENUECAT_API_KEY } from "../constants/config";

// Call this once at app startup in app/_layout.tsx
export function initRevenueCat() {
  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
}

export function useSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const info: CustomerInfo = await Purchases.getCustomerInfo();
        setIsSubscribed(info.entitlements.active["pro"] !== undefined);
      } catch (e) {
        // If RevenueCat fails (e.g. no internet on first launch), default to false
        setIsSubscribed(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkStatus();
  }, []);

  async function subscribe(packageId: string): Promise<boolean> {
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        (p) => p.identifier === packageId
      );
      if (!pkg) return false;
      await Purchases.purchasePackage(pkg);
      setIsSubscribed(true);
      return true;
    } catch (e) {
      // User cancelled or purchase failed — not an error worth crashing over
      return false;
    }
  }

  async function restore(): Promise<boolean> {
    try {
      const info = await Purchases.restorePurchases();
      const active = info.entitlements.active["pro"] !== undefined;
      setIsSubscribed(active);
      return active;
    } catch (e) {
      return false;
    }
  }

  return { isSubscribed, isLoading, subscribe, restore };
}