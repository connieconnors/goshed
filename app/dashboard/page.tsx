"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** @deprecated Use /shed — kept for bookmarks and old links. */
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/shed");
  }, [router]);
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <p style={{ color: "var(--ink-soft)" }}>Redirecting…</p>
    </main>
  );
}
