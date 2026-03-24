"use client";

import { useEffect } from "react";
import { clearGuestGateDismissedForSignedInUser } from "@/lib/guestGateStorage";

/** Clears guest-gate dismissal from localStorage once we know the user has a session (any route). */
export function ClearGuestGateDismissedOnAuth() {
  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user?: unknown }) => {
        if (d.user) clearGuestGateDismissedForSignedInUser();
      })
      .catch(() => {});
  }, []);
  return null;
}
