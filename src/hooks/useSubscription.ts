import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from "react-native-purchases";
import { isRevenueCatAvailable, PRO_ENTITLEMENT_ID } from "../services/revenuecat";

const APPLE_SUBSCRIPTIONS_FALLBACK = "https://apps.apple.com/account/subscriptions";

export interface UseSubscription {
  isPro: boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  currentOffering: PurchasesOffering | null;
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
  managementURL: string | null;
  purchaseMonthly: () => Promise<boolean>;
  purchaseAnnual: () => Promise<boolean>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  openManagement: () => Promise<void>;
  refresh: () => Promise<void>;
}

function isProActive(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return !!info.entitlements?.active?.[PRO_ENTITLEMENT_ID];
}

export function useSubscription(): UseSubscription {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isRevenueCatAvailable()) {
      setIsLoading(false);
      return;
    }
    try {
      const [info, offers] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      setOfferings(offers);
    } catch (e) {
      console.warn("[useSubscription] refresh failed", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!isRevenueCatAvailable()) return;
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
  }, [refresh]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo: updated } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(updated);
      return isProActive(updated);
    } catch (e: any) {
      // PurchasesError has userCancelled and code fields. Don't alert on cancel.
      if (e?.userCancelled) return false;
      const code = e?.code as PURCHASES_ERROR_CODE | undefined;
      if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
      console.warn("[useSubscription] purchase failed", e);
      Alert.alert(
        "Purchase didn't go through",
        "Something went wrong. Please try again.",
      );
      return false;
    }
  }, []);

  const currentOffering = offerings?.current ?? null;
  const monthlyPackage = currentOffering?.monthly ?? null;
  const annualPackage = currentOffering?.annual ?? null;

  const purchaseMonthly = useCallback(async () => {
    if (!monthlyPackage) {
      Alert.alert("Plan unavailable", "Monthly plan isn't available right now.");
      return false;
    }
    return purchasePackage(monthlyPackage);
  }, [monthlyPackage, purchasePackage]);

  const purchaseAnnual = useCallback(async () => {
    if (!annualPackage) {
      Alert.alert("Plan unavailable", "Annual plan isn't available right now.");
      return false;
    }
    return purchasePackage(annualPackage);
  }, [annualPackage, purchasePackage]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!isRevenueCatAvailable()) return false;
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const restored = isProActive(info);
      Alert.alert(
        restored ? "Purchases restored" : "Nothing to restore",
        restored
          ? "Welcome back to Kew+."
          : "We couldn't find an active subscription on this Apple ID.",
      );
      return restored;
    } catch (e) {
      console.warn("[useSubscription] restore failed", e);
      Alert.alert("Restore failed", "Please try again in a moment.");
      return false;
    }
  }, []);

  const managementURL = customerInfo?.managementURL ?? null;

  const openManagement = useCallback(async () => {
    const url = managementURL || APPLE_SUBSCRIPTIONS_FALLBACK;
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn("[useSubscription] openManagement failed", e);
    }
  }, [managementURL]);

  return {
    isPro: isProActive(customerInfo),
    isLoading,
    offerings,
    currentOffering,
    monthlyPackage,
    annualPackage,
    managementURL,
    purchaseMonthly,
    purchaseAnnual,
    purchasePackage,
    restorePurchases,
    openManagement,
    refresh,
  };
}
