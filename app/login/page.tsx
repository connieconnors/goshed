"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const handleLogin = async () => {
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
