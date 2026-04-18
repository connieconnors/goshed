"use client";

import { useState, useEffect, useCallback } from "react";
import { MOMENT_COPY } from "@/lib/momentCopy";
import { useAuthSession } from "@/lib/auth-session-context";
import { Purchases } from "@revenuecat/purchases-js";
import type { Package, Offerings } from "@revenuecat/purchases-js";

type PaywallModalProps = {
  open: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
  itemCount?: number;
};

const API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY ?? "";

/** Shown when RevenueCat cannot offer web purchases (no key, load failure, or no packages). */
const WEB_SUBSCRIPTIONS_FALLBACK =
  "Subscriptions are coming soon — have a code? Enter it below.";

export function PaywallModal({
  open,
  onClose,
  onPurchaseSuccess,
  itemCount: _itemCount = 20,
}: PaywallModalProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<Package | null>(null);
  const [yearlyPackage, setYearlyPackage] = useState<Package | null>(null);
  /** When set, show this instead of RevenueCat (e.g. not signed in). */
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansSettled, setPlansSettled] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
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
      setStatusMessage(null);
      setPlansLoading(false);
      setPlansSettled(false);
      setPurchaseError(null);
      setShowPromoInput(false);
      setPromoCode("");
      setPromoError(null);
      setPromoSuccess(null);
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
      setStatusMessage(null);
      setMonthlyPackage(null);
      setYearlyPackage(null);
      setPurchaseError(null);

      const snap = await refresh();
      const uid = snap.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);

      if (!uid) {
        setStatusMessage("Sign in to subscribe.");
        finish();
        return;
      }

      if (!API_KEY.trim()) {
        setShowPromoInput(true);
        finish();
        return;
      }

      const ok = await ensureConfigured(uid);
      if (cancelled) return;
      if (!ok) {
        setShowPromoInput(true);
        finish();
        return;
      }

      const timeoutId = setTimeout(() => {
        if (cancelled) return;
        setMonthlyPackage(null);
        setYearlyPackage(null);
        setShowPromoInput(true);
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
        setMonthlyPackage(monthly);
        setYearlyPackage(yearly);
        if (!monthly && !yearly) {
          setShowPromoInput(true);
        }
      } catch {
        clearTimeout(timeoutId);
        if (cancelled) return;
        setMonthlyPackage(null);
        setYearlyPackage(null);
        setShowPromoInput(true);
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

  useEffect(() => {
    if (open && userId && plansSettled && !(monthlyPackage || yearlyPackage)) {
      setShowPromoInput(true);
    }
  }, [open, userId, plansSettled, monthlyPackage, yearlyPackage]);

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

  if (!open) return null;

  const signedIn = !!userId;
  const hasRcPackages = !!(monthlyPackage || yearlyPackage);
  const showNativePurchaseButtons = signedIn && plansSettled && hasRcPackages;
  const showWebFallback = signedIn && plansSettled && !hasRcPackages;

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
          {MOMENT_COPY.paywallTitle}
        </h2>
        <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 24 }}>
          Keep going for $2.99 a month — or $24.99 for the year.
        </p>

        {plansLoading && signedIn && (
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 16 }}>Loading plans…</p>
        )}

        {!signedIn && plansSettled && statusMessage ? (
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 16 }}>{statusMessage}</p>
        ) : null}

        {showWebFallback && !plansLoading ? (
          <p
            style={{
              color: "var(--ink)",
              fontSize: 15,
              lineHeight: 1.55,
              marginBottom: 20,
              padding: "14px 16px",
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--surface2)",
            }}
          >
            {WEB_SUBSCRIPTIONS_FALLBACK}
          </p>
        ) : null}

        {showNativePurchaseButtons ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                disabled={!yearlyPackage || purchasing}
                onClick={() => handlePurchase(yearlyPackage)}
                className="goshed-primary-btn"
                style={{ width: "100%", justifyContent: "center", padding: "14px 20px" }}
              >
                {purchasing ? "Processing…" : "Get the year — $24.99"}
              </button>
              <button
                type="button"
                disabled={!monthlyPackage || purchasing}
                onClick={() => handlePurchase(monthlyPackage)}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--surface2)",
                  borderRadius: 12,
                  fontSize: 16,
                  cursor: monthlyPackage && !purchasing ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                {purchasing ? "Processing…" : "Continue — $2.99/month"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
              Cancel anytime.
            </p>
          </>
        ) : null}

        {purchaseError && (
          <p style={{ color: "#c00", fontSize: 14, marginTop: 10 }}>{purchaseError}</p>
        )}

        {showNativePurchaseButtons && !showPromoInput ? (
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

        {(showPromoInput || showWebFallback) && (
          <div style={{ marginTop: showNativePurchaseButtons ? 14 : 0 }}>
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
        )}
      </div>
    </div>
  );
}
