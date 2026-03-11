"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState(false);
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
    const redirect = searchParams.get("redirect");
    if (redirect) sessionStorage.setItem("redirect_after_login", redirect);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
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
        onClick={handleLogin}
        style={{
          width: "100%",
          padding: 12,
          background: "#3d2e20",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Send magic link
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
