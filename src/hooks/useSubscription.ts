import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
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
      // PurchasesError has userCancelled + code fields. A user cancel is not
      // a failure — return false silently so the consumer doesn't surface an
      // error banner. Any other failure throws so the consumer can render
      // its own feedback (per DESIGN_SYSTEM §10, ErrorBanner is the canonical
      // persistent-failure surface).
      if (e?.userCancelled) return false;
      const code = e?.code as PURCHASES_ERROR_CODE | undefined;
      if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
      console.warn("[useSubscription] purchase failed", e);
      throw e;
    }
  }, []);

  const currentOffering = offerings?.current ?? null;
  const monthlyPackage = currentOffering?.monthly ?? null;
  const annualPackage = currentOffering?.annual ?? null;

  const purchaseMonthly = useCallback(async () => {
    if (!monthlyPackage) {
      throw new Error("Monthly plan isn't available right now.");
    }
    return purchasePackage(monthlyPackage);
  }, [monthlyPackage, purchasePackage]);

  const purchaseAnnual = useCallback(async () => {
    if (!annualPackage) {
      throw new Error("Annual plan isn't available right now.");
    }
    return purchasePackage(annualPackage);
  }, [annualPackage, purchasePackage]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!isRevenueCatAvailable()) return false;
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return isProActive(info);
    } catch (e) {
      console.warn("[useSubscription] restore failed", e);
      throw e;
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
