"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.json().catch(() => ({ user: null })))
      .then(({ user: u }) => {
        if (!cancelled) setUser(u ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    );
  }

  if (!user) {
    router.replace("/login?redirect=/account");
    return null;
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <div style={{ maxWidth: "400px", margin: "0 auto" }}>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-cormorant)", fontSize: "24px", fontWeight: 300, color: "var(--ink)", textDecoration: "none" }}>
          go<em style={{ color: "var(--accent)" }}>shed</em>
        </Link>
        <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 600, color: "var(--ink)", marginTop: "24px", marginBottom: "8px" }}>
          Account
        </h1>

        <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--soft)" }}>
          <p style={{ fontSize: "12px", color: "var(--ink-soft)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Signed in as
          </p>
          <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--ink)", margin: 0 }}>
            {user.email ?? "—"}
          </p>
        </div>

        <div style={{ marginTop: "16px" }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 500,
              border: "1px solid var(--soft)",
              borderRadius: "8px",
              background: "var(--white)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>

        <section style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--soft)" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "8px" }}>
            Account settings
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink-soft)", margin: 0 }}>
            Family and estate sharing settings will appear here.
          </p>
        </section>

        <p style={{ marginTop: "32px" }}>
          <Link href="/dashboard" style={{ fontSize: "13px", color: "var(--ink-soft)", textDecoration: "none" }}>
            ← Back to My Shed
          </Link>
        </p>
      </div>
    </main>
  );
}
