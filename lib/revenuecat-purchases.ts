"use client";

export type RevenueCatPlan = "monthly" | "annual";

export type NativeRevenueCatPackage = {
  identifier: string;
  packageType: string;
  productIdentifier: string;
  priceString: string | null;
  title: string | null;
  subscriptionPeriod: string | null;
  plan: RevenueCatPlan | null;
};

export type NativeRevenueCatOfferings = {
  currentOfferingIdentifier: string | null;
  allOfferingIdentifiers: string[];
  currentServerDescription: string | null;
  packages: NativeRevenueCatPackage[];
};

type BridgeAction = "getOfferings" | "purchase" | "restore";

type BridgeRequestPayload = {
  appUserID: string;
  plan?: RevenueCatPlan;
  packageIdentifier?: string;
};

type BridgeResponse<T> = {
  id: string;
  ok: boolean;
  data?: T;
  error?: string;
  userCancelled?: boolean;
};

const BRIDGE_MESSAGE_TYPE = "goshed-revenuecat";
const BRIDGE_RESPONSE_EVENT = "goshed-revenuecat-response";
const BRIDGE_TIMEOUT_MS = 20_000;

let activeNativeUserId: string | null = null;

export async function isNativeIosPurchasesAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return window.__GOSHED_NATIVE_PLATFORM === "ios" && typeof window.ReactNativeWebView?.postMessage === "function";
}

export function hasNativeIosRevenueCatKey(): boolean {
  return true;
}

export async function ensureNativeIosPurchasesConfigured(appUserID: string): Promise<boolean> {
  if (!(await isNativeIosPurchasesAvailable())) return false;
  activeNativeUserId = appUserID;
  return true;
}

export function resolveNativeSubscriptionPackage(
  offering: NativeRevenueCatOfferings | null,
  plan: RevenueCatPlan
): NativeRevenueCatPackage | null {
  if (!offering) return null;
  const want = plan === "monthly" ? "MONTHLY" : "ANNUAL";
  return (
    offering.packages.find((pkg) => pkg.plan === plan) ??
    offering.packages.find((pkg) => String(pkg.packageType).toUpperCase() === want) ??
    null
  );
}

export function summarizeNativeOfferings(offerings: NativeRevenueCatOfferings) {
  return {
    source: "react_native_ios_getOfferings_ok",
    currentOfferingIdentifier: offerings.currentOfferingIdentifier,
    allOfferingIdentifiers: offerings.allOfferingIdentifiers,
    currentAvailablePackageIdentifiers: offerings.packages.map((pkg) => pkg.identifier),
    currentProductIdentifiers: offerings.packages.map((pkg) => pkg.productIdentifier),
    currentServerDescription: offerings.currentServerDescription,
    resolvedMonthlySlot: offerings.packages.find((pkg) => pkg.plan === "monthly")?.identifier ?? null,
    resolvedAnnualSlot: offerings.packages.find((pkg) => pkg.plan === "annual")?.identifier ?? null,
    packageCountOnCurrent: offerings.packages.length,
  };
}

function sendBridgeRequest<T>(action: BridgeAction, payload: BridgeRequestPayload): Promise<T> {
  if (typeof window === "undefined" || !window.ReactNativeWebView?.postMessage) {
    return Promise.reject(new Error("Native billing is not available."));
  }
  const bridge = window.ReactNativeWebView;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse as EventListener);
      reject(new Error("Native billing took too long. Check your connection and try again."));
    }, BRIDGE_TIMEOUT_MS);

    const onResponse = (event: Event) => {
      const detail = (event as CustomEvent<BridgeResponse<T>>).detail;
      if (!detail || detail.id !== id) return;
      window.clearTimeout(timeoutId);
      window.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse as EventListener);
      if (detail.ok) {
        resolve(detail.data as T);
      } else {
        const err = new Error(detail.error || "Native billing failed.");
        (err as Error & { userCancelled?: boolean }).userCancelled = detail.userCancelled;
        reject(err);
      }
    };

    window.addEventListener(BRIDGE_RESPONSE_EVENT, onResponse as EventListener);
    bridge.postMessage(
      JSON.stringify({
        type: BRIDGE_MESSAGE_TYPE,
        id,
        action,
        payload,
      })
    );
  });
}

export async function getNativeIosOfferings(): Promise<NativeRevenueCatOfferings> {
  if (!activeNativeUserId) throw new Error("Sign in before loading native billing.");
  return sendBridgeRequest<NativeRevenueCatOfferings>("getOfferings", { appUserID: activeNativeUserId });
}

export async function purchaseNativeIosPackage(aPackage: NativeRevenueCatPackage): Promise<void> {
  if (!activeNativeUserId) throw new Error("Sign in before purchasing.");
  await sendBridgeRequest("purchase", {
    appUserID: activeNativeUserId,
    plan: aPackage.plan ?? undefined,
    packageIdentifier: aPackage.identifier,
  });
}

export async function restoreNativeIosPurchases(appUserID: string): Promise<void> {
  const configured = await ensureNativeIosPurchasesConfigured(appUserID);
  if (!configured) {
    throw new Error("Native billing is not available right now.");
  }
  await sendBridgeRequest("restore", { appUserID });
}

export function getNativePackagePriceLabel(pkg: NativeRevenueCatPackage | null): string | null {
  return pkg?.priceString?.trim() || null;
}

export function getNativePackageProductIdentifier(pkg: NativeRevenueCatPackage | null): string | null {
  return pkg?.productIdentifier ?? null;
}

export function revenueCatErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const maybe = err as { userCancelled?: unknown; code?: unknown; message?: unknown };
    if (maybe.userCancelled === true || maybe.code === "1") {
      return "Purchase canceled.";
    }
    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return maybe.message;
    }
  }
  return fallback;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    __GOSHED_NATIVE_PLATFORM?: string;
  }
}
