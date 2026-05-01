"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth-session-context";
import { addEmailWithPassword } from "@/lib/authPasswordHint";
import {
  isNativeIosPurchasesAvailable,
  restoreNativeIosPurchases,
} from "@/lib/revenuecat-purchases";

const WEB_REVENUECAT_API_KEY =
  process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_REVENUECAT_API_KEY?.trim() ||
  "";

export default function AccountPage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading, refresh: refreshAuthSession } = useAuthSession();
  const [user, setUser] = useState<{ id?: string; email?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
    setLoading(false);
  }, [sessionLoading, sessionUser]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?redirect=/account");
    }
  }, [loading, router, user]);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setInviteMessage({ type: "error", text: "Please enter a valid email." });
      return;
    }
    setInviteMessage(null);
    setInviteLoading(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeEmail: email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInviteEmail("");
        setInviteMessage({ type: "success", text: `Invite sent to ${email}` });
      } else {
        setInviteMessage({ type: "error", text: (data?.error as string) || "Something went wrong, please try again." });
      }
    } catch {
      setInviteMessage({ type: "error", text: "Something went wrong, please try again." });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword.trim() || newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords don't match or are empty." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Use at least 6 characters." });
      return;
    }
    setPasswordMessage(null);
    setPasswordLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMessage({ type: "error", text: error.message });
        return;
      }
      if (user?.email) {
        await fetch("/api/auth/password-set", { method: "POST", credentials: "include" });
        addEmailWithPassword(user.email);
      }
      await refreshAuthSession();
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({ type: "success", text: "Password set. You can sign in with it next time." });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoreLoading(true);
    setRestoreMessage(null);
    try {
      if (!user?.id) {
        setRestoreMessage({ type: "error", text: "Sign in before restoring purchases." });
        return;
      }
      if (await isNativeIosPurchasesAvailable()) {
        await restoreNativeIosPurchases(user.id);
        const snap = await refreshAuthSession();
        if (snap.isPro) {
          setRestoreMessage({ type: "success", text: "GoShed Pro is active on this account." });
        } else {
          setRestoreMessage({
            type: "success",
            text: "Restore completed. No active subscription was found for this Apple ID.",
          });
        }
        return;
      }

      const { Purchases } = await import("@revenuecat/purchases-js");
      if (!Purchases.isConfigured()) {
        if (!WEB_REVENUECAT_API_KEY) {
          setRestoreMessage({
            type: "error",
            text: "Billing isn’t available right now. Try again later.",
          });
          return;
        }
        Purchases.configure({ apiKey: WEB_REVENUECAT_API_KEY, appUserId: user.id });
      } else {
        const current = Purchases.getSharedInstance();
        if (current.getAppUserId() !== user.id) {
          await current.changeUser(user.id);
        }
      }
      const purchases = Purchases.getSharedInstance();
      await purchases.getCustomerInfo();
      const snap = await refreshAuthSession();
      if (snap.isPro) {
        setRestoreMessage({ type: "success", text: "GoShed Pro is active on this account." });
      } else {
        setRestoreMessage({
          type: "success",
          text: "Synced with billing. No active subscription on this account yet.",
        });
      }
    } catch {
      setRestoreMessage({ type: "error", text: "Couldn’t sync purchases. Try again." });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", credentials: "include" });
      if (res.ok) {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.replace("/?deleted=1");
      } else {
        const body = await res.json().catch(() => ({}));
        const message = typeof body?.error === "string" ? body.error : "Something went wrong. Please try again or contact support.";
        alert(message);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px 24px 48px" }}>
      <div style={{ maxWidth: "400px", margin: "0 auto" }}>
        <Link href="/shed" style={{ fontFamily: "var(--font-cormorant)", fontSize: "24px", fontWeight: 300, color: "var(--ink)", textDecoration: "none" }}>
          go<em style={{ color: "var(--accent)" }}>shed</em>
        </Link>
        <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 600, color: "var(--ink)", marginTop: "24px", marginBottom: "8px" }}>
          Account
        </h1>

        {/* Signed in as */}
        <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--soft)" }}>
          <p style={{ fontSize: "12px", color: "var(--ink-soft)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Signed in as
          </p>
          <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--ink)", margin: 0 }}>
            {user.email ?? "—"}
          </p>
        </div>

        {/* Sign out */}
        <div style={{ marginTop: "16px" }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{ padding: "10px 16px", fontSize: "14px", fontWeight: 500, border: "1px solid var(--soft)", borderRadius: "8px", background: "var(--white)", color: "var(--ink)", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>

        {/* Set a password */}
        <section style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--soft)" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
            Set a password
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: "12px" }}>
            Sign in with email and password next time.
          </p>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            style={{ width: "100%", padding: "10px 12px", fontSize: "14px", border: "1px solid var(--soft)", borderRadius: "8px", background: "var(--white)", color: "var(--ink)", marginBottom: "8px", boxSizing: "border-box" }}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            style={{ width: "100%", padding: "10px 12px", fontSize: "14px", border: "1px solid var(--soft)", borderRadius: "8px", background: "var(--white)", color: "var(--ink)", marginBottom: "12px", boxSizing: "border-box" }}
          />
          <button
            type="button"
            onClick={handleSetPassword}
            disabled={passwordLoading || !newPassword.trim() || newPassword !== confirmPassword}
            style={{ padding: "10px 16px", fontSize: "14px", fontWeight: 500, borderRadius: "8px", background: "var(--accent)", color: "var(--white)", border: "none", cursor: passwordLoading ? "not-allowed" : "pointer", opacity: passwordLoading || !newPassword.trim() || newPassword !== confirmPassword ? 0.6 : 1 }}
          >
            {passwordLoading ? "Setting…" : "Set password"}
          </button>
          {passwordMessage && (
            <p style={{ fontSize: "13px", marginTop: "10px", marginBottom: 0, color: passwordMessage.type === "success" ? "var(--green)" : "#c0392b" }}>
              {passwordMessage.text}
            </p>
          )}
        </section>

        {/* Family sharing */}
        <section style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--soft)" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
            Family &amp; sharing
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: "16px" }}>
            Invite someone to view and help decide on your shed — great for estates, moves, or just a second opinion.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="email"
              placeholder="their@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ flex: 1, padding: "10px 12px", fontSize: "14px", border: "1px solid var(--soft)", borderRadius: "8px", background: "var(--white)", color: "var(--ink)", outline: "none" }}
            />
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteLoading}
              style={{ padding: "10px 16px", fontSize: "14px", fontWeight: 500, borderRadius: "8px", background: "var(--accent)", color: "var(--white)", border: "none", cursor: inviteLoading ? "not-allowed" : "pointer", opacity: inviteLoading ? 0.6 : 1 }}
            >
              {inviteLoading ? "Sending…" : "Invite"}
            </button>
          </div>
          {inviteMessage && (
            <p style={{ fontSize: "13px", marginTop: "8px", marginBottom: 0, color: inviteMessage.type === "success" ? "var(--green)" : "#c0392b" }}>
              {inviteMessage.text}
            </p>
          )}
        </section>

        {/* Subscription / restore (secondary to main app upgrade CTAs) */}
        <section style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--soft)" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
            Subscription
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: "12px" }}>
            Already subscribed? Restore your access on this device.
          </p>
          <button
            type="button"
            onClick={handleRestorePurchases}
            disabled={restoreLoading}
            style={{ padding: "10px 16px", fontSize: "14px", fontWeight: 500, border: "1px solid var(--soft)", borderRadius: "8px", background: "var(--white)", color: "var(--ink)", cursor: restoreLoading ? "not-allowed" : "pointer", opacity: restoreLoading ? 0.6 : 1 }}
          >
            {restoreLoading ? "Restoring…" : "Restore purchases"}
          </button>
          {restoreMessage && (
            <p style={{ fontSize: "13px", marginTop: "10px", marginBottom: 0, color: restoreMessage.type === "success" ? "var(--green)" : "#c0392b" }}>
              {restoreMessage.text}
            </p>
          )}
        </section>

        {/* Danger zone */}
        <section style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--soft)" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "8px" }}>
            Danger zone
          </h2>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              style={{ padding: "10px 16px", fontSize: "14px", fontWeight: 500, border: "1px solid #e0b0b0", borderRadius: "8px", background: "var(--white)", color: "#c0392b", cursor: "pointer" }}
            >
              Delete my account
            </button>
          ) : (
            <div style={{ padding: "16px", background: "#fff5f5", borderRadius: "12px", border: "1px solid #e0b0b0" }}>
              <p style={{ fontSize: "14px", color: "#c0392b", fontWeight: 500, marginBottom: "8px" }}>
                Are you sure?
              </p>
              <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: "16px" }}>
                This will permanently delete all your items and your account. This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  style={{ padding: "10px 16px", fontSize: "14px", fontWeight: 600, borderRadius: "8px", background: "#c0392b", color: "var(--white)", border: "none", cursor: deleteLoading ? "not-allowed" : "pointer", opacity: deleteLoading ? 0.6 : 1 }}
                >
                  {deleteLoading ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ padding: "10px 16px", fontSize: "14px", fontWeight: 500, borderRadius: "8px", background: "var(--white)", color: "var(--ink)", border: "1px solid var(--soft)", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <p style={{ marginTop: "32px" }}>
          <Link href="/shed" style={{ fontSize: "13px", color: "var(--ink-soft)", textDecoration: "none" }}>
            ← Back to My Shed
          </Link>
        </p>
      </div>
    </main>
  );
}
