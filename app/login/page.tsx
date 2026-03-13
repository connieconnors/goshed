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
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const emailsWithPassword = mounted && typeof window !== "undefined" ? getEmailsWithPassword() : [];
  const showPasswordField = email.includes("@") && emailsWithPassword.includes(email.toLowerCase());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for existing session (cookie-based) before showing form — don't show login if already signed in
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then((result: AuthResponse) => {
      const session = result.data.session;
      if (cancelled) return;
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
    });
    return () => {
      cancelled = true;
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

  const handleMagicLink = async () => {
    if (typeof window === "undefined") return;
    setSendError(null);
    setSending(true);
    const redirect = searchParams.get("redirect");
    if (redirect) sessionStorage.setItem("redirect_after_login", redirect);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setSending(false);
    if (!error && email) localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email);
    if (error) {
      console.error("[login] signInWithOtp failed:", error.message, error);
      const isRateLimit =
        error.message?.toLowerCase().includes("rate limit") ||
        (error as { status?: number }).status === 429;
      setSendError(
        isRateLimit
          ? "Too many sign-in attempts. Please wait about an hour before requesting another magic link."
          : error.message || "Could not send magic link. Try again later."
      );
      return;
    }
    setSent(true);
  };

  const handlePasswordSignIn = async () => {
    if (typeof window === "undefined" || !password.trim()) return;
    setSendError(null);
    setSending(true);
    const redirect = searchParams.get("redirect");
    if (redirect) sessionStorage.setItem("redirect_after_login", redirect);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSending(false);
    if (error) {
      setSendError(error.message || "Invalid email or password.");
      return;
    }
    if (email) localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email);
    redirectAfterLogin();
  };

  if (checkingSession)
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <p style={{ color: "#666", fontSize: 16 }}>Checking session…</p>
      </div>
    );

  if (sent)
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Check your email ✉️</h2>
        <p>
          We sent a magic link to <strong>{email}</strong>
        </p>
        <p style={{ color: "#888", fontSize: 14 }}>
          Click the link to sign in — no password needed.
        </p>
        <p style={{ color: "#888", fontSize: 14, marginTop: 16 }}>
          Check your spam folder if you don&apos;t see it within a minute. Only one magic link is valid at a time — wait 60 seconds before requesting another.
        </p>
        <p style={{ color: "#666", fontSize: 13, marginTop: 20 }}>
          On your phone? Open the link in your regular browser (Safari or Chrome), not inside your email app — that way you stay signed in.
        </p>
      </div>
    );

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
          Sign-in link expired or invalid. Request a new magic link below.
        </p>
      )}
      {sendError && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: "#c00", fontSize: 14 }}>
            {sendError}
          </p>
          {sendError.includes("wait about an hour") && (
            <p style={{ color: "#666", fontSize: 13, marginTop: 8 }}>
              If you already have a magic link from us, use that to sign in. If you set a password on your account, you can sign in with it above instead.
            </p>
          )}
        </div>
      )}
      <p style={{ color: "#888", fontSize: 14, marginBottom: 12 }}>
        {showPasswordField ? "Sign in with your password." : "We'll email you a magic link."}
      </p>
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
      {showPasswordField ? (
        <>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            onClick={handlePasswordSignIn}
            disabled={sending || !password.trim()}
            style={{
              width: "100%",
              padding: 12,
              background: sending ? "#8a7a6a" : "#3d2e20",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              cursor: sending ? "wait" : "pointer",
              marginBottom: 12,
            }}
          >
            {sending ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ margin: 0, fontSize: 14 }}>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={sending}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#666",
                textDecoration: "underline",
                cursor: sending ? "wait" : "pointer",
                fontSize: "inherit",
                fontFamily: "inherit",
              }}
            >
              {sending ? "Sending…" : "Forgot password? Send magic link"}
            </button>
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={handleMagicLink}
          disabled={sending}
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
          {sending ? "Sending…" : "Send magic link"}
        </button>
      )}
    </div>
  );
}

// Match LoginForm's initial "Checking session…" UI to avoid hydration mismatch (React #418)
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
