"use client";

import { useEffect } from "react";
import { clearGuestGateDismissedForSignedInUser } from "@/lib/guestGateStorage";
import { useAuthSession } from "@/lib/auth-session-context";

/** Clears guest-gate dismissal from localStorage once we know the user has a session (any route). */
export function ClearGuestGateDismissedOnAuth() {
  const { user, loading } = useAuthSession();
  useEffect(() => {
    if (!loading && user) clearGuestGateDismissedForSignedInUser();
  }, [loading, user]);
  return null;
}
