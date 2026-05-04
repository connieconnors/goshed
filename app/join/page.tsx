"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

const BADGE_LABELS: Record<string, string> = {
  sell: "Sold ✓",
  donate: "Donated ✓",
  gift: "Gifted ✓",
  curb: "Curbed ✓",
  keep: "Kept ✓",
  repurpose: "Repurposed ✓",
};

const FILTERS = ["all", "sell", "donate", "gift", "curb"] as const;

function JoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [items, setItems] = useState<ShedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  useEffect(() => {
    if (!token?.trim()) {
      setError("Invalid link");
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/invite/accept?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return null;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = typeof body?.error === "string" ? body.error : null;
          if (res.status === 404) setError("This invite link is invalid or no longer active.");
          else setError(msg || "Something went wrong.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || data === null) return;
        setOwnerEmail(data.ownerEmail ?? "");
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const filteredItems =
    filter === "all" ? items : items.filter((i) => i.recommendation === filter);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <p style={{ color: "var(--ink-soft)", textAlign: "center" }}>{error}</p>
        <Link href="/" style={{ fontSize: "14px", color: "var(--accent)", textDecoration: "none" }}>
          Go to GoShed →
        </Link>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <style>{`
        .join-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 600px) {
          .join-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 960px) {
          .join-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (min-width: 1200px) {
          .join-grid { grid-template-columns: repeat(6, 1fr); }
        }
        .join-card {
          background: var(--white);
          border-radius: 10px;
          border: 1px solid var(--surface2);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .join-card-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <Link
            href="https://goshed.app"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "24px", fontWeight: 300, color: "var(--ink)", textDecoration: "none" }}
          >
            go<em style={{ color: "var(--accent)" }}>shed</em>
          </Link>
        </div>

        <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 600, color: "var(--ink)", margin: 0, marginBottom: "4px" }}>
          {ownerEmail ? `${ownerEmail}'s GoShed` : "GoShed"}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--ink-soft)", margin: 0, marginBottom: "16px" }}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </p>

        {items.length > 0 && (
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
        )}

        <div className="join-grid">
          {filteredItems.map((item) => (
            <div key={item.id} className="join-card">
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
                <p className="join-card-label" style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}>
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
                    {BADGE_LABELS[item.recommendation] ?? `${item.recommendation} ✓`}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: "14px", marginTop: "32px" }}>
            {filter === "all" ? "No items in this shed yet." : `No ${filter} items.`}
          </p>
        )}

        <p style={{ marginTop: "48px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
          Want your own GoShed? It&apos;s free to start →{" "}
          <Link href="https://goshed.app" style={{ color: "var(--accent)", textDecoration: "none" }}>
            goshed.app
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    }>
      <JoinContent />
    </Suspense>
  );
}
