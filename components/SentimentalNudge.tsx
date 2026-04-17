"use client";

import { useCallback, useState } from "react";

type SentimentalNudgeProps = {
  open: boolean;
  itemName: string;
  onClose: () => void;
  onMoveToKeepRemind: () => Promise<boolean>;
  onMoveToKeepNoRemind: () => Promise<boolean>;
  onKeepGoing: () => void;
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 70,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(0,0,0,0.5)",
};

const panel: React.CSSProperties = {
  background: "#F5F0E8",
  borderRadius: 18,
  padding: 28,
  maxWidth: 400,
  width: "100%",
  boxShadow: "0 8px 32px rgba(44,36,22,0.15)",
  fontFamily: "var(--font-body), Georgia, serif",
  border: "1px solid #C4A882",
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-cormorant), serif",
  fontSize: 22,
  fontWeight: 600,
  color: "#2C2416",
  marginTop: 0,
  marginBottom: 12,
  lineHeight: 1.25,
};

const bodyText: React.CSSProperties = {
  fontSize: 15,
  color: "#2C2416",
  lineHeight: 1.5,
  marginBottom: 20,
};

const primaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px 20px",
  background: "#5E7155",
  color: "#FDFAF5",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  textAlign: "center",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  marginBottom: 10,
};

const secondaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px 20px",
  background: "transparent",
  color: "#2C2416",
  border: "1px solid #E4DDD0",
  borderRadius: 12,
  fontSize: 15,
  cursor: "pointer",
  fontFamily: "inherit",
  marginBottom: 10,
};

const tertiaryBtn: React.CSSProperties = {
  ...secondaryBtn,
  marginBottom: 0,
  color: "#6B5B45",
};

export function SentimentalNudge({
  open,
  itemName,
  onClose,
  onMoveToKeepRemind,
  onMoveToKeepNoRemind,
  onKeepGoing,
}: SentimentalNudgeProps) {
  const [busy, setBusy] = useState(false);

  const wrap = useCallback(
    async (fn: () => Promise<boolean>) => {
      if (busy) return;
      setBusy(true);
      try {
        const ok = await fn();
        if (ok) onClose();
      } finally {
        setBusy(false);
      }
    },
    [busy, onClose]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sentimental-title"
      style={overlay}
    >
      <div style={panel}>
        <h2 id="sentimental-title" style={title}>
          Moved this a few times?
        </h2>
        <p style={bodyText}>
          You&apos;ve moved <strong>{itemName}</strong> a couple of times. Is it sentimental? It might belong in your
          Keep pile for now — you can always revisit in a month.
        </p>
        <button
          type="button"
          style={primaryBtn}
          disabled={busy}
          onClick={() => wrap(onMoveToKeepRemind)}
        >
          {busy ? "Saving…" : "Move to Keep — remind me in a month"}
        </button>
        <button
          type="button"
          style={secondaryBtn}
          disabled={busy}
          onClick={() => wrap(onMoveToKeepNoRemind)}
        >
          Move to Keep — no reminder needed
        </button>
        <button
          type="button"
          style={tertiaryBtn}
          disabled={busy}
          onClick={() => {
            if (busy) return;
            onKeepGoing();
            onClose();
          }}
        >
          Keep going, I know what I want
        </button>
      </div>
    </div>
  );
}
