"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ShedItem = {
  id: string;
  photo_url: string | null;
  item_label: string;
  recommendation: string;
  value_range_raw: string;
  value_low: number;
  value_high: number;
  status: string;
  created_at: string;
};

/** Filter/summary category names (present tense). */
const REC_LABELS: Record<string, string> = {
  sell: "Sell",
  donate: "Donate",
  gift: "Gift",
  curb: "Curb",
  keep: "Keep",
  repurpose: "Repurpose",
};

const BADGE_LABELS: Record<string, string> = {
  sell: "Sell",
  donate: "Donate",
  gift: "Gift",
  curb: "Curb",
  keep: "Keep",
  repurpose: "Repurpose",
};

const FILTERS = ["all", "sell", "donate", "gift", "curb"] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.json().catch(() => ({ user: null })))
      .then(({ user }) => {
        if (cancelled) return null;
        if (user?.email) setUserEmail(user.email);
        if (!user) {
          router.replace("/login?redirect=/dashboard");
          return null;
        }
        return fetch("/api/items", { credentials: "include" });
      })
      .then((res) => {
        if (cancelled || res === null) return null;
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data !== null) setItems(Array.isArray(data) ? (data as ShedItem[]) : []);
      })
      .catch((err) => {
        if (!cancelled) console.error("[dashboard] fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [router]);

  const filteredItems =
    filter === "all"
      ? items
      : items.filter((i) => i.recommendation === filter);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <style>{`
        .dashboard-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 600px) {
          .dashboard-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 960px) {
          .dashboard-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (min-width: 1200px) {
          .dashboard-grid { grid-template-columns: repeat(6, 1fr); }
        }
        .dashboard-card {
          background: var(--white);
          border-radius: 10px;
          border: 1px solid var(--surface2);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          color: inherit;
        }
        .dashboard-card-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dashboard-add-link {
          display: inline-block;
        }
      `}</style>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Top bar: logo left, email top right only */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <Link href="/" style={{ fontFamily: "var(--font-cormorant)", fontSize: "24px", fontWeight: 300, color: "var(--ink)", textDecoration: "none" }}>
            go<em style={{ color: "var(--accent)" }}>shed</em>
          </Link>
          {mounted && userEmail && (
            <div style={{ textAlign: "right" }}>
              <Link
                href="/account"
                style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", textDecoration: "none", display: "inline-block" }}
              >
                Account
              </Link>
              <span style={{ display: "block", fontSize: "12px", color: "var(--ink-soft)", margin: "2px 0 0", lineHeight: 1.2 }}>
                {userEmail}
              </span>
            </div>
          )}
        </div>

        {/* My Shed heading */}
        <div style={{ marginBottom: "16px" }}>
          <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 600, color: "var(--ink)", margin: 0, marginBottom: "4px" }}>
            My Shed
          </h1>
          <p style={{ fontSize: "14px", color: "var(--ink-soft)", margin: 0 }}>
            {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
          {items.length > 0 && (
            <p style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px", marginBottom: 0 }}>
              {(["sell", "donate", "gift", "curb", "keep", "repurpose"] as const)
                .map((rec) => {
                  const count = items.filter((i) => i.recommendation === rec).length;
                  return count > 0 ? `${REC_LABELS[rec]} (${count})` : null;
                })
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid var(--soft)",
                borderRadius: "999px",
                background: filter === f ? "var(--ink)" : "var(--surface)",
                color: filter === f ? "var(--white)" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              {f === "all" ? "All" : REC_LABELS[f] ?? f}
            </button>
          ))}
        </div>

        <div className="dashboard-grid">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              href={`/item/${item.id}`}
              style={{ textDecoration: "none", display: "flex", flexDirection: "column", color: "inherit", cursor: "pointer" }}
              className="dashboard-card"
            >
              <div style={{ height: "120px", background: "var(--surface)", flexShrink: 0 }}>
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt=""
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontSize: "11px", pointerEvents: "none" }}>
                    No image
                  </div>
                )}
              </div>
              <div style={{ padding: "6px 8px 8px", flex: 1, minWidth: 0, pointerEvents: "none" }}>
                <p className="dashboard-card-label" style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}>
                  {item.item_label}
                </p>
                <p style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 500, margin: "2px 0 0 0" }}>
                  {item.value_range_raw}
                </p>
                <p style={{ margin: "4px 0 0 0" }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 600,
                      border: "1px solid var(--green)",
                      background: "transparent",
                      color: "var(--green)",
                    }}
                  >
                    {BADGE_LABELS[item.recommendation] ?? item.recommendation}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: "14px", marginTop: "32px" }}>
            {filter === "all" ? "No items yet. Snap a photo on the home page to get started." : `No ${filter} items.`}
          </p>
        )}
        <div style={{ textAlign: "center", marginTop: "32px", paddingBottom: "32px" }}>
          <Link href="/" style={{ fontSize: "14px", color: "var(--ink-soft)", textDecoration: "none", borderBottom: "1px solid var(--soft)", paddingBottom: "2px" }}>
            + Add another item
          </Link>
        </div>
      </div>
    </main>
  );
}
