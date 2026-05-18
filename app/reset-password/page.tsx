"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth-session-context";
import { addEmailWithPassword } from "@/lib/authPasswordHint";

const PASSWORD_RESET_FLOW_COOKIE = "goshed_password_reset_flow";

function clearPasswordResetFlowCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${PASSWORD_RESET_FLOW_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  if (window.location.hostname.endsWith("goshed.app")) {
    document.cookie = `${PASSWORD_RESET_FLOW_COOKIE}=; Max-Age=0; Path=/; Domain=.goshed.app; SameSite=Lax; Secure`;
  }
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading } = useAuthSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    clearPasswordResetFlowCookie();
  }, []);

  const handleSubmit = async () => {
    const password = newPassword.trim();
    setMessage(null);

    if (password.length < 6) {
      setMessage({ type: "error", text: "Use at least 6 characters." });
      return;
    }
    if (password !== confirmPassword.trim()) {
      setMessage({ type: "error", text: "Passwords don’t match." });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error("[reset-password] updateUser failed:", error.message, error);
        setMessage({ type: "error", text: error.message || "Could not update your password. Try the reset link again." });
        return;
      }

      try {
        await fetch("/api/auth/password-set", { method: "POST", credentials: "include" });
        if (user?.email) addEmailWithPassword(user.email);
      } catch (profileError) {
        console.error("[reset-password] password-set sync failed:", profileError);
      }

      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Password updated. Taking you back to sign in…" });
      clearPasswordResetFlowCookie();
      await supabase.auth.signOut();
      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1200);
    } finally {
      setSubmitting(false);
    }
  };

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
      <p style={{ margin: "0 0 16px", textAlign: "center" }}>
        <Link href="/login" style={{ fontSize: 13, color: "var(--ink-soft)", textDecoration: "underline" }}>
          ← Back to sign in
        </Link>
      </p>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 600,
          margin: "0 0 8px",
          color: "var(--ink)",
        }}
      >
        Set a new password
      </h2>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 20px", lineHeight: 1.5 }}>
        Choose a new password for your GoShed account.
      </p>

      {loading ? (
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 12, lineHeight: 1.45 }}>
          Checking your reset link…
        </p>
      ) : null}

      {!loading && !user && message?.type !== "success" ? (
        <p style={{ color: "#b42318", fontSize: 14, marginBottom: 12, lineHeight: 1.45 }}>
          This reset link is expired or invalid. Please request a new password reset from the sign-in page.
        </p>
      ) : null}

      {message ? (
        <p
          style={{
            color: message.type === "success" ? "var(--green)" : "#b42318",
            fontSize: 14,
            marginBottom: 12,
            lineHeight: 1.45,
            fontWeight: message.type === "success" ? 500 : 400,
          }}
        >
          {message.text}
        </p>
      ) : null}

      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        disabled={loading || !user || submitting || message?.type === "success"}
        style={inputStyle}
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm password"
        autoComplete="new-password"
        disabled={loading || !user || submitting || message?.type === "success"}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={loading || !user || submitting || message?.type === "success"}
        className="goshed-primary-btn"
        style={{
          width: "100%",
          justifyContent: "center",
          cursor: submitting ? "wait" : "pointer",
          opacity: loading || !user || submitting || message?.type === "success" ? 0.65 : 1,
        }}
      >
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </div>
  );
}
