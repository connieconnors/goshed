"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth-session-context";

const LAST_LOGIN_EMAIL_KEY = "goshed_last_login_email";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser, loading: authSessionLoading } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** After timeout, show the sign-in form even if session fetch is still pending (avoid stuck UI). */
  const [sessionWaitTimedOut, setSessionWaitTimedOut] = useState(false);

  const emailNorm = email.trim().toLowerCase();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const slow = setTimeout(() => {
      setSessionWaitTimedOut(true);
      console.warn("[login] auth session still loading after 6s — showing form so UI is not stuck");
    }, 6000);
    return () => clearTimeout(slow);
  }, [mounted]);

  const redirectAfterLogin = useCallback(() => {
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
    if (!mounted || authSessionLoading || !sessionUser) return;
    redirectAfterLogin();
  }, [mounted, authSessionLoading, sessionUser, redirectAfterLogin]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const last = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (last && last.includes("@")) setEmail(last);
  }, [mounted]);

  const handleSignIn = async () => {
    if (typeof window === "undefined" || !emailNorm.includes("@") || !password.trim()) return;
    setSignInError(null);
    setResetSuccess(false);
    setResetError(null);
    const redirect = searchParams.get("redirect");
    if (redirect) sessionStorage.setItem("redirect_after_login", redirect);
    setSigningIn(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email: emailNorm, password });
      if (error) {
        setSignInError(
          "Can't find that combination. If you signed in with a link before, use Forgot password to set a password."
        );
        return;
      }
      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, emailNorm);
      redirectAfterLogin();
    } finally {
      setSigningIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (typeof window === "undefined" || !emailNorm.includes("@")) {
      setResetError("Enter your email address first.");
      return;
    }
    setResetError(null);
    setSignInError(null);
    setResetSuccess(false);
    setResetSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(emailNorm, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        setResetError(error.message || "Could not send reset email. Try again.");
        return;
      }
      setResetSuccess(true);
    } finally {
      setResetSending(false);
    }
  };

  const waitingOnAuthSession = mounted && authSessionLoading && !sessionWaitTimedOut;
  if (!mounted || waitingOnAuthSession) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "inherit", color: "var(--ink-soft)" }}>
        <p style={{ fontSize: 16 }}>Checking session…</p>
      </div>
    );
  }

  if (sessionUser) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "inherit", color: "var(--ink-soft)" }}>
        <p style={{ fontSize: 16 }}>Signed in — taking you to GoShed…</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    fontSize: 16,
    borderRadius: 12,
    border: "1px solid var(--surface2)",
    marginBottom: 12,
    boxSizing: "border-box",
    fontFamily: "inherit",
    background: "var(--white)",
    color: "var(--ink)",
  };

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 400,
        margin: "0 auto",
        fontFamily: "inherit",
        color: "var(--ink)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 600,
          margin: "0 0 8px",
          color: "var(--ink)",
        }}
      >
        Sign in to GoShed
      </h2>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 20px", lineHeight: 1.5 }}>
        Use the email and password you created.
      </p>

      {signInError ? (
        <p style={{ color: "#b42318", fontSize: 14, marginBottom: 12, lineHeight: 1.45 }}>{signInError}</p>
      ) : null}

      {resetError ? (
        <p style={{ color: "#b42318", fontSize: 14, marginBottom: 12, lineHeight: 1.45 }}>{resetError}</p>
      ) : null}

      {resetSuccess ? (
        <p style={{ color: "var(--green)", fontSize: 14, marginBottom: 12, lineHeight: 1.45, fontWeight: 500 }}>
          Check your email for a password reset link.
        </p>
      ) : null}

      <input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setSignInError(null);
          setResetError(null);
          setResetSuccess(false);
        }}
        placeholder="Email"
        autoComplete="email"
        style={inputStyle}
      />

      <input
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setSignInError(null);
        }}
        placeholder="Password"
        autoComplete="current-password"
        style={inputStyle}
      />

      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={signingIn || !emailNorm.includes("@") || !password.trim()}
        className="goshed-primary-btn"
        style={{
          width: "100%",
          justifyContent: "center",
          marginBottom: 14,
          cursor: signingIn ? "wait" : "pointer",
          opacity: signingIn || !emailNorm.includes("@") || !password.trim() ? 0.65 : 1,
        }}
      >
        {signingIn ? "Signing in…" : "Sign in"}
      </button>

      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={() => void handleForgotPassword()}
          disabled={resetSending}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--ink-soft)",
            textDecoration: "underline",
            cursor: resetSending ? "wait" : "pointer",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        >
          {resetSending ? "Sending…" : "Forgot password?"}
        </button>
      </div>

      <p style={{ marginTop: 28, marginBottom: 0, textAlign: "center", lineHeight: 1.45 }}>
        <Link
          href="/set-password"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--green)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          New to GoShed? Create an account →
        </Link>
      </p>
    </div>
  );
}

const loginFallback = (
  <div style={{ padding: 40, textAlign: "center", fontFamily: "inherit", color: "var(--ink-soft)" }}>
    <p style={{ fontSize: 16 }}>Checking session…</p>
  </div>
);

export default function LoginPage() {
  return (
    <Suspense fallback={loginFallback}>
      <LoginForm />
    </Suspense>
  );
}
