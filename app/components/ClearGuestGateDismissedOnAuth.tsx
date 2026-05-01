"use client";

import { useEffect } from "react";
import { clearGuestTrialStateForSignedInUser } from "@/lib/guestGateStorage";
import { useAuthSession } from "@/lib/auth-session-context";

/** Clears guest trial localStorage once we know the user has a real session (any route). */
export function ClearGuestGateDismissedOnAuth() {
  const { user, loading } = useAuthSession();
  useEffect(() => {
    if (!loading && user) clearGuestTrialStateForSignedInUser();
  }, [loading, user]);
  return null;
}
