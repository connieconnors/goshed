"use client";

import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth-session-context";
import { addEmailWithPassword } from "@/lib/authPasswordHint";

const LAST_LOGIN_EMAIL_KEY = "goshed_last_login_email";
const SKIP_PASSWORD_GATE_ONCE_KEY = "goshed_skip_password_gate_once";

const SHED_MODAL_OVERLAY_SAFE_PADDING: Pick<
  CSSProperties,
  "paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight"
> = {
  paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
  paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
  paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
  paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
};

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Create-account flow for guests who want to open their Shed (same behavior as /set-password, post-sign-in → /shed).
 */
export function ShedSignupModal({ open, onClose }: Props) {
  const router = useRouter();
  const { refresh: refreshAuthSession } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentConfirmEmail, setSentConfirmEmail] = useState(false);

  const emailNorm = email.trim().toLowerCase();

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
      setNotificationConsent(false);
      setError(null);
      setSentConfirmEmail(false);
      setSubmitting(false);
      return;
    }
    if (typeof window === "undefined") return;
    sessionStorage.setItem("redirect_after_login", "/shed");
    const last = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (last && last.includes("@")) setEmail(last);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

  const handleCreate = async () => {
    if (typeof window === "undefined" || !emailNorm.includes("@")) return;
    sessionStorage.setItem(SKIP_PASSWORD_GATE_ONCE_KEY, "1");
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
          setError("That email already has an account — sign in below.");
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
        router.push("/shed");
        router.refresh();
        onClose();
        return;
      }
      setSentConfirmEmail(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...SHED_MODAL_OVERLAY_SAFE_PADDING,
        background: "rgba(44,36,22,0.45)",
      }}
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shed-signup-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "var(--white)",
          borderRadius: 18,
          padding: 28,
          maxWidth: 400,
          width: "100%",
          maxHeight: "min(90vh, calc(100dvh - 32px))",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          boxShadow: "0 12px 40px rgba(44,36,22,0.18)",
          border: "1px solid var(--surface2)",
          fontFamily: "inherit",
          color: "var(--ink)",
        }}
      >
        <button
          type="button"
          aria-label="Close create account"
          onClick={() => {
            if (!submitting) onClose();
          }}
          disabled={submitting}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "1px solid var(--surface2)",
            background: "var(--white)",
            color: "var(--ink-soft)",
            fontSize: 20,
            lineHeight: "42px",
            textAlign: "center",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          ×
        </button>
        {sentConfirmEmail ? (
          <>
            <h2
              id="shed-signup-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 600,
                marginTop: 0,
                marginBottom: 12,
                color: "var(--ink)",
              }}
            >
              Confirm your email
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55, marginBottom: 20 }}>
              We sent a link to <strong style={{ color: "var(--ink)" }}>{emailNorm}</strong>. Open it to finish setting up your account, then you&apos;ll be able to open your Shed.
            </p>
            <Link
              href="/login?redirect=/shed"
              onClick={onClose}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                textAlign: "center",
                background: "var(--green)",
                color: "#fff",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h2
              id="shed-signup-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 600,
                marginTop: 0,
                marginBottom: 8,
                color: "var(--ink)",
              }}
            >
              Create a free account
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 20 }}>
              Start your free shed.
            </p>
            <label
              htmlFor="shed-signup-notify-consent"
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
                id="shed-signup-notify-consent"
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
                Email me occasionally — I declutter better with a nudge
              </span>
            </label>
            {error ? (
              <p style={{ color: "#b42318", fontSize: 14, marginBottom: 12, lineHeight: 1.45 }}>{error}</p>
            ) : null}
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="Email"
              autoComplete="email"
              disabled={submitting}
              style={{
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
              }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Password (at least 6 characters)"
              autoComplete="new-password"
              disabled={submitting}
              style={{
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
              }}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
              placeholder="Confirm password"
              autoComplete="new-password"
              disabled={submitting}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 16,
                borderRadius: 12,
                border: "1px solid var(--surface2)",
                marginBottom: 16,
                boxSizing: "border-box",
                fontFamily: "inherit",
                background: "var(--white)",
                color: "var(--ink)",
              }}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting || !emailNorm.includes("@") || !password.trim()}
              className="goshed-primary-btn"
              style={{
                width: "100%",
                justifyContent: "center",
                marginBottom: 12,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting || !emailNorm.includes("@") || !password.trim() ? 0.65 : 1,
              }}
            >
              {submitting ? "Creating…" : "Create account"}
            </button>
            <p style={{ margin: 0, textAlign: "center", fontSize: 13 }}>
              <Link
                href="/login?redirect=/shed"
                onClick={onClose}
                style={{ color: "var(--ink-soft)", textDecoration: "underline" }}
              >
                Already have an account? Sign in
              </Link>
            </p>
            <button
              type="button"
              onClick={() => {
                if (!submitting) onClose();
              }}
              style={{
                display: "block",
                width: "100%",
                marginTop: 14,
                padding: 10,
                background: "transparent",
                border: "none",
                color: "var(--ink-soft)",
                fontSize: 14,
                cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
