"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthSession } from "@/lib/auth-session-context";

const linkStyle = { color: "inherit" as const, textDecoration: "none" as const };

export function SiteFooter() {
  const pathname = usePathname();
  const router = useRouter();
  const { isPro, code } = useAuthSession();
  const hasPremiumAccess = isPro || Boolean(code);

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
        padding: "14px 20px calc(14px + env(safe-area-inset-bottom, 0px))",
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
      {hasPremiumAccess ? (
        <span style={linkStyle}>Premium active ✦</span>
      ) : (
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
          Go unlimited ✦
        </button>
      )}
    </footer>
  );
}
