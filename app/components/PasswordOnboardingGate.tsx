"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth-session-context";
import { addEmailWithPassword } from "@/lib/authPasswordHint";

/** Set `true` to bypass the password onboarding modal (e.g. debugging header navigation). */
const DISABLE_PASSWORD_ONBOARDING_GATE = false;

/**
 * After first magic-link sign-in, prompts for a password or skip based on public.users
 * (has_password_set, skipped_password_at) via GET /api/auth/password-onboarding-eligible.
 */
export function PasswordOnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { user, loading, refresh } = useAuthSession();
  /** Full-screen gate must not cover sign-in entry routes or users cannot click anything. */
  const isAuthEntryRoute =
    pathname === "/login" || pathname === "/set-password" || pathname.startsWith("/auth/");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  /** Opt-in to nudges; pre-checked, saved with password or skip. */
  const [notificationConsent, setNotificationConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** null = eligibility not loaded yet; do not show the modal during this state. */
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);

  useEffect(() => {
    if (isAuthEntryRoute || !user) {
      setEligible(null);
      setEligibleLoading(false);
      return;
    }
    if (loading) {
      setEligible(null);
      setEligibleLoading(false);
      return;
    }
    let cancelled = false;
    setEligibleLoading(true);
    setEligible(null);
    fetch("/api/auth/password-onboarding-eligible", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { eligible?: unknown }) => {
        if (cancelled) return;
        setEligible(d.eligible === true);
      })
      .catch(() => {
        if (!cancelled) setEligible(false);
      })
      .finally(() => {
        if (!cancelled) setEligibleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, isAuthEntryRoute]);

  useEffect(() => {
    if (eligible === true) setNotificationConsent(true);
  }, [eligible, user?.id]);

  const showGate =
    !isAuthEntryRoute &&
    !loading &&
    !eligibleLoading &&
    !!user &&
    eligible === true;

  useEffect(() => {
    console.log("[PasswordOnboardingGate] state (client)", {
      pathname,
      isAuthEntryRoute,
      loading,
      eligibleLoading,
      hasUser: !!user,
      userId: user?.id ?? null,
      eligible,
      showGate,
      hint: isAuthEntryRoute
        ? "Gate disabled on login/auth routes so buttons stay clickable."
        : showGate
          ? "Modal visible — complete password step or skip."
          : loading || eligibleLoading
            ? "Session or eligibility loading…"
            : !user
              ? "Not signed in."
              : "Onboarding complete or not applicable.",
    });
  }, [pathname, isAuthEntryRoute, loading, eligibleLoading, user, eligible, showGate]);

  const handleSetPassword = useCallback(async () => {
    setError(null);
    const p = password.trim();
    if (p.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (p !== confirm.trim()) {
      setError("Passwords don’t match.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.auth.updateUser({ password: p });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const pr = await fetch("/api/auth/password-set", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationConsent }),
      });
      if (!pr.ok) {
        const pb = await pr.json().catch(() => ({}));
        setError(typeof pb?.error === "string" ? pb.error : "Could not save password to your profile.");
        return;
      }
      const email = user?.email?.trim();
      if (email) addEmailWithPassword(email);
      setPassword("");
      setConfirm("");
      setEligible(false);
      let snap = await refresh();
      for (let i = 0; i < 3 && !snap.user; i++) {
        await new Promise((r) => setTimeout(r, 500));
        snap = await refresh();
      }
      console.log("[PasswordOnboarding] refresh() after set password", { welcomeSent: snap.welcomeSent, user: snap.user });
      router.replace("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }, [password, confirm, notificationConsent, user?.email, refresh, router]);

  const handleSkip = useCallback(async () => {
    console.log("[PasswordOnboarding] Skip for now clicked");
    setError(null);
    setSkipLoading(true);
    try {
      const res = await fetch("/api/auth/welcome-shown", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipPasswordOnboarding: true, notificationConsent }),
      });
      const body = await res.json().catch(() => ({}));
      console.log("[PasswordOnboarding] welcome-shown response (skip)", res.status, body);
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "Couldn’t skip right now. Try again.");
        return;
      }
      setEligible(false);
      const snap = await refresh();
      console.log("[PasswordOnboarding] refresh() after skip", { welcomeSent: snap.welcomeSent });
      router.replace("/");
      router.refresh();
    } finally {
      setSkipLoading(false);
    }
  }, [notificationConsent, refresh, router]);

  if (DISABLE_PASSWORD_ONBOARDING_GATE) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {showGate ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-onboarding-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(44, 36, 22, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              background: "var(--white)",
              borderRadius: 18,
              border: "1px solid var(--surface2)",
              boxShadow: "0 8px 32px rgba(44,36,22,0.12)",
              padding: "28px 24px",
            }}
          >
            <h2
              id="password-onboarding-title"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: 24,
                fontWeight: 600,
                color: "var(--ink)",
                margin: "0 0 8px",
                lineHeight: 1.25,
              }}
            >
              Set a password to protect your shed
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 0 20px" }}>
              You can always sign in with a link — a password lets you sign in faster on this device and keeps your list safer if someone else uses your email. Your first 20 items are free; you can subscribe later when you&apos;re ready.
            </p>
            {error ? (
              <p style={{ color: "#c0392b", fontSize: 14, margin: "0 0 12px" }}>{error}</p>
            ) : null}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 15,
                borderRadius: 10,
                border: "1px solid var(--soft)",
                marginBottom: 10,
                boxSizing: "border-box",
                background: "var(--white)",
                color: "var(--ink)",
              }}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 15,
                borderRadius: 10,
                border: "1px solid var(--soft)",
                marginBottom: 16,
                boxSizing: "border-box",
                background: "var(--white)",
                color: "var(--ink)",
              }}
            />
            <button
              type="button"
              onClick={handleSetPassword}
              disabled={submitting || skipLoading}
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 12,
                border: "none",
                background: "var(--ink)",
                color: "var(--white)",
                cursor: submitting || skipLoading ? "wait" : "pointer",
                opacity: submitting || skipLoading ? 0.85 : 1,
              }}
            >
              {submitting ? "Saving…" : "Set password"}
            </button>
            <label
              htmlFor="password-onboarding-notify-consent"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginTop: 14,
                marginBottom: 2,
                cursor: submitting || skipLoading ? "default" : "pointer",
                userSelect: "none",
              }}
            >
              <input
                id="password-onboarding-notify-consent"
                type="checkbox"
                checked={notificationConsent}
                onChange={(e) => setNotificationConsent(e.target.checked)}
                disabled={submitting || skipLoading}
                style={{
                  marginTop: 2,
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  accentColor: "var(--ink)",
                  cursor: submitting || skipLoading ? "not-allowed" : "pointer",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>
                Check in with me — I work better with a nudge.
              </span>
            </label>
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting || skipLoading}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 12,
                border: "1px solid var(--soft)",
                background: "var(--surface)",
                color: "var(--ink)",
                cursor: submitting || skipLoading ? "wait" : "pointer",
              }}
            >
              {skipLoading ? "…" : "Skip for now"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
