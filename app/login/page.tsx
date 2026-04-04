"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AuthResponse } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getEmailsWithPassword } from "@/lib/authPasswordHint";

const LAST_LOGIN_EMAIL_KEY = "goshed_last_login_email";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [invalidPasswordRecovery, setInvalidPasswordRecovery] = useState(false);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const emailNorm = email.trim().toLowerCase();
  const showPasswordSignIn =
    mounted && emailNorm.length > 0 && getEmailsWithPassword().includes(emailNorm);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    let cancelled = false;
    const slow = setTimeout(() => {
      if (!cancelled) {
        console.warn("[login] getSession still pending after 6s — showing form so UI is not stuck");
        setCheckingSession(false);
      }
    }, 6000);
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (e) {
      clearTimeout(slow);
      console.error("[login] createSupabaseBrowserClient failed — check NEXT_PUBLIC_SUPABASE_* in .env.local", e);
      setCheckingSession(false);
      return () => {
        cancelled = true;
      };
    }
    supabase.auth
      .getSession()
      .then((result: AuthResponse) => {
        if (cancelled) return;
        clearTimeout(slow);
        const session = result.data.session;
        if (session) {
          const stored = sessionStorage.getItem("redirect_after_login");
          if (stored) {
            sessionStorage.removeItem("redirect_after_login");
            router.replace(stored);
          } else {
            router.replace("/");
          }
          router.refresh();
        } else {
          setCheckingSession(false);
        }
      })
      .catch((err: unknown) => {
        clearTimeout(slow);
        console.error("[login] getSession failed", err);
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const last = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (last && last.includes("@")) setEmail(last);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window !== "undefined" && searchParams.get("error") === "auth") setAuthError(true);
  }, [mounted, searchParams]);

  const redirectAfterLogin = () => {
    const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("redirect_after_login") : null;
    if (stored) {
      sessionStorage.removeItem("redirect_after_login");
      router.replace(stored);
    } else {
      router.replace("/");
    }
    router.refresh();
  };

  const sendMagicLink = async () => {
    if (typeof window === "undefined" || !emailNorm.includes("@")) return;
    setSendError(null);
    setInvalidPasswordRecovery(false);
    setSending(true);
    const redirect = searchParams.get("redirect");
    if (redirect) sessionStorage.setItem("redirect_after_login", redirect);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: emailNorm,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (!error) {
      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, emailNorm);
      setSent(true);
      return;
    }
    const isRateLimit =
      error.message?.toLowerCase().includes("rate limit") ||
      (error as { status?: number }).status === 429;
    setSendError(
      isRateLimit
        ? "Too many sign-in attempts. Please wait about an hour, then try again."
        : error.message || "Could not send link. Try again."
    );
  };

  const handleSendMeALink = async () => {
    await sendMagicLink();
  };

  const handleSignInWithPassword = async () => {
    if (typeof window === "undefined" || !emailNorm.includes("@") || !password.trim()) return;
    setSendError(null);
    setInvalidPasswordRecovery(false);
    setSending(true);
    const redirect = searchParams.get("redirect");
    if (redirect) sessionStorage.setItem("redirect_after_login", redirect);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: emailNorm, password });
    setSending(false);
    if (error) {
      const isInvalidCreds =
        error.message?.toLowerCase().includes("invalid login credentials") ||
        error.message?.toLowerCase().includes("invalid credentials");
      if (isInvalidCreds) {
        setInvalidPasswordRecovery(true);
        setSendError(null);
      } else {
        setSendError(error.message || "Invalid email or password.");
      }
      return;
    }
    setInvalidPasswordRecovery(false);
    localStorage.setItem(LAST_LOGIN_EMAIL_KEY, emailNorm);
    redirectAfterLogin();
  };

  const handleSendLinkInstead = async () => {
    setPassword("");
    setInvalidPasswordRecovery(false);
    await sendMagicLink();
  };

  if (checkingSession) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <p style={{ color: "#666", fontSize: 16 }}>Checking session…</p>
      </div>
    );
  }

  if (sent) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Check your email ✉️</h2>
        <p>Check your email — we sent you a link to sign in.</p>
        <p style={{ color: "#888", fontSize: 14 }}>
          We sent it to <strong>{email}</strong>. Tap the link to sign in.
        </p>
        <p style={{ color: "#888", fontSize: 13, marginTop: 12 }}>
          Can&apos;t find it? Check spam, or wait a minute and try again.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 400,
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <h2>Sign in to GoShed</h2>
      {authError && (
        <p style={{ color: "#c00", fontSize: 14, marginBottom: 12 }}>
          That link expired. Want a new one?
        </p>
      )}
      {invalidPasswordRecovery && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "#fff8f0",
            borderRadius: 8,
            border: "1px solid #e8d5c4",
          }}
        >
          <p style={{ color: "#8a5a2d", fontSize: 14, margin: 0 }}>
            Wrong password — or forgot it? We&apos;ll email you a sign-in link.
          </p>
          <button
            type="button"
            onClick={handleSendLinkInstead}
            disabled={sending}
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              padding: 0,
              color: "#3d2e20",
              textDecoration: "underline",
              cursor: sending ? "wait" : "pointer",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            {sending ? "Sending…" : "Send me a link instead"}
          </button>
        </div>
      )}
      {sendError && (
        <p style={{ color: "#c00", fontSize: 14, marginBottom: 12 }}>
          {sendError}
        </p>
      )}

      <input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setInvalidPasswordRecovery(false);
        }}
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

      {showPasswordSignIn ? (
        <>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setInvalidPasswordRecovery(false);
            }}
            placeholder="Password"
            autoComplete="current-password"
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
          <button
            type="button"
            onClick={handleSignInWithPassword}
            disabled={sending || !emailNorm.includes("@") || !password.trim()}
            style={{
              width: "100%",
              padding: 12,
              background: sending ? "#8a7a6a" : "#3d2e20",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              cursor: sending ? "wait" : "pointer",
              marginBottom: 10,
            }}
          >
            {sending ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={handleSendLinkInstead}
            disabled={sending}
            style={{
              width: "100%",
              padding: 10,
              background: "transparent",
              color: "#3d2e20",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              textDecoration: "underline",
              cursor: sending ? "wait" : "pointer",
            }}
          >
            {sending ? "Sending…" : "Send me a link instead"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleSendMeALink}
          disabled={sending || !emailNorm.includes("@")}
          style={{
            width: "100%",
            padding: 12,
            background: sending ? "#8a7a6a" : "#3d2e20",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            cursor: sending ? "wait" : "pointer",
          }}
        >
          {sending ? "Sending…" : "Send me a link"}
        </button>
      )}
    </div>
  );
}

const loginFallback = (
  <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
    <p style={{ color: "#666", fontSize: 16 }}>Checking session…</p>
  </div>
);

export default function LoginPage() {
  return (
    <Suspense fallback={loginFallback}>
      <LoginForm />
    </Suspense>
  );
}
