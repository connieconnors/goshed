"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

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
};

const BADGE_LABELS: Record<string, string> = {
  sell: "Sell",
  donate: "Donate",
  gift: "Gift",
  curb: "Curb",
  keep: "Keep",
  repurpose: "Repurpose",
};

const REC_OPTIONS = ["sell", "donate", "gift", "curb", "keep", "repurpose"] as const;

function normalizeStatus(s: unknown): string {
  const v = typeof s === "string" ? s.toLowerCase() : "";
  return v === "done" ? "done" : "pending";
}

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [draftRecommendation, setDraftRecommendation] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const patchItem = async (
    body: { recommendation?: string; status?: string },
    onSuccess?: (data: ItemDetail) => void
  ) => {
    if (!id || updating) return;
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
    } catch {
      // Keep current item state on error
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) router.push("/dashboard");
  };

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
          <Link href="/dashboard" style={{ fontSize: "13px", color: "var(--ink-soft)", textDecoration: "none" }}>
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
          <Link href="/dashboard" style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}>
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
            <div style={{ width: "100%", height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontSize: "14px" }}>
              No image
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
              onClick={() => patchItem({ recommendation: draftRecommendation }, () => setDraftRecommendation(null))}
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
                  style={{ padding: "8px 16px", fontSize: "13px", background: "#c0392b", color: "var(--white)", border: "none", borderRadius: "8px", cursor: "pointer" }}
                >
                  Yes, remove it
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
          <Link href="/dashboard" style={{ color: "var(--ink-soft)", textDecoration: "none" }}>
            ← Back to My Shed
          </Link>
        </p>
      </div>
    </main>
  );
}
