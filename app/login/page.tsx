"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window !== "undefined" && searchParams.get("error") === "auth") setAuthError(true);
  }, [mounted, searchParams]);

  const handleLogin = async () => {
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
              If you already have a magic link from us, use that to sign in.
            </p>
          )}
        </div>
      )}
      <p style={{ color: "#888", fontSize: 14 }}>
        We'll email you a magic link.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
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
        onClick={handleLogin}
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
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
