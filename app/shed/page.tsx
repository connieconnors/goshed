"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/lib/auth-session-context";

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
  cleared_at?: string | null;
};

const BUCKET_ORDER = ["sell", "donate", "gift", "curb"] as const;
type BucketId = (typeof BUCKET_ORDER)[number];

const BUCKET_TITLES: Record<BucketId, string> = {
  sell: "Sell",
  donate: "Donate",
  gift: "Gift",
  curb: "Curb",
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** Sum lows and highs across sell items for a combined range. */
function sellPileValueRange(sellItems: ShedItem[]): string | null {
  if (sellItems.length === 0) return null;
  let lowSum = 0;
  let highSum = 0;
  for (const i of sellItems) {
    lowSum += Number.isFinite(i.value_low) ? i.value_low : 0;
    highSum += Number.isFinite(i.value_high) ? i.value_high : 0;
  }
  return `${formatCurrency(lowSum)}–${formatCurrency(highSum)}`;
}

function formatClearedLabel(iso: string | null | undefined, fallbackIso: string): string {
  const raw = iso && String(iso).trim() ? iso : fallbackIso;
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
  } catch {
    return "";
  }
}

function PileItemLink({ item }: { item: ShedItem }) {
  return (
    <Link
      href={`/item/${item.id}`}
      role="listitem"
      style={{
        width: "72px",
        flexShrink: 0,
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "6px",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        {item.photo_url ? (
          <img
            src={item.photo_url}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "8px",
              color: "var(--ink-soft)",
              textAlign: "center",
              padding: "4px",
            }}
          >
            —
          </div>
        )}
      </div>
      <p
        className="goshed-pile-chip-label"
        style={{
          fontSize: "9px",
          color: "var(--ink-soft)",
          margin: "3px 0 0",
          lineHeight: 1.25,
          fontFamily: "var(--font-body)",
        }}
      >
        {item.item_label}
      </p>
    </Link>
  );
}

export default function ShedPage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useAuthSession();
  const [items, setItems] = useState<ShedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [clearedExpanded, setClearedExpanded] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;
    if (!sessionUser) {
      router.replace("/set-password?redirect=/shed");
      setLoading(false);
      return;
    }
    if (sessionUser.email) setUserEmail(sessionUser.email);
    fetch("/api/items", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data !== null) setItems(Array.isArray(data) ? (data as ShedItem[]) : []);
      })
      .catch((err) => {
        if (!cancelled) console.error("[shed] fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Use stable user id — `sessionUser` object identity can churn (e.g. auth context)
    // and refetching the full list would overwrite optimistic clears mid-flight.
  }, [router, sessionLoading, sessionUser?.id]);

  const { bucketMap, clearedItems, buckets } = useMemo(() => {
    const map: Record<BucketId, ShedItem[]> = {
      sell: [],
      donate: [],
      gift: [],
      curb: [],
    };
    const cleared: ShedItem[] = [];
    for (const item of items) {
      if (String(item.status ?? "").trim().toLowerCase() === "cleared") {
        cleared.push(item);
        continue;
      }
      const r = item.recommendation as string;
      if (r === "sell" || r === "donate" || r === "gift" || r === "curb") {
        map[r as BucketId].push(item);
      }
    }
    const bucketList = BUCKET_ORDER.filter((id) => map[id].length > 0).map((id) => ({
      id,
      items: map[id],
    }));
    return { bucketMap: map, clearedItems: cleared, buckets: bucketList };
  }, [items]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: "1.5rem" }}>
      <style>{`
        .goshed-piles-row {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 0.625rem 0.875rem;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .goshed-piles-row::-webkit-scrollbar {
          display: none;
        }
        .goshed-pile-chip-label {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "0 1.25rem" }}>
        <div style={{ padding: "48px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ fontFamily: "var(--font-cormorant)", fontSize: "24px", fontWeight: 300, color: "var(--ink)", textDecoration: "none" }}>
            go<em style={{ color: "var(--accent)" }}>shed</em>
          </Link>
          <div style={{ textAlign: "right" }} suppressHydrationWarning>
            {mounted && userEmail ? (
              <>
                <Link
                  href="/account"
                  style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", textDecoration: "none", display: "inline-block" }}
                >
                  Account
                </Link>
                <span style={{ display: "block", fontSize: "12px", color: "var(--ink-soft)", margin: "2px 0 0", lineHeight: 1.2 }}>
                  {userEmail}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "30px",
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
            lineHeight: 1.2,
            padding: "1.25rem 0 0.875rem",
          }}
        >
          My Shed
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "0.5rem" }}>
          {(["sell", "donate", "gift"] as const).map((id) => {
            const pile = bucketMap[id];
            if (pile.length === 0) return null;
            const sellRange = id === "sell" ? sellPileValueRange(pile) : null;
            return (
              <article
                key={id}
                style={{
                  background: "var(--white)",
                  borderRadius: "12px",
                  border: "1px solid var(--surface2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    padding: "0.625rem 0.875rem",
                    borderBottom: "1px solid var(--surface2)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      color: "var(--ink)",
                      letterSpacing: "-0.01em",
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                    }}
                  >
                    {BUCKET_TITLES[id]}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--ink-soft)",
                      marginLeft: "0.375rem",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {pile.length}
                  </span>
                  {sellRange ? (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--ink-soft)",
                        marginLeft: "0.375rem",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {sellRange}
                    </span>
                  ) : null}
                </div>
                <div className="goshed-piles-row" role="list">
                  {pile.map((item) => (
                    <PileItemLink key={item.id} item={item} />
                  ))}
                </div>
              </article>
            );
          })}

          {clearedItems.length > 0 ? (
            <article
              style={{
                background: "var(--white)",
                borderRadius: "12px",
                border: "1px solid var(--surface2)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                aria-expanded={clearedExpanded}
                onClick={() => setClearedExpanded((e) => !e)}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.625rem 0.875rem",
                  border: "none",
                  borderBottom: clearedExpanded ? "1px solid var(--surface2)" : "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      color: "var(--ink-soft)",
                      letterSpacing: "-0.01em",
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                    }}
                  >
                    Cleared
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--ink-soft)",
                      marginLeft: "0.375rem",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {clearedItems.length}
                  </span>
                </div>
                <span aria-hidden style={{ fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1 }}>
                  {clearedExpanded ? "▲" : "▼"}
                </span>
              </button>
              {clearedExpanded ? (
                <div className="goshed-piles-row" role="list" style={{ opacity: 0.6 }}>
                  {clearedItems.map((item) => {
                    const dateStr = formatClearedLabel(item.cleared_at, item.created_at);
                    return (
                      <div
                        key={item.id}
                        role="listitem"
                        style={{
                          width: "72px",
                          flexShrink: 0,
                          color: "inherit",
                          cursor: "default",
                        }}
                      >
                        <div
                          style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "6px",
                            background: "var(--surface)",
                            overflow: "hidden",
                          }}
                        >
                          {item.photo_url ? (
                            <img
                              src={item.photo_url}
                              alt=""
                              draggable={false}
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "8px",
                                color: "var(--ink-soft)",
                                textAlign: "center",
                                padding: "4px",
                              }}
                            >
                              —
                            </div>
                          )}
                        </div>
                        <p
                          className="goshed-pile-chip-label"
                          style={{
                            fontSize: "9px",
                            color: "var(--ink-soft)",
                            margin: "3px 0 0",
                            lineHeight: 1.25,
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {item.item_label}
                        </p>
                        {dateStr ? (
                          <p
                            style={{
                              fontSize: "8px",
                              color: "var(--ink-soft)",
                              margin: "2px 0 0",
                              lineHeight: 1.2,
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            cleared {dateStr}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ) : null}

          {bucketMap.curb.length > 0 ? (
            <article
              key="curb"
              style={{
                background: "var(--white)",
                borderRadius: "12px",
                border: "1px solid var(--surface2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  padding: "0.625rem 0.875rem",
                  borderBottom: "1px solid var(--surface2)",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    color: "var(--ink)",
                    letterSpacing: "-0.01em",
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                  }}
                >
                  {BUCKET_TITLES.curb}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--ink-soft)",
                    marginLeft: "0.375rem",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {bucketMap.curb.length}
                </span>
              </div>
              <div className="goshed-piles-row" role="list">
                {bucketMap.curb.map((item) => (
                  <PileItemLink key={item.id} item={item} />
                ))}
              </div>
            </article>
          ) : null}
        </div>

        {buckets.length === 0 && clearedItems.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: "14px", marginTop: "8px", fontFamily: "var(--font-body)" }}>
            No items in these piles yet. Snap a photo on the home page to get started.
          </p>
        ) : null}

        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <Link
            href="/"
            style={{
              fontSize: "13px",
              color: "var(--ink-soft)",
              textDecoration: "none",
              fontFamily: "var(--font-body)",
            }}
          >
            + add another item
          </Link>
        </div>
      </div>
    </main>
  );
}
