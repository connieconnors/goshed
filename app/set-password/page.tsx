"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth-session-context";
import { addEmailWithPassword } from "@/lib/authPasswordHint";

const LAST_LOGIN_EMAIL_KEY = "goshed_last_login_email";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser, loading: authSessionLoading, refresh: refreshAuthSession } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessionWaitTimedOut, setSessionWaitTimedOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentConfirmEmail, setSentConfirmEmail] = useState(false);

  const emailNorm = email.trim().toLowerCase();

  const redirectHome = useCallback(() => {
    const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("redirect_after_login") : null;
    if (stored) {
      sessionStorage.removeItem("redirect_after_login");
      router.replace(stored);
    } else {
      router.replace("/");
    }
    router.refresh();
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setSessionWaitTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || authSessionLoading || !sessionUser) return;
    redirectHome();
  }, [mounted, authSessionLoading, sessionUser, redirectHome]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const last = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (last && last.includes("@")) setEmail(last);
    const redirect = searchParams.get("redirect");
    if (redirect) sessionStorage.setItem("redirect_after_login", redirect);
  }, [mounted, searchParams]);

  const handleCreate = async () => {
    if (typeof window === "undefined" || !emailNorm.includes("@")) return;
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
      const { data, error: signErr } = await supabase.auth.signUp({
        email: emailNorm,
        password: p,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (signErr) {
        const msg = signErr.message?.toLowerCase() ?? "";
        if (msg.includes("already registered") || msg.includes("already been registered")) {
          setError("That email already has an account — sign in instead.");
        } else {
          setError(signErr.message || "Could not create account. Try again.");
        }
        return;
      }
      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, emailNorm);
      if (data.session) {
        const pr = await fetch("/api/auth/password-set", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationConsent }),
        });
        if (!pr.ok) {
          const pb = await pr.json().catch(() => ({}));
          setError(typeof pb?.error === "string" ? pb.error : "Account created but profile could not be saved. Try signing in.");
          return;
        }
        addEmailWithPassword(emailNorm);
        await refreshAuthSession();
        redirectHome();
        return;
      }
      setSentConfirmEmail(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const waitingOnAuthSession = mounted && authSessionLoading && !sessionWaitTimedOut;
  if (!mounted || waitingOnAuthSession) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <p style={{ color: "#666", fontSize: 16 }}>Checking session…</p>
      </div>
    );
  }

  if (sessionUser) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <p style={{ color: "#666", fontSize: 16 }}>You’re signed in — taking you to GoShed…</p>
      </div>
    );
  }

  if (sentConfirmEmail) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: "0 auto", fontFamily: "sans-serif", textAlign: "center" }}>
        <h2>Confirm your email ✉️</h2>
        <p style={{ color: "#444", lineHeight: 1.5 }}>
          We sent a link to <strong>{emailNorm}</strong>. Open it to finish setting up your account.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link href="/login" style={{ color: "#3d2e20", fontWeight: 500 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 400, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2
        style={{
          marginTop: 0,
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        Create a free account
      </h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
        Save your progress and view everything you&apos;ve cleared in your Shed.
      </p>
      <label
        htmlFor="set-password-notify-consent"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 14,
          cursor: submitting ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        <input
          id="set-password-notify-consent"
          type="checkbox"
          checked={notificationConsent}
          onChange={(e) => setNotificationConsent(e.target.checked)}
          disabled={submitting}
          style={{
            marginTop: 2,
            width: 16,
            height: 16,
            flexShrink: 0,
            accentColor: "var(--ink)",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        />
        <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>
          Check the box for an occasional nudge to keep clearing your shed.
        </span>
      </label>
      {error ? (
        <p style={{ color: "#c00", fontSize: 14, marginBottom: 12 }}>{error}</p>
      ) : null}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        autoComplete="email"
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: "1px solid #ddd",
          marginBottom: 12,
          boxSizing: "border-box",
        }}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (at least 6 characters)"
        autoComplete="new-password"
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: "1px solid #ddd",
          marginBottom: 12,
          boxSizing: "border-box",
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
          padding: 12,
          fontSize: 16,
          borderRadius: 8,
          border: "1px solid #ddd",
          marginBottom: 16,
          boxSizing: "border-box",
        }}
      />
      <button
        type="button"
        onClick={handleCreate}
        disabled={submitting || !emailNorm.includes("@") || !password.trim()}
        style={{
          width: "100%",
          padding: 12,
          background: submitting ? "#8a7a6a" : "#3d2e20",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          cursor: submitting ? "wait" : "pointer",
        }}
      >
        {submitting ? "Creating…" : "Create account"}
      </button>
      <p style={{ marginTop: 20, marginBottom: 0, textAlign: "center", fontSize: 13, lineHeight: 1.45 }}>
        <Link href="/login" style={{ color: "var(--ink-soft)", textDecoration: "underline" }}>
          Already have an account? Sign in →
        </Link>
      </p>
    </div>
  );
}

const fallback = (
  <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
    <p style={{ color: "#666", fontSize: 16 }}>Loading…</p>
  </div>
);

export default function SetPasswordPage() {
  return (
    <Suspense fallback={fallback}>
      <SetPasswordForm />
    </Suspense>
  );
}
