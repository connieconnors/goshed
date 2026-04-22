"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MOMENT_COPY } from "@/lib/momentCopy";
import { useAuthSession } from "@/lib/auth-session-context";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Purchases } from "@revenuecat/purchases-js";
import type { Package, Offerings } from "@revenuecat/purchases-js";

type PaywallModalProps = {
  open: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
  itemCount?: number;
  /** When true, title uses voluntary upgrade copy (footer Upgrade); limit-driven paywalls omit this. */
  voluntary?: boolean;
};

const API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY ?? "";

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

export function PaywallModal({
  open,
  onClose,
  onPurchaseSuccess,
  itemCount: _itemCount = 20,
  voluntary = false,
}: PaywallModalProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<Package | null>(null);
  const [yearlyPackage, setYearlyPackage] = useState<Package | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansSettled, setPlansSettled] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
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
  /** Last RevenueCat offerings summary or fetch outcome (for paywall disabled diagnostics). */
  const lastOfferingsSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const { refresh } = useAuthSession();

  const ensureConfigured = useCallback(async (appUserId: string): Promise<boolean> => {
    if (!API_KEY) return false;
    try {
      if (Purchases.isConfigured()) {
        const current = Purchases.getSharedInstance();
        if (current.getAppUserId() !== appUserId) {
          await current.changeUser(appUserId);
        }
      } else {
        Purchases.configure({ apiKey: API_KEY, appUserId });
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setUserId(null);
      setMonthlyPackage(null);
      setYearlyPackage(null);
      setPlansLoading(false);
      setPlansSettled(false);
      setPurchaseError(null);
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
      setPlansSettled(false);
      setPlansLoading(true);
      setMonthlyPackage(null);
      setYearlyPackage(null);
      setPurchaseError(null);

      const snap = await refresh();
      const uid = snap.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);

      if (!uid) {
        lastOfferingsSnapshotRef.current = { reason: "not_signed_in" };
        finish();
        return;
      }

      if (!API_KEY.trim()) {
        lastOfferingsSnapshotRef.current = { reason: "missing_NEXT_PUBLIC_REVENUECAT_API_KEY" };
        console.warn("[PaywallModal] RevenueCat disabled:", lastOfferingsSnapshotRef.current);
        finish();
        return;
      }

      const ok = await ensureConfigured(uid);
      if (cancelled) return;
      if (!ok) {
        lastOfferingsSnapshotRef.current = { reason: "Purchases.configure_or_changeUser_failed" };
        console.warn("[PaywallModal] RevenueCat configure failed:", lastOfferingsSnapshotRef.current);
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
        finish();
      }, OFFERINGS_TIMEOUT_MS);

      try {
        const purchases = Purchases.getSharedInstance();
        const offerings: Offerings = await purchases.getOfferings();
        clearTimeout(timeoutId);
        if (cancelled) return;
        const current = offerings.current;
        const monthly = current?.monthly ?? null;
        const yearly = current?.annual ?? null;
        const summary = summarizeOfferings(offerings);
        lastOfferingsSnapshotRef.current = {
          source: "getOfferings_ok",
          ...summary,
          annualPackageFound: !!yearly,
          monthlyPackageFound: !!monthly,
        };
        console.log("[PaywallModal] RevenueCat getOfferings:", lastOfferingsSnapshotRef.current);
        setMonthlyPackage(monthly);
        setYearlyPackage(yearly);
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        lastOfferingsSnapshotRef.current = {
          source: "getOfferings_throw",
          errorMessage: message,
        };
        console.warn("[PaywallModal] RevenueCat getOfferings failed:", lastOfferingsSnapshotRef.current, err);
        setMonthlyPackage(null);
        setYearlyPackage(null);
      } finally {
        if (!cancelled) clearTimeout(timeoutId);
        finish();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, ensureConfigured, refresh]);

  const handlePurchase = useCallback(
    async (pkg: Package | null) => {
      if (!pkg || purchasing) return;
      setPurchaseError(null);
      setPurchasing(true);
      try {
        const purchases = Purchases.getSharedInstance();
        await purchases.purchase({ rcPackage: pkg });
        onClose();
        onPurchaseSuccess?.();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Purchase failed. Try again.";
        setPurchaseError(message);
      } finally {
        setPurchasing(false);
      }
    },
    [purchasing, onClose, onPurchaseSuccess]
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

      const snap = await refresh();
      const uid = snap.user?.id ?? null;
      if (!uid) {
        setGuestSignupError("Could not start your session. Try again or use the login page.");
        return;
      }

      void fetch("/api/auth/password-set", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});

      if (!API_KEY.trim()) {
        setGuestSignupError("Subscriptions are not available in this build.");
        return;
      }

      const configured = await ensureConfigured(uid);
      if (!configured) {
        setGuestSignupError("Could not connect billing. Try again.");
        return;
      }

      const purchases = Purchases.getSharedInstance();
      let offerings: Offerings;
      try {
        offerings = await purchases.getOfferings();
      } catch {
        setGuestSignupError("Could not load plans. Try again.");
        return;
      }

      const pkg =
        plan === "annual" ? (offerings.current?.annual ?? null) : (offerings.current?.monthly ?? null);
      if (!pkg) {
        setGuestSignupError("That plan is not available right now. Try again.");
        return;
      }

      setUserId(uid);
      setMonthlyPackage(offerings.current?.monthly ?? null);
      setYearlyPackage(offerings.current?.annual ?? null);
      setGuestSignupOpen(false);
      setGuestEmail("");
      setGuestPassword("");
      setGuestConfirmPassword("");
      setGuestPendingPlan(null);

      await handlePurchase(pkg);
    } finally {
      setGuestSignupSubmitting(false);
    }
  }, [
    guestEmail,
    guestPassword,
    guestConfirmPassword,
    guestPendingPlan,
    refresh,
    ensureConfigured,
    handlePurchase,
  ]);

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
      yearlyPackageIdentifier: yearlyPackage?.identifier ?? null,
      monthlyPackageIdentifier: monthlyPackage?.identifier ?? null,
      lastRevenueCatSnapshot: lastOfferingsSnapshotRef.current,
    });
  }, [open, userId, plansSettled, plansLoading, yearlyPackage, monthlyPackage, purchasing]);

  if (!open) return null;

  const signedIn = !!userId;
  const showPlansSpinner = signedIn && (plansLoading || !plansSettled);
  const showPurchaseRow = plansSettled && !showPlansSpinner;

  const onYearClick = () => {
    if (!signedIn) {
      setGuestPendingPlan("annual");
      setGuestSignupOpen(true);
      setGuestSignupError(null);
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
      setGuestConfirmPassword("");
      return;
    }
    void handlePurchase(monthlyPackage);
  };

  const yearDisabled = purchasing || !yearlyPackage;
  const monthDisabled = purchasing || !monthlyPackage;

  return (
    <div
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
        padding: 24,
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          position: "relative",
          background: "var(--white)",
          borderRadius: 18,
          padding: 28,
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 8px 32px rgba(44,36,22,0.15)",
          fontFamily: "var(--font-body)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            background: "none",
            border: "none",
            color: "var(--ink-soft)",
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
        <h2
          id="paywall-title"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--ink)",
            marginTop: 0,
            marginBottom: 12,
          }}
        >
          {voluntary ? MOMENT_COPY.paywallTitleVoluntary : MOMENT_COPY.paywallTitle}
        </h2>
        <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 24 }}>
          Keep going for $2.99 a month — or $24.99 for the year.
        </p>

        {showPlansSpinner ? (
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 16 }}>Loading plans…</p>
        ) : null}

        {purchaseError && (
          <p style={{ color: "#c00", fontSize: 14, marginBottom: 12 }}>{purchaseError}</p>
        )}

        {showPurchaseRow ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                disabled={signedIn ? yearDisabled : false}
                onClick={onYearClick}
                className="goshed-primary-btn"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "14px 20px",
                  cursor: signedIn && yearDisabled ? "not-allowed" : "pointer",
                }}
              >
                {purchasing ? "Processing…" : "Get the year — $24.99"}
              </button>
              <button
                type="button"
                disabled={signedIn ? monthDisabled : false}
                onClick={onMonthClick}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--surface2)",
                  borderRadius: 12,
                  fontSize: 16,
                  cursor: signedIn && monthDisabled ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {purchasing ? "Processing…" : "Continue — $2.99/month"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
              Cancel anytime.
            </p>
            {!showPromoInput ? (
              <button
                type="button"
                onClick={() => setShowPromoInput(true)}
                style={{
                  marginTop: 14,
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--ink-soft)",
                  fontSize: 14,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Have a code?
              </button>
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
            padding: 16,
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
              {guestPendingPlan === "annual" ? "Annual plan" : "Monthly plan"} — no email link; use a password you&apos;ll remember.
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
    </div>
  );
}
