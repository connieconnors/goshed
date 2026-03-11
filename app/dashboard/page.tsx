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

const REC_LABELS: Record<string, string> = {
  sell: "Sell",
  donate: "Donate",
  gift: "Gift",
  curb: "Curb",
  keep: "Keep",
  repurpose: "Repurpose",
};

/** Button label when marking done: "Listed ✓", "Donated ✓", etc. */
const DONE_LABELS: Record<string, string> = {
  sell: "Listed ✓",
  donate: "Donated ✓",
  gift: "Gifted ✓",
  curb: "Curbed ✓",
  keep: "Kept ✓",
  repurpose: "Repurposed ✓",
};

const FILTERS = ["all", "sell", "donate", "gift", "curb"] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [doneAnimatingId, setDoneAnimatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.json().catch(() => ({ user: null })))
      .then(({ user }) => {
        if (cancelled) return null;
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

  const sellItems = items.filter((i) => i.recommendation === "sell");
  const sellLow = sellItems.reduce((s, i) => s + i.value_low, 0);
  const sellHigh = sellItems.reduce((s, i) => s + i.value_high, 0);
  const sellRange =
    sellItems.length > 0 ? `$${sellLow}–$${sellHigh}` : "$0–$0";

  const markDone = async (id: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        setDoneAnimatingId(id);
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: "done" } : i))
        );
        setTimeout(() => setDoneAnimatingId(null), 600);
      }
    } finally {
      setUpdatingId(null);
    }
  };

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
        }
        .dashboard-card-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @keyframes dashboard-done-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .dashboard-done-btn.done-pop {
          animation: dashboard-done-pop 0.4s ease-out;
        }
      `}</style>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <Link href="/" style={{ fontFamily: "var(--font-cormorant)", fontSize: "24px", fontWeight: 300, color: "var(--ink)", textDecoration: "none" }}>
              go<em style={{ color: "var(--accent)" }}>shed</em>
            </Link>
            <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 600, color: "var(--ink)", marginTop: "8px", marginBottom: "4px" }}>
              My Shed
            </h1>
            <p style={{ fontSize: "14px", color: "var(--ink-soft)" }}>
              {items.length} item{items.length !== 1 ? "s" : ""}
              {sellItems.length > 0 && (
                <span style={{ marginLeft: "12px" }}>
                  Sell pile potential: {sellRange}
                </span>
              )}
            </p>
            {items.length > 0 && (
              <p style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px" }}>
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
          <Link
            href="/"
            style={{ fontSize: "13px", color: "var(--ink-soft)", textDecoration: "none", borderBottom: "1px solid var(--soft)", paddingBottom: "2px" }}
          >
            ← Add item
          </Link>
        </div>

        {items.length > 0 && items.every((i) => i.status === "done") && (
          <p style={{ fontSize: "18px", fontFamily: "var(--font-cormorant)", color: "var(--green)", fontWeight: 600, marginBottom: "20px" }}>
            Your shed is clear. 🪄
          </p>
        )}

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
            <div key={item.id} className="dashboard-card">
              <div style={{ height: "120px", background: "var(--surface)", flexShrink: 0 }}>
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontSize: "11px" }}>
                    No image
                  </div>
                )}
              </div>
              <div style={{ padding: "6px 8px 8px", flex: 1, minWidth: 0 }}>
                <p className="dashboard-card-label" style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}>
                  {item.item_label}
                </p>
                <p style={{ fontSize: "11px", color: "var(--ink-soft)", margin: "2px 0 0 0", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 500 }}>{item.value_range_raw}</span>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 600,
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                  >
                    {REC_LABELS[item.recommendation] ?? item.recommendation}
                  </span>
                </p>
                {item.status !== "done" ? (
                  <button
                    type="button"
                    className={`dashboard-done-btn ${(updatingId === item.id || doneAnimatingId === item.id) ? "done-pop" : ""}`}
                    onClick={() => markDone(item.id)}
                    disabled={updatingId === item.id}
                    style={{
                      marginTop: "6px",
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontWeight: 500,
                      border: "1px solid var(--green)",
                      borderRadius: "6px",
                      background: "transparent",
                      color: "var(--green)",
                      cursor: updatingId === item.id ? "wait" : "pointer",
                    }}
                  >
                    {updatingId === item.id ? "…" : DONE_LABELS[item.recommendation] ?? "Done ✓"}
                  </button>
                ) : (
                  <span
                    className={doneAnimatingId === item.id ? "dashboard-done-btn done-pop" : ""}
                    style={{ display: "inline-block", marginTop: "6px", fontSize: "11px", fontWeight: 500, color: "var(--green)" }}
                  >
                    {DONE_LABELS[item.recommendation] ?? "Done ✓"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: "14px", marginTop: "32px" }}>
            {filter === "all" ? "No items yet. Snap a photo on the home page to get started." : `No ${filter} items.`}
          </p>
        )}
      </div>
    </main>
  );
}
