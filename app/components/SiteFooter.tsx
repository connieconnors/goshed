"use client";

import { usePathname, useRouter } from "next/navigation";

const linkStyle = { color: "inherit" as const, textDecoration: "none" as const };

export function SiteFooter() {
  const pathname = usePathname();
  const router = useRouter();

  const openVoluntaryPaywall = () => {
    if (pathname === "/") {
      window.dispatchEvent(new CustomEvent("goshed-open-voluntary-paywall"));
    } else {
      router.push("/?upgrade=1");
    }
  };

  return (
    <footer
      style={{
        padding: "16px 24px",
        textAlign: "center",
        fontSize: "11px",
        color: "var(--ink-soft)",
        fontFamily: "var(--font-body)",
      }}
    >
      © 2026 GoShed ·{" "}
      <a href="/privacy" style={linkStyle}>
        Privacy
      </a>
      {" · "}
      <a href="/terms" style={linkStyle}>
        Terms
      </a>
      {" · "}
      <a href="mailto:support@thriftshopper.com" style={linkStyle}>
        Contact
      </a>
      {" · "}
      <button
        type="button"
        onClick={openVoluntaryPaywall}
        style={{
          ...linkStyle,
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          cursor: "pointer",
        }}
      >
        Upgrade ✦
      </button>
    </footer>
  );
}
