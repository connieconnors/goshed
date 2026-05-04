"use client";

import type { TipLink } from "@/lib/tips";

type Props = {
  tip: TipLink | null;
  onClose: () => void;
};

export function TipsComingSoonModal({ tip, onClose }: Props) {
  if (!tip) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",
        background: "rgba(44,36,22,0.42)",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tips-coming-soon-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 340,
          background: "var(--white)",
          borderRadius: 18,
          border: "1px solid rgba(196,168,130,0.36)",
          boxShadow: "0 18px 54px rgba(44,36,22,0.18)",
          padding: "22px 20px",
          color: "var(--ink)",
          fontFamily: "var(--font-body)",
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            color: "var(--accent)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          GoShed.ai
        </p>
        <h2
          id="tips-coming-soon-title"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.15,
            margin: "0 0 8px",
          }}
        >
          {tip.title}
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 0 18px" }}>
          Coming soon on GoShed.ai. For now, your recommendation already includes the practical next step.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="goshed-primary-btn"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "11px 16px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
