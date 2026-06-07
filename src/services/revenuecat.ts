import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

export const PRO_ENTITLEMENT_ID = "pro";

// iOS key — hardcoded prod fallback prevents OTA-manifest null breaking purchases.
const PROD_IOS_KEY = "appl_ZFJRDePQxOoTfLabPQOpVQmLkVq";
const IOS_KEY = (
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ||
  Constants.expoConfig?.extra?.REVENUECAT_IOS_KEY ||
  PROD_IOS_KEY
) as string;

// Android key — no hardcoded fallback; if absent, RC is disabled on Android.
const ANDROID_KEY = (
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ||
  Constants.expoConfig?.extra?.REVENUECAT_ANDROID_KEY ||
  ""
) as string;

let configured = false;
let currentUserId: string | null = null;

export function getRevenueCatKey(): string {
  if (Platform.OS === "ios") return IOS_KEY;
  if (Platform.OS === "android") return ANDROID_KEY;
  return "";
}

export function isRevenueCatAvailable(): boolean {
  const key = getRevenueCatKey();
  return (Platform.OS === "ios" || Platform.OS === "android") && !!key;
}

/**
 * Configure RevenueCat once and identify the current user. Safe to call
 * multiple times — re-calls only switch identity if the user changed.
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (!isRevenueCatAvailable()) {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      console.warn("[revenuecat] no SDK key set - skipping configure");
    }
    return;
  }

  try {
    if (!configured) {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: getRevenueCatKey(), appUserID: userId });
      configured = true;
      currentUserId = userId;
      return;
    }
    if (currentUserId !== userId) {
      await Purchases.logIn(userId);
      currentUserId = userId;
    }
  } catch (e) {
    console.warn("[revenuecat] configure failed", e);
  }
}

/** Call on sign-out so the next user starts with a fresh anonymous identity. */
export async function logoutPurchases(): Promise<void> {
  if (!isRevenueCatAvailable() || !configured) return;
  try {
    await Purchases.logOut();
    currentUserId = null;
  } catch (e) {
    // logOut throws if already anonymous — non-fatal
    console.warn("[revenuecat] logout warning", e);
  }
}
