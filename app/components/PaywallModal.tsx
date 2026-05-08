"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { MOMENT_COPY } from "@/lib/momentCopy";
import { useAuthSession } from "@/lib/auth-session-context";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  ensureNativeIosPurchasesConfigured,
  getNativeIosOfferings,
  getNativePackagePriceLabel,
  getNativePackageProductIdentifier,
  hasNativeIosRevenueCatKey,
  isNativeIosPurchasesAvailable,
  purchaseNativeIosPackage,
  resolveNativeSubscriptionPackage,
  restoreNativeIosPurchases,
  revenueCatErrorMessage,
  summarizeNativeOfferings,
  type NativeRevenueCatPackage,
} from "@/lib/revenuecat-purchases";
import { PackageType, Purchases } from "@revenuecat/purchases-js";
import type { Offering, Package, Offerings } from "@revenuecat/purchases-js";

type PaywallModalProps = {
  open: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
  itemCount?: number;
  /** When true, title uses voluntary upgrade copy (footer Upgrade); limit-driven paywalls omit this. */
  voluntary?: boolean;
  /** After inline guest signup + sign-in, await before RevenueCat purchase (e.g. AI consent on home). */
  beforeGuestPurchase?: () => Promise<void>;
};

const WEB_API_KEY =
  process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_REVENUECAT_API_KEY?.trim() ||
  "";
const APPLE_STANDARD_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_POLICY_URL = "https://goshed.app/privacy";

type CheckoutPackage =
  | { source: "web"; plan: "monthly" | "annual"; webPackage: Package }
  | { source: "native-ios"; plan: "monthly" | "annual"; nativePackage: NativeRevenueCatPackage };

/** Modal-only safe padding (does not touch global layout freeze). */
const PAYWALL_OVERLAY_SAFE_PADDING: Pick<
  CSSProperties,
  "paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight"
> = {
  paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
  paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
  paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
  paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
};

/**
 * RevenueCat only fills `offering.monthly` / `offering.annual` when packages use the
 * standard $rc_monthly / $rc_annual identifiers. Custom package IDs still appear in
 * `availablePackages` with the right PackageType — use this so checkout works either way.
 */
function resolveSubscriptionPackage(offering: Offering | null, plan: "monthly" | "annual"): Package | null {
  if (!offering) return null;
  const fromSlot = plan === "monthly" ? offering.monthly : offering.annual;
  if (fromSlot) return fromSlot;
  const want = plan === "monthly" ? PackageType.Monthly : PackageType.Annual;
  const list = offering.availablePackages ?? [];
  return list.find((p) => p.packageType === want) ?? null;
}

/** Plain-object summary for console debugging (RevenueCat SDK objects are not always JSON-serializable). */
function summarizeOfferings(offerings: Offerings) {
  const all = offerings.all ?? {};
  const cur = offerings.current;
  const packages = cur?.availablePackages ?? [];
  return {
    currentOfferingIdentifier: cur?.identifier ?? null,
    allOfferingIdentifiers: Object.keys(all),
    currentAvailablePackageIdentifiers: packages.map((p) => p.identifier),
    currentServerDescription: cur?.serverDescription ?? null,
    resolvedMonthlySlot: cur?.monthly?.identifier ?? null,
    resolvedAnnualSlot: cur?.annual?.identifier ?? null,
    packageCountOnCurrent: packages.length,
  };
}

function checkoutPackageIdentifier(pkg: CheckoutPackage | null): string | null {
  if (!pkg) return null;
  if (pkg.source === "native-ios") return pkg.nativePackage.identifier;
  return pkg.webPackage.identifier;
}

function checkoutProductIdentifier(pkg: CheckoutPackage | null): string | null {
  if (!pkg) return null;
  if (pkg.source === "native-ios") return getNativePackageProductIdentifier(pkg.nativePackage);
  return pkg.webPackage.webBillingProduct?.identifier ?? pkg.webPackage.rcBillingProduct?.identifier ?? null;
}

function checkoutPriceLabel(pkg: CheckoutPackage | null): string | null {
  if (!pkg) return null;
  if (pkg.source === "native-ios") return getNativePackagePriceLabel(pkg.nativePackage);
  const product = pkg.webPackage.webBillingProduct ?? pkg.webPackage.rcBillingProduct;
  return product?.currentPrice?.formattedPrice ?? null;
}

function resetHorizontalViewport() {
  if (typeof window === "undefined") return;
  window.scrollTo({ left: 0, top: window.scrollY, behavior: "instant" });
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

export function PaywallModal({
  open,
  onClose,
  onPurchaseSuccess,
  voluntary = false,
  beforeGuestPurchase,
}: PaywallModalProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<CheckoutPackage | null>(null);
  const [yearlyPackage, setYearlyPackage] = useState<CheckoutPackage | null>(null);
  const [billingRuntime, setBillingRuntime] = useState<"web" | "native-ios">("web");
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansSettled, setPlansSettled] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasingPlan, setPurchasingPlan] = useState<"annual" | "monthly" | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  /** Guest tapped a price — collect email/password then purchase this plan. */
  const [guestSignupOpen, setGuestSignupOpen] = useState(false);
  const [guestPendingPlan, setGuestPendingPlan] = useState<"annual" | "monthly" | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestConfirmPassword, setGuestConfirmPassword] = useState("");
  const [guestSignupSubmitting, setGuestSignupSubmitting] = useState(false);
  const [guestSignupError, setGuestSignupError] = useState<string | null>(null);
  /** After Upgrade inline signup: nudge consent, then purchase (password gate is skipped). */
  const [upgradeNudgeModalOpen, setUpgradeNudgeModalOpen] = useState(false);
  const [upgradeNudgeConsentChecked, setUpgradeNudgeConsentChecked] = useState(false);
  const [upgradeNudgeSubmitting, setUpgradeNudgeSubmitting] = useState(false);
  const [upgradeNudgeError, setUpgradeNudgeError] = useState<string | null>(null);
  const pendingUpgradePlanRef = useRef<"annual" | "monthly" | null>(null);
  const pendingUpgradeUserIdRef = useRef<string | null>(null);
  /** Bumps to re-run RevenueCat offerings fetch (Try again). */
  const [offeringsRetryNonce, setOfferingsRetryNonce] = useState(0);
  /** User-visible reason when signed-in plans are missing or failed to load. */
  const [plansIssueMessage, setPlansIssueMessage] = useState<string | null>(null);
  /** Last RevenueCat offerings summary or fetch outcome (for paywall disabled diagnostics). */
  const lastOfferingsSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const { refresh } = useAuthSession();
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    resetHorizontalViewport();
  }, [open]);

  const retryPlansFetch = useCallback(() => {
    setPlansIssueMessage(null);
    setPurchaseError(null);
    setOfferingsRetryNonce((n) => n + 1);
  }, []);

  const ensureWebConfigured = useCallback(async (appUserId: string): Promise<boolean> => {
    if (!WEB_API_KEY) return false;
    try {
      if (Purchases.isConfigured()) {
        const current = Purchases.getSharedInstance();
        if (current.getAppUserId() !== appUserId) {
          await current.changeUser(appUserId);
        }
      } else {
        Purchases.configure({ apiKey: WEB_API_KEY, appUserId });
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadPackageForPlan = useCallback(
    async (uid: string, plan: "monthly" | "annual") => {
      if (await isNativeIosPurchasesAvailable()) {
        if (!hasNativeIosRevenueCatKey()) return null;
        const configured = await ensureNativeIosPurchasesConfigured(uid);
        if (!configured) return null;
        const offerings = await getNativeIosOfferings();
        const monthly = resolveNativeSubscriptionPackage(offerings, "monthly");
        const yearly = resolveNativeSubscriptionPackage(offerings, "annual");
        setBillingRuntime("native-ios");
        setMonthlyPackage(monthly ? { source: "native-ios", plan: "monthly", nativePackage: monthly } : null);
        setYearlyPackage(yearly ? { source: "native-ios", plan: "annual", nativePackage: yearly } : null);
        const selected = plan === "annual" ? yearly : monthly;
        return selected ? { source: "native-ios" as const, plan, nativePackage: selected } : null;
      }

      if (!WEB_API_KEY.trim()) return null;
      const configured = await ensureWebConfigured(uid);
      if (!configured) return null;
      const purchases = Purchases.getSharedInstance();
      const offerings: Offerings = await purchases.getOfferings();
      const curOffering = offerings.current;
      const monthly = resolveSubscriptionPackage(curOffering, "monthly");
      const yearly = resolveSubscriptionPackage(curOffering, "annual");
      setBillingRuntime("web");
      setMonthlyPackage(monthly ? { source: "web", plan: "monthly", webPackage: monthly } : null);
      setYearlyPackage(yearly ? { source: "web", plan: "annual", webPackage: yearly } : null);
      const selected = plan === "annual" ? yearly : monthly;
      return selected ? { source: "web" as const, plan, webPackage: selected } : null;
    },
    [ensureWebConfigured]
  );

  useEffect(() => {
    if (!open) {
      setUserId(null);
      setMonthlyPackage(null);
      setYearlyPackage(null);
      setPlansLoading(false);
      setPlansSettled(false);
      setPurchaseError(null);
      setPurchasing(false);
      setPurchasingPlan(null);
      setShowPromoInput(false);
      setPromoCode("");
      setPromoError(null);
      setPromoSuccess(null);
      setGuestSignupOpen(false);
      setGuestPendingPlan(null);
      setGuestEmail("");
      setGuestPassword("");
      setGuestConfirmPassword("");
      setGuestSignupSubmitting(false);
      setGuestSignupError(null);
      setUpgradeNudgeModalOpen(false);
      setUpgradeNudgeConsentChecked(false);
      setUpgradeNudgeSubmitting(false);
      setUpgradeNudgeError(null);
      pendingUpgradePlanRef.current = null;
      pendingUpgradeUserIdRef.current = null;
      setOfferingsRetryNonce(0);
      setPlansIssueMessage(null);
      setRestoreLoading(false);
      setRestoreMessage(null);
      return;
    }

    let cancelled = false;
    const OFFERINGS_TIMEOUT_MS = 10_000;

    const finish = () => {
      if (!cancelled) {
        setPlansSettled(true);
        setPlansLoading(false);
      }
    };

    const run = async () => {
      const useNativeIos = await isNativeIosPurchasesAvailable();
      if (!cancelled) setBillingRuntime(useNativeIos ? "native-ios" : "web");
      setPlansSettled(false);
      setPlansLoading(true);
      setMonthlyPackage(null);
      setYearlyPackage(null);
      setPurchaseError(null);
      setPlansIssueMessage(null);

      const snap = await refresh();
      const uid = snap.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);

      if (!uid) {
        lastOfferingsSnapshotRef.current = { reason: "not_signed_in" };
        finish();
        return;
      }

      if (snap.isPro) {
        setRestoreMessage("GoShed Pro is active on this account.");
        onPurchaseSuccess?.();
        window.setTimeout(() => onClose(), 900);
        finish();
        return;
      }

      if (useNativeIos && !hasNativeIosRevenueCatKey()) {
        lastOfferingsSnapshotRef.current = { reason: "missing_NEXT_PUBLIC_REVENUECAT_IOS_API_KEY" };
        console.warn("[PaywallModal] Native iOS billing key missing — set NEXT_PUBLIC_REVENUECAT_IOS_API_KEY", lastOfferingsSnapshotRef.current);
        setPlansIssueMessage("Subscription options aren’t available in this version of the app. Try again later or choose “Use an invite code” below.");
        finish();
        return;
      }

      if (!useNativeIos && !WEB_API_KEY.trim()) {
        lastOfferingsSnapshotRef.current = { reason: "missing_NEXT_PUBLIC_REVENUECAT_WEB_API_KEY" };
        console.warn("[PaywallModal] Billing key missing — set NEXT_PUBLIC_REVENUECAT_WEB_API_KEY", lastOfferingsSnapshotRef.current);
        setPlansIssueMessage("Subscription options aren’t available in this version of the app. Try again later or choose “Use an invite code” below.");
        finish();
        return;
      }

      const ok = useNativeIos
        ? await ensureNativeIosPurchasesConfigured(uid)
        : await ensureWebConfigured(uid);
      if (cancelled) return;
      if (!ok) {
        lastOfferingsSnapshotRef.current = { reason: useNativeIos ? "NativePurchases.configure_or_logIn_failed" : "Purchases.configure_or_changeUser_failed" };
        console.warn("[PaywallModal] RevenueCat configure failed:", lastOfferingsSnapshotRef.current);
        setPlansIssueMessage("Couldn’t connect to billing. Check your connection and tap Try again.");
        finish();
        return;
      }

      const timeoutId = setTimeout(() => {
        if (cancelled) return;
        lastOfferingsSnapshotRef.current = {
          reason: "getOfferings_timeout_ms",
          timeoutMs: OFFERINGS_TIMEOUT_MS,
          note: "Timed out before getOfferings resolved; monthly/yearly cleared",
        };
        console.warn("[PaywallModal] RevenueCat getOfferings timed out:", lastOfferingsSnapshotRef.current);
        setMonthlyPackage(null);
        setYearlyPackage(null);
        setPlansIssueMessage("Loading plans took too long. Check your connection, then tap Try again.");
        finish();
      }, OFFERINGS_TIMEOUT_MS);

      try {
        if (useNativeIos) {
          const offerings = await getNativeIosOfferings();
          clearTimeout(timeoutId);
          if (cancelled) return;
          const monthly = resolveNativeSubscriptionPackage(offerings, "monthly");
          const yearly = resolveNativeSubscriptionPackage(offerings, "annual");
          const summary = summarizeNativeOfferings(offerings);
          lastOfferingsSnapshotRef.current = {
            ...summary,
            annualPackageFound: !!yearly,
            monthlyPackageFound: !!monthly,
          };
          console.log("[PaywallModal] RevenueCat getOfferings:", lastOfferingsSnapshotRef.current);
          setMonthlyPackage(monthly ? { source: "native-ios", plan: "monthly", nativePackage: monthly } : null);
          setYearlyPackage(yearly ? { source: "native-ios", plan: "annual", nativePackage: yearly } : null);
          if (!monthly && !yearly) {
            console.warn("[PaywallModal] No monthly/annual package on current offering — check RC dashboard package types ($rc_monthly / $rc_annual or matching types).", summary);
            setPlansIssueMessage(
              process.env.NODE_ENV === "development"
                ? `No monthly/annual packages found. Current offering: ${summary.currentOfferingIdentifier ?? "none"}. Packages: ${summary.currentAvailablePackageIdentifiers.join(", ") || "none"}.`
                : "We couldn’t load subscription plans. Tap Try again, or choose “Use an invite code” if you have one."
            );
          } else {
            setPlansIssueMessage(null);
          }
          return;
        }

        const offerings = await Purchases.getSharedInstance().getOfferings();
        clearTimeout(timeoutId);
        if (cancelled) return;
        const current = offerings.current;
        const monthly = resolveSubscriptionPackage(current, "monthly");
        const yearly = resolveSubscriptionPackage(current, "annual");
        const summary = summarizeOfferings(offerings);
        lastOfferingsSnapshotRef.current = {
          ...summary,
          annualPackageFound: !!yearly,
          monthlyPackageFound: !!monthly,
        };
        console.log("[PaywallModal] RevenueCat getOfferings:", lastOfferingsSnapshotRef.current);
        setMonthlyPackage(monthly ? { source: "web", plan: "monthly", webPackage: monthly } : null);
        setYearlyPackage(yearly ? { source: "web", plan: "annual", webPackage: yearly } : null);
        if (!monthly && !yearly) {
          console.warn("[PaywallModal] No monthly/annual package on current offering — check RC dashboard package types ($rc_monthly / $rc_annual or matching types).", summary);
          setPlansIssueMessage(
            process.env.NODE_ENV === "development"
              ? `No monthly/annual packages found. Current offering: ${summary.currentOfferingIdentifier ?? "none"}. Packages: ${summary.currentAvailablePackageIdentifiers.join(", ") || "none"}.`
              : "We couldn’t load subscription plans. Tap Try again, or choose “Use an invite code” if you have one."
          );
        } else {
          setPlansIssueMessage(null);
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        lastOfferingsSnapshotRef.current = {
          source: "getOfferings_throw",
          errorMessage: message,
        };
        console.warn("[PaywallModal] getOfferings failed:", lastOfferingsSnapshotRef.current, err);
        setMonthlyPackage(null);
        setYearlyPackage(null);
        setPlansIssueMessage(
          process.env.NODE_ENV === "development"
            ? `RevenueCat getOfferings failed: ${message}`
            : "We couldn’t load subscription options. Check your connection, tap Try again, or choose “Use an invite code” below."
        );
      } finally {
        if (!cancelled) clearTimeout(timeoutId);
        finish();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, ensureWebConfigured, refresh, offeringsRetryNonce]);

  const handlePurchase = useCallback(
    async (pkg: CheckoutPackage | null) => {
      if (!pkg || purchasing) return;
      setPurchaseError(null);
      setPurchasing(true);
      setPurchasingPlan(pkg.plan);
      try {
        const snap = await refresh();
        if (snap.isPro) {
          setRestoreMessage("GoShed Pro is active on this account.");
          onPurchaseSuccess?.();
          window.setTimeout(() => onClose(), 900);
          return;
        }
        if (pkg.source === "native-ios") {
          await purchaseNativeIosPackage(pkg.nativePackage);
        } else {
          const purchases = Purchases.getSharedInstance();
          await purchases.purchase({ rcPackage: pkg.webPackage });
        }
        setPurchaseError(null);
        setRestoreMessage(null);
        onClose();
        onPurchaseSuccess?.();
      } catch (err: unknown) {
        const message = revenueCatErrorMessage(err, "Purchase failed. Try again.");
        if (message.toLowerCase().includes("still processing")) {
          const snap = await refresh();
          if (snap.isPro) {
            setPurchaseError(null);
            setRestoreMessage("GoShed Pro is active on this account.");
            onPurchaseSuccess?.();
            window.setTimeout(() => onClose(), 900);
            return;
          }
        }
        setPurchaseError(message);
      } finally {
        resetHorizontalViewport();
        setPurchasing(false);
        setPurchasingPlan(null);
      }
    },
    [purchasing, refresh, onClose, onPurchaseSuccess]
  );

  const completeGuestSignupAndPurchase = useCallback(async () => {
    const email = guestEmail.trim().toLowerCase();
    const password = guestPassword;
    const plan = guestPendingPlan;
    if (!email.includes("@")) {
      setGuestSignupError("Enter a valid email.");
      return;
    }
    if (password.trim().length < 6) {
      setGuestSignupError("Use at least 6 characters for your password.");
      return;
    }
    if (password.trim() !== guestConfirmPassword.trim()) {
      setGuestSignupError("Passwords don’t match.");
      return;
    }
    if (!plan) return;

    setGuestSignupError(null);
    setGuestSignupSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const res = await fetch("/api/auth/upgrade-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: password.trim() }),
      });
      const signupBody = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        code?: unknown;
      };

      const created = res.ok;
      const already =
        res.status === 409 && signupBody.code === "already_registered";
      if (!created && !already) {
        setGuestSignupError(
          typeof signupBody.error === "string" ? signupBody.error : "Could not create account."
        );
        return;
      }

      const { error: inErr } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });
      if (inErr) {
        setGuestSignupError(inErr.message || "Could not sign in. Check your password.");
        return;
      }

      if (created) {
        try {
          localStorage.setItem("goshed_ai_consent", "1");
        } catch {
          /* ignore */
        }
      }

      const snap = await refresh();
      const uid = snap.user?.id ?? null;
      if (!uid) {
        setGuestSignupError("Could not start your session. Try again or use the login page.");
        return;
      }

      setUserId(uid);
      pendingUpgradeUserIdRef.current = uid;
      pendingUpgradePlanRef.current = plan;
      setGuestSignupOpen(false);
      setGuestEmail("");
      setGuestPassword("");
      setGuestConfirmPassword("");
      setGuestPendingPlan(null);

      setUpgradeNudgeError(null);
      setUpgradeNudgeModalOpen(true);
    } finally {
      setGuestSignupSubmitting(false);
    }
  }, [
    guestEmail,
    guestPassword,
    guestConfirmPassword,
    guestPendingPlan,
    refresh,
  ]);

  const finishUpgradeNudgeAndPurchase = useCallback(async () => {
    const plan = pendingUpgradePlanRef.current;
    const uid = pendingUpgradeUserIdRef.current;
    if (!plan || !uid) {
      setUpgradeNudgeModalOpen(false);
      pendingUpgradePlanRef.current = null;
      pendingUpgradeUserIdRef.current = null;
      return;
    }
    setUpgradeNudgeSubmitting(true);
    setUpgradeNudgeError(null);
    try {
      const pr = await fetch("/api/auth/password-set", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationConsent: upgradeNudgeConsentChecked }),
      });
      const pb = await pr.json().catch(() => ({}));
      if (!pr.ok) {
        setUpgradeNudgeError(
          typeof pb?.error === "string" ? pb.error : "Couldn’t save your preference. Try again."
        );
        return;
      }

      try {
        await beforeGuestPurchase?.();
      } catch (err: unknown) {
        setUpgradeNudgeError(
          err instanceof Error
            ? err.message
            : "Create or sign in to your account so we can save your Shed before checkout."
        );
        return;
      }

      if (billingRuntime === "native-ios" && !hasNativeIosRevenueCatKey()) {
        setUpgradeNudgeError("Subscription checkout isn’t available in this version. Try again later.");
        return;
      }

      if (billingRuntime === "web" && !WEB_API_KEY.trim()) {
        setUpgradeNudgeError("Subscription checkout isn’t available in this version. Try again later.");
        return;
      }

      let pkg: CheckoutPackage | null;
      try {
        pkg = await loadPackageForPlan(uid, plan);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setUpgradeNudgeError(
          process.env.NODE_ENV === "development" ? `Could not load plans: ${message}` : "Could not load plans. Try again."
        );
        return;
      }
      if (!pkg) {
        setUpgradeNudgeError(
          "That plan couldn’t be loaded. Close this window and tap Try again on the subscription screen."
        );
        return;
      }

      pendingUpgradePlanRef.current = null;
      pendingUpgradeUserIdRef.current = null;
      setUpgradeNudgeModalOpen(false);
      await handlePurchase(pkg);
    } finally {
      setUpgradeNudgeSubmitting(false);
    }
  }, [upgradeNudgeConsentChecked, beforeGuestPurchase, billingRuntime, loadPackageForPlan, handlePurchase]);

  const handleApplyPromo = useCallback(async () => {
    const code = promoCode.trim();
    if (!code || promoLoading) return;
    setPromoError(null);
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promo-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPromoSuccess("You're in. Welcome to GoShed Pro 🌱");
        setTimeout(() => {
          onClose();
          onPurchaseSuccess?.();
          resetHorizontalViewport();
        }, 1500);
      } else {
        setPromoError("That code isn't valid — try again");
      }
    } catch {
      setPromoError("Something went wrong. Try again.");
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, promoLoading, onClose, onPurchaseSuccess]);

  /** When signed-in paywall buttons render disabled, log RevenueCat snapshot + flags (see red disabled state in devtools). */
  useEffect(() => {
    if (!open || !userId || !plansSettled || plansLoading) return;
    const yearDisabled = purchasing || !yearlyPackage;
    const monthDisabled = purchasing || !monthlyPackage;
    if (!yearDisabled && !monthDisabled) return;
    console.warn("[PaywallModal] Purchase button(s) disabled — diagnostic", {
      plansLoading,
      plansSettled,
      purchasing,
      annualPackageFound: !!yearlyPackage,
      monthlyPackageFound: !!monthlyPackage,
      billingRuntime,
      yearlyPackageIdentifier: checkoutPackageIdentifier(yearlyPackage),
      monthlyPackageIdentifier: checkoutPackageIdentifier(monthlyPackage),
      yearlyProductIdentifier: checkoutProductIdentifier(yearlyPackage),
      monthlyProductIdentifier: checkoutProductIdentifier(monthlyPackage),
      lastRevenueCatSnapshot: lastOfferingsSnapshotRef.current,
    });
  }, [open, userId, plansSettled, plansLoading, yearlyPackage, monthlyPackage, purchasing, billingRuntime]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (purchasing || guestSignupSubmitting || upgradeNudgeSubmitting) return;
      if (guestSignupOpen) {
        setGuestSignupOpen(false);
        setGuestPendingPlan(null);
        setGuestSignupError(null);
        setGuestPassword("");
        setGuestConfirmPassword("");
        return;
      }
      if (upgradeNudgeModalOpen) {
        pendingUpgradePlanRef.current = null;
        pendingUpgradeUserIdRef.current = null;
        setUpgradeNudgeModalOpen(false);
        setUpgradeNudgeError(null);
        return;
      }
      if (voluntary) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    open,
    purchasing,
    guestSignupSubmitting,
    upgradeNudgeSubmitting,
    guestSignupOpen,
    upgradeNudgeModalOpen,
    voluntary,
    onClose,
  ]);

  const handleRefreshSubscriptionStatus = useCallback(async () => {
    if (!userId || restoreLoading) return;
    setRestoreLoading(true);
    setRestoreMessage(null);
    try {
      if (billingRuntime === "native-ios") {
        await restoreNativeIosPurchases(userId);
      } else {
        if (!WEB_API_KEY.trim() || !Purchases.isConfigured()) {
          setRestoreMessage("Billing isn’t available right now. Try again later.");
          return;
        }
        const purchases = Purchases.getSharedInstance();
        await purchases.getCustomerInfo();
      }
      const snap = await refresh();
      if (snap.isPro) {
        setRestoreMessage("GoShed Pro is active on this account.");
        onPurchaseSuccess?.();
        window.setTimeout(() => onClose(), 900);
      } else {
        setRestoreMessage("No active subscription found for this account yet.");
      }
    } catch {
      setRestoreMessage("Couldn’t refresh status. Try again.");
    } finally {
      setRestoreLoading(false);
    }
  }, [userId, restoreLoading, billingRuntime, refresh, onPurchaseSuccess, onClose]);

  if (!open) return null;

  const signedIn = !!userId;
  const canDismiss = voluntary;
  const showPlansSpinner = signedIn && (plansLoading || !plansSettled);
  const showPurchaseRow = plansSettled && !showPlansSpinner;

  const onYearClick = () => {
    if (!signedIn) {
      setGuestPendingPlan("annual");
      setGuestSignupOpen(true);
      setGuestSignupError(null);
      setUpgradeNudgeConsentChecked(false);
      setGuestConfirmPassword("");
      return;
    }
    void handlePurchase(yearlyPackage);
  };

  const onMonthClick = () => {
    if (!signedIn) {
      setGuestPendingPlan("monthly");
      setGuestSignupOpen(true);
      setGuestSignupError(null);
      setUpgradeNudgeConsentChecked(false);
      setGuestConfirmPassword("");
      return;
    }
    void handlePurchase(monthlyPackage);
  };

  const yearDisabled = purchasing || !yearlyPackage;
  const monthDisabled = purchasing || !monthlyPackage;
  const signedInPlansMissing =
    signedIn && showPurchaseRow && !purchasing && !yearlyPackage && !monthlyPackage;
  const yearlyPriceLabel = checkoutPriceLabel(yearlyPackage);
  const monthlyPriceLabel = checkoutPriceLabel(monthlyPackage);
  const yearlyCtaPrice = yearlyPriceLabel ? `${yearlyPriceLabel}/year` : "$24.99/year";
  const monthlyCtaPrice = monthlyPriceLabel ? `${monthlyPriceLabel}/month` : "$2.99/month";
  const planSummary =
    !signedIn
      ? "Create or sign in to your account first so your Shed is saved before checkout."
      : yearlyPriceLabel && monthlyPriceLabel
      ? `Keep going for ${monthlyPriceLabel} a month — or ${yearlyPriceLabel} for the year.`
      : "Choose a plan to keep going with unlimited items.";
  const restoreDisabled =
    restoreLoading ||
    purchasing ||
    (billingRuntime === "native-ios" ? !hasNativeIosRevenueCatKey() : !WEB_API_KEY.trim());

  return (
    <div
      className="goshed-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...PAYWALL_OVERLAY_SAFE_PADDING,
        background: "rgba(44,36,22,0.44)",
      }}
      onClick={(e) => {
        if (canDismiss && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="goshed-modal-card"
        style={{
          position: "relative",
          background: "var(--white)",
          borderRadius: 22,
          padding: "24px 22px 22px",
          maxWidth: 360,
          width: "100%",
          maxHeight: "min(520px, calc(100dvh - 32px))",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          border: "1px solid rgba(196,168,130,0.32)",
          boxShadow: "0 18px 54px rgba(44,36,22,0.18)",
          fontFamily: "var(--font-body)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            if (canDismiss) onClose();
          }}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            background: "none",
            border: "none",
            color: "rgba(107, 91, 69, 0.78)",
            fontSize: 20,
            lineHeight: 1,
            cursor: canDismiss ? "pointer" : "default",
            fontFamily: "inherit",
            visibility: canDismiss ? "visible" : "hidden",
          }}
        >
          ×
        </button>
        <p
          style={{
            margin: "0 32px 8px",
            textAlign: "center",
            color: "var(--accent)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
          }}
        >
          GoShed Pro
        </p>
        <h2
          id="paywall-title"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--ink)",
            margin: "0 28px 8px",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {voluntary ? MOMENT_COPY.paywallTitleVoluntary : MOMENT_COPY.paywallTitle}
        </h2>
        <p style={{ fontSize: 11.75, color: "var(--ink-soft)", lineHeight: 1.35, margin: "0 0 18px", textAlign: "center" }}>
          {planSummary}
        </p>

        {showPlansSpinner ? (
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 16 }}>Loading plans…</p>
        ) : null}

        {purchaseError && (
          <p style={{ color: "#c00", fontSize: 14, marginBottom: 12 }}>{purchaseError}</p>
        )}

        {showPurchaseRow ? (
          <>
            {signedInPlansMissing ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: "14px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--surface2)",
                  background: "var(--surface1, #f8fafc)",
                }}
              >
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink)", lineHeight: 1.5 }}>
                  {plansIssueMessage ??
                    "We couldn’t load subscription options. Check your connection and tap Try again."}
                </p>
                <button
                  type="button"
                  onClick={() => retryPlansFetch()}
                  className="goshed-primary-btn"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "12px 16px",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <button
                  type="button"
                  disabled={signedIn ? yearDisabled : false}
                  onClick={onYearClick}
                  className="goshed-primary-btn"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "13px 20px",
                    minHeight: 48,
                    borderRadius: 14,
                    fontSize: 16,
                    boxShadow: "0 8px 18px rgba(94,113,85,0.18)",
                    cursor: signedIn && yearDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  {purchasingPlan === "annual" ? "Processing…" : `GoShed Pro Annual — ${yearlyCtaPrice}`}
                </button>
                <button
                  type="button"
                  disabled={signedIn ? monthDisabled : false}
                  onClick={onMonthClick}
                  style={{
                    width: "100%",
                    minHeight: 46,
                    padding: "12px 20px",
                    background: "rgba(245,240,232,0.62)",
                    color: "var(--ink)",
                    border: "1px solid rgba(196,168,130,0.58)",
                    borderRadius: 14,
                    fontSize: 15,
                    cursor: signedIn && monthDisabled ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {purchasingPlan === "monthly" ? "Processing…" : `GoShed Pro Monthly — ${monthlyCtaPrice}`}
                </button>
                {canDismiss ? (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={purchasing}
                    style={{
                      minHeight: 38,
                      padding: "6px 12px",
                      background: "transparent",
                      color: "rgba(107, 91, 69, 0.86)",
                      border: "none",
                      fontSize: 14,
                      cursor: purchasing ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Not now
                  </button>
                ) : null}
              </div>
            )}
            <p style={{ fontSize: 11, color: "rgba(107, 91, 69, 0.78)", margin: "10px 0 0", textAlign: "center", lineHeight: 1.45 }}>
              Cancel anytime.
            </p>
            <p style={{ fontSize: 10, color: "rgba(107, 91, 69, 0.54)", margin: "9px 4px 0", textAlign: "center", lineHeight: 1.38 }}>
              Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Payment is charged to your Apple ID, and you can manage or cancel in App Store account settings.{" "}
              <a href={APPLE_STANDARD_EULA_URL} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(107, 91, 69, 0.68)", textDecoration: "underline" }}>
                Terms of Use
              </a>
              {" · "}
              <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(107, 91, 69, 0.68)", textDecoration: "underline" }}>
                Privacy Policy
              </a>
            </p>
            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: "1px solid rgba(196,168,130,0.22)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 7,
              }}
            >
              {!showPromoInput ? (
                <button
                  type="button"
                  onClick={() => setShowPromoInput(true)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "rgba(107, 91, 69, 0.62)",
                    fontSize: 11.5,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    fontFamily: "inherit",
                  }}
                >
                  Have an invite code?
                </button>
              ) : null}
              {signedIn ? (
                <button
                  type="button"
                  disabled={restoreDisabled}
                  onClick={() => void handleRefreshSubscriptionStatus()}
                  aria-label="Restore purchases: sync subscription status with billing for this account"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "rgba(107, 91, 69, 0.62)",
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: restoreDisabled ? "not-allowed" : "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    fontFamily: "inherit",
                  }}
                >
                  {restoreLoading ? "Syncing purchases…" : "Already subscribed? Restore purchases"}
                </button>
              ) : (
                <a
                  href="/login?redirect=/account"
                  style={{
                    color: "rgba(107, 91, 69, 0.62)",
                    fontSize: 11.5,
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    fontFamily: "inherit",
                  }}
                >
                  Sign in to restore purchases
                </a>
              )}
            </div>
            {restoreMessage ? (
              <p style={{ fontSize: 11.5, color: "rgba(107, 91, 69, 0.68)", margin: "7px 0 0", textAlign: "center", lineHeight: 1.4 }}>
                {restoreMessage}
              </p>
            ) : null}
          </>
        ) : null}

        {showPromoInput ? (
          <div style={{ marginTop: showPurchaseRow ? 14 : 0 }}>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoError(null);
              }}
              placeholder="Enter code"
              disabled={promoLoading}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                border: "1px solid var(--surface2)",
                borderRadius: 10,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              disabled={promoLoading || !promoCode.trim()}
              onClick={handleApplyPromo}
              style={{
                padding: "8px 16px",
                background: "var(--ink-soft)",
                color: "var(--white)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                cursor: promoLoading ? "wait" : "pointer",
              }}
            >
              {promoLoading ? "Applying…" : "Apply"}
            </button>
            {promoError && (
              <p style={{ color: "#c00", fontSize: 13, marginTop: 8 }}>{promoError}</p>
            )}
            {promoSuccess && (
              <p style={{ color: "var(--green)", fontSize: 14, marginTop: 8 }}>{promoSuccess}</p>
            )}
          </div>
        ) : null}
      </div>

      {guestSignupOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...PAYWALL_OVERLAY_SAFE_PADDING,
            background: "rgba(44,36,22,0.35)",
          }}
          onClick={() => {
            if (!guestSignupSubmitting) {
              setGuestSignupOpen(false);
              setGuestPendingPlan(null);
              setGuestSignupError(null);
              setGuestPassword("");
              setGuestConfirmPassword("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-paywall-signup-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              maxHeight: "min(520px, calc(100dvh - 32px))",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: "var(--white)",
              borderRadius: 16,
              padding: "22px 20px",
              border: "1px solid var(--surface2)",
              boxShadow: "0 12px 40px rgba(44,36,22,0.18)",
            }}
          >
            <h3
              id="guest-paywall-signup-title"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 20,
                fontWeight: 600,
                color: "var(--ink)",
                margin: "0 0 6px",
              }}
            >
              Create account to continue
            </h3>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.45, margin: "0 0 14px" }}>
              We’ll save your Shed to this account before checkout starts.
            </p>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => {
                setGuestEmail(e.target.value);
                setGuestSignupError(null);
              }}
              placeholder="Email"
              autoComplete="email"
              disabled={guestSignupSubmitting}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 15,
                border: "1px solid var(--surface2)",
                borderRadius: 10,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />
            <input
              type="password"
              value={guestPassword}
              onChange={(e) => {
                setGuestPassword(e.target.value);
                setGuestSignupError(null);
              }}
              placeholder="Password (min 6 characters)"
              autoComplete="new-password"
              disabled={guestSignupSubmitting}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 15,
                border: "1px solid var(--surface2)",
                borderRadius: 10,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />
            <input
              type="password"
              value={guestConfirmPassword}
              onChange={(e) => {
                setGuestConfirmPassword(e.target.value);
                setGuestSignupError(null);
              }}
              placeholder="Confirm password"
              autoComplete="new-password"
              disabled={guestSignupSubmitting}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 15,
                border: "1px solid var(--surface2)",
                borderRadius: 10,
                marginBottom: 14,
                boxSizing: "border-box",
              }}
            />
            <label
              htmlFor="guest-signup-nudge-consent"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 14,
                cursor: guestSignupSubmitting ? "not-allowed" : "pointer",
              }}
            >
              <input
                id="guest-signup-nudge-consent"
                type="checkbox"
                checked={upgradeNudgeConsentChecked}
                onChange={(e) => {
                  setUpgradeNudgeConsentChecked(e.target.checked);
                  setGuestSignupError(null);
                }}
                disabled={guestSignupSubmitting}
                style={{
                  marginTop: 2,
                  width: 14,
                  height: 14,
                  accentColor: "var(--ink)",
                  cursor: guestSignupSubmitting ? "not-allowed" : "pointer",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>
                Check the box for an occasional nudge to keep clearing your shed.
              </span>
            </label>
            {guestSignupError ? (
              <div style={{ marginBottom: 14 }}>
                <p style={{ color: "#c00", fontSize: 13, margin: "0 0 10px", lineHeight: 1.45 }}>
                  {guestSignupError}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <button
                    type="button"
                    disabled={guestSignupSubmitting}
                    onClick={() => setGuestSignupError(null)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: 13,
                      color: "var(--accent)",
                      cursor: guestSignupSubmitting ? "not-allowed" : "pointer",
                      textDecoration: "underline",
                      fontFamily: "inherit",
                    }}
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    disabled={guestSignupSubmitting}
                    onClick={() => {
                      setGuestSignupOpen(false);
                      setGuestPendingPlan(null);
                      setGuestSignupError(null);
                      setGuestPassword("");
                      setGuestConfirmPassword("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: 13,
                      color: "var(--ink-soft)",
                      cursor: guestSignupSubmitting ? "not-allowed" : "pointer",
                      textDecoration: "underline",
                      fontFamily: "inherit",
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              disabled={
                guestSignupSubmitting ||
                !guestEmail.trim().includes("@") ||
                guestPassword.trim().length < 6 ||
                guestConfirmPassword.trim().length < 6 ||
                guestPassword.trim() !== guestConfirmPassword.trim()
              }
              onClick={() => void completeGuestSignupAndPurchase()}
              className="goshed-primary-btn"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "12px 16px",
                fontSize: 15,
                fontWeight: 600,
                cursor: guestSignupSubmitting ? "wait" : "pointer",
              }}
            >
              {guestSignupSubmitting ? "Working…" : "Create account & continue"}
            </button>
          </div>
        </div>
      ) : null}

      {upgradeNudgeModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 65,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...PAYWALL_OVERLAY_SAFE_PADDING,
            background: "rgba(44,36,22,0.35)",
          }}
          onClick={() => {
            if (!upgradeNudgeSubmitting) {
              pendingUpgradePlanRef.current = null;
              pendingUpgradeUserIdRef.current = null;
              setUpgradeNudgeModalOpen(false);
              setUpgradeNudgeError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Occasional nudge preference"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              background: "var(--white)",
              borderRadius: 16,
              padding: "22px 20px",
              border: "1px solid var(--surface2)",
              boxShadow: "0 12px 40px rgba(44,36,22,0.18)",
            }}
          >
            <label
              htmlFor="upgrade-nudge-consent"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 14,
                cursor: upgradeNudgeSubmitting ? "default" : "pointer",
                userSelect: "none",
              }}
            >
              <input
                id="upgrade-nudge-consent"
                type="checkbox"
                checked={upgradeNudgeConsentChecked}
                onChange={(e) => {
                  setUpgradeNudgeConsentChecked(e.target.checked);
                  setUpgradeNudgeError(null);
                }}
                disabled={upgradeNudgeSubmitting}
                style={{
                  marginTop: 2,
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  accentColor: "var(--ink)",
                  cursor: upgradeNudgeSubmitting ? "not-allowed" : "pointer",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>
                Check the box for an occasional nudge to keep clearing your shed.
              </span>
            </label>
            {upgradeNudgeError ? (
              <p style={{ color: "#c00", fontSize: 13, margin: "0 0 12px", lineHeight: 1.45 }}>
                {upgradeNudgeError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={upgradeNudgeSubmitting}
              onClick={() => void finishUpgradeNudgeAndPurchase()}
              className="goshed-primary-btn"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "12px 16px",
                fontSize: 15,
                fontWeight: 600,
                cursor: upgradeNudgeSubmitting ? "wait" : "pointer",
              }}
            >
              {upgradeNudgeSubmitting ? "Working…" : "Continue"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
