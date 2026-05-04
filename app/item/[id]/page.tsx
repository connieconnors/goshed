"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { SentimentalNudge } from "@/components/SentimentalNudge";
import { TipsComingSoonModal } from "@/app/components/TipsComingSoonModal";
import { useAuthSession } from "@/lib/auth-session-context";
import { getTipsForItem, type TipLink } from "@/lib/tips";
import {
  fetchConsignmentPlacesClient,
  type ConsignmentPlaceRow,
} from "@/lib/fetchConsignmentPlacesClient";

type ItemDetail = {
  id: string;
  photo_url: string | null;
  item_label: string;
  recommendation: string;
  value_range_raw: string;
  value_low: number;
  value_high: number;
  status: string;
  notes: string | null;
  created_at: string;
  cleared_at?: string | null;
  bucket_change_count?: number | null;
};

const BADGE_LABELS: Record<string, string> = {
  sell: "Sell",
  donate: "Donate",
  gift: "Gift",
  curb: "Curb",
  keep: "Keep",
  repurpose: "Repurpose",
};

function normalizeStatus(s: unknown): string {
  const v = typeof s === "string" ? s.toLowerCase() : "";
  if (v === "done" || v === "cleared") return v;
  return "pending";
}

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user: sessionUser, loading: sessionLoading } = useAuthSession();
  const id = typeof params?.id === "string" ? params.id : null;
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [draftRecommendation, setDraftRecommendation] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sentimentalOpen, setSentimentalOpen] = useState(false);
  const [itemConsignmentExpanded, setItemConsignmentExpanded] = useState(false);
  const [itemConsignmentLoading, setItemConsignmentLoading] = useState(false);
  const [itemConsignmentPlaces, setItemConsignmentPlaces] = useState<ConsignmentPlaceRow[]>([]);
  const [pendingRecommendation, setPendingRecommendation] = useState<string | null>(null);
  const [activeTip, setActiveTip] = useState<TipLink | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Invalid item");
      return;
    }
    let cancelled = false;
    fetch(`/api/items/${id}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Item not found");
          if (res.status === 401) {
            router.replace("/login?redirect=" + encodeURIComponent(`/item/${id}`));
            return null;
          }
          throw new Error("Failed to load item");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) {
          const normalized = { ...data, status: normalizeStatus(data.status) };
          setItem(normalized);
          setDraftRecommendation(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, router]);

  const isLoggedIn = sessionLoading ? null : !!sessionUser;

  useEffect(() => {
    if (item?.recommendation !== "sell") {
      setItemConsignmentExpanded(false);
      setItemConsignmentPlaces([]);
      setItemConsignmentLoading(false);
    }
  }, [item?.recommendation]);

  const patchItem = async (
    body: { recommendation?: string; status?: string; cleared_at?: string },
    onSuccess?: (data: ItemDetail) => void
  ): Promise<boolean> => {
    if (!id || updating) return false;
    setUpdating(true);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      const normalized = { ...data, status: normalizeStatus(data.status) };
      setItem(normalized);
      onSuccess?.(normalized);
      return true;
    } catch {
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const tryBeginBucketSave = () => {
    if (!item || draftRecommendation == null || draftRecommendation === item.recommendation) return;
    const next = draftRecommendation;
    const c = item.bucket_change_count ?? 0;
    if (c === 1) {
      setPendingRecommendation(next);
      setSentimentalOpen(true);
      return;
    }
    void patchItem({ recommendation: next }, () => {
      setDraftRecommendation(null);
      setPendingRecommendation(null);
    });
  };

  const handleSentimentalKeepGoing = () => {
    if (!item || pendingRecommendation == null) return;
    const next = pendingRecommendation;
    void patchItem({ recommendation: next }, () => {
      setDraftRecommendation(null);
      setPendingRecommendation(null);
    });
  };

  const handleItemConsignmentLinkClick = async () => {
    if (itemConsignmentLoading || itemConsignmentExpanded) return;
    setItemConsignmentExpanded(true);
    setItemConsignmentLoading(true);
    const places = await fetchConsignmentPlacesClient();
    setItemConsignmentPlaces(places);
    setItemConsignmentLoading(false);
  };

  const handleMoveToKeepNoRemind = async () => {
    return await patchItem({ recommendation: "keep" }, () => {
      setDraftRecommendation(null);
      setPendingRecommendation(null);
    });
  };

  const handleMoveToKeepRemind = async () => {
    if (!id || !item) return false;
    const ok = await patchItem({ recommendation: "keep" }, () => {
      setDraftRecommendation(null);
      setPendingRecommendation(null);
    });
    if (ok && typeof sessionUser?.email === "string" && sessionUser.email.trim().length > 0) {
      try {
        await fetch("/api/nudge/remind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            itemId: id,
            itemName: item.item_label,
            email: sessionUser.email.trim(),
          }),
        });
      } catch {
        // Row saved; email is best-effort
      }
    }
    return ok;
  };

  const handleMarkCleared = async () => {
    if (!id || updating || item?.status === "cleared") return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: "cleared",
          cleared_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      router.push("/dashboard");
    } catch {
      // Keep current item state on error
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!item || deleting) return;
    console.log("deleting item:", item.id);
    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        router.push("/shed");
        return;
      }
      const body = await res.json().catch(() => ({}));
      const msg = (body && (typeof body.details === "string" ? body.details : body.error)) || "Couldn't delete this item. Please try again.";
      console.error("[delete] failed:", res.status, body);
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  const itemTips = getTipsForItem({
    recommendation: item?.recommendation,
    item_label: item?.item_label,
  });

  const tipButtonStyle = {
    border: "1px solid rgba(196,168,130,0.42)",
    background: "rgba(245,240,232,0.48)",
    borderRadius: "999px",
    padding: "5px 10px",
    color: "var(--accent)",
    fontSize: "12px",
    fontFamily: "inherit",
    cursor: "pointer",
  } as const;

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
          <Link href="/shed" style={{ fontSize: "13px", color: "var(--ink-soft)", textDecoration: "none" }}>
            ← Back to My Shed
          </Link>
          <p style={{ marginTop: "24px", color: "var(--ink-soft)", fontSize: "14px" }}>{error ?? "Item not found."}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <style>{`
        @media (max-width: 599px) {
          .item-detail-content { padding-left: 16px; padding-right: 16px; }
        }
      `}</style>
      <div className="item-detail-content" style={{ maxWidth: "560px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <Link href="/" style={{ fontFamily: "var(--font-cormorant)", fontSize: "24px", fontWeight: 300, color: "var(--ink)", textDecoration: "none" }}>
            go<em style={{ color: "var(--accent)" }}>shed</em>
          </Link>
          <Link href="/shed" style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}>
            My Shed
          </Link>
        </div>

        {/* Photo large at top */}
        <div style={{ background: "var(--surface)", borderRadius: "18px", overflow: "hidden", border: "1px solid var(--surface2)", marginBottom: "20px" }}>
          {item.photo_url ? (
            <img
              src={item.photo_url}
              alt=""
              style={{ width: "100%", maxHeight: "400px", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "280px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-soft)",
                fontFamily: "var(--font-cormorant)",
                fontSize: "42px",
                fontStyle: "italic",
              }}
            >
              {item.item_label.trim().charAt(0).toLowerCase() || "g"}
            </div>
          )}
        </div>

        {/* Item name, value range, recommendation badge */}
        <div style={{ padding: "20px", background: "var(--white)", borderRadius: "18px", border: "1px solid var(--surface2)", boxShadow: "0 2px 8px rgba(44,36,22,0.06)" }}>
          <p style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", lineHeight: 1.35, fontWeight: 500, color: "var(--ink)", marginBottom: "8px" }}>
            {item.item_label}
          </p>
          <p style={{ fontSize: "14px", lineHeight: 1.3, fontWeight: 500, color: "var(--accent)", marginBottom: "12px" }}>
            {item.value_range_raw}
          </p>
          <p style={{ marginBottom: "16px" }}>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid var(--green)",
                background: "transparent",
                color: "var(--green)",
              }}
            >
              {BADGE_LABELS[item.recommendation] ?? item.recommendation}
            </span>
          </p>
          {itemTips.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {itemTips.map((tip) => (
                <button
                  key={tip.id}
                  type="button"
                  onClick={() => setActiveTip(tip)}
                  style={tipButtonStyle}
                >
                  {tip.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Recommendation rationale / notes */}
          {(item.notes && item.notes.trim()) ? (
            <div style={{ borderTop: "1px solid var(--soft)", paddingTop: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink-soft)", marginBottom: "8px" }}>
                Why this recommendation
              </p>
              <p style={{ fontSize: "14px", lineHeight: 1.5, color: "var(--ink)", margin: 0 }}>
                {item.notes.trim()}
              </p>
            </div>
          ) : null}
          {item.recommendation === "sell" && isLoggedIn === true && (
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--soft)" }}>
              <button
                type="button"
                onClick={() => void handleItemConsignmentLinkClick()}
                disabled={itemConsignmentLoading}
                style={{
                  fontSize: "13px",
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  cursor: itemConsignmentLoading ? "wait" : "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                Want to see consignment stores near you?
              </button>
              {itemConsignmentExpanded && (
                <div style={{ marginTop: "10px" }}>
                  {itemConsignmentLoading ? (
                    <p style={{ fontSize: "13px", color: "var(--ink-soft)", margin: 0 }}>Loading nearby…</p>
                  ) : itemConsignmentPlaces.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--ink-soft)", margin: 0 }}>
                      No stores found or location unavailable.
                    </p>
                  ) : (
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "18px",
                        fontSize: "13px",
                        lineHeight: 1.55,
                        color: "var(--ink)",
                      }}
                    >
                      {itemConsignmentPlaces.map((p) => (
                        <li key={p.place_id} style={{ marginBottom: "8px" }}>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(p.place_id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                          >
                            {p.name}
                          </a>
                          {p.rating != null ? (
                            <span style={{ color: "var(--ink-soft)" }}> · {p.rating.toFixed(1)}★</span>
                          ) : null}
                          <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px" }}>
                            {p.address}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--ink-soft)" }}>{p.distance_mi} mi</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Change recommendation */}
        <div style={{ marginTop: "24px", marginBottom: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink-soft)", marginBottom: "10px" }}>
            Change recommendation
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {["sell", "donate", "gift", "curb", "keep", "repurpose"].map((rec) => {
              const isActive = (draftRecommendation ?? item.recommendation) === rec;
              return (
                <button
                  key={rec}
                  type="button"
                  disabled={updating}
                  onClick={() => setDraftRecommendation(rec)}
                  style={{
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    border: "1px solid var(--soft)",
                    borderRadius: "999px",
                    background: isActive ? "var(--ink)" : "var(--surface)",
                    color: isActive ? "var(--white)" : "var(--ink)",
                    cursor: updating ? "not-allowed" : "pointer",
                    opacity: updating ? 0.7 : 1,
                  }}
                >
                  {BADGE_LABELS[rec]}
                </button>
              );
            })}
          </div>
          {draftRecommendation != null && draftRecommendation !== item.recommendation && (
            <button
              type="button"
              disabled={updating}
              onClick={tryBeginBucketSave}
              style={{
                width: "100%",
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid var(--ink)",
                borderRadius: "10px",
                background: "var(--ink)",
                color: "var(--white)",
                cursor: updating ? "not-allowed" : "pointer",
                opacity: updating ? 0.7 : 1,
                marginBottom: "12px",
              }}
            >
              Save change
            </button>
          )}
          {item.status !== "cleared" ? (
            <button
              type="button"
              disabled={updating}
              onClick={handleMarkCleared}
              style={{
                width: "100%",
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid var(--soft)",
                borderRadius: "10px",
                background: "var(--surface)",
                color: "var(--ink-soft)",
                cursor: updating ? "not-allowed" : "pointer",
                opacity: updating ? 0.7 : 1,
                marginTop:
                  draftRecommendation != null && draftRecommendation !== item.recommendation ? 0 : "12px",
                marginBottom: "12px",
              }}
            >
              Mark as cleared ✓
            </button>
          ) : null}
          {!confirmDelete ? (
            <p style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{ background: "none", border: "none", fontSize: "13px", color: "var(--ink-soft)", textDecoration: "underline", cursor: "pointer" }}
              >
                Delete this item
              </button>
            </p>
          ) : (
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: "8px" }}>Remove this item from your shed?</p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ padding: "8px 16px", fontSize: "13px", background: "#c0392b", color: "var(--white)", border: "none", borderRadius: "8px", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1 }}
                >
                  {deleting ? "Removing…" : "Yes, remove it"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  style={{ padding: "8px 16px", fontSize: "13px", background: "none", border: "1px solid var(--soft)", borderRadius: "8px", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ marginTop: "32px", fontSize: "13px", color: "var(--ink-soft)" }}>
          <Link href="/shed" style={{ color: "var(--ink-soft)", textDecoration: "none" }}>
            ← Back to My Shed
          </Link>
        </p>
      </div>

      <SentimentalNudge
        open={sentimentalOpen}
        itemName={item.item_label}
        onClose={() => setSentimentalOpen(false)}
        onMoveToKeepRemind={handleMoveToKeepRemind}
        onMoveToKeepNoRemind={handleMoveToKeepNoRemind}
        onKeepGoing={handleSentimentalKeepGoing}
      />
      <TipsComingSoonModal tip={activeTip} onClose={() => setActiveTip(null)} />

    </main>
  );
}
