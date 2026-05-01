export const GUEST_GATE_DISMISSED_KEY = "goshed_guest_gate_dismissed";
export const GUEST_ANALYSIS_COUNT_KEY = "goshed_guest_analysis_count";
const HAD_AUTH_SESSION_KEY = "goshed_had_auth_session";

export function clearGuestTrialState() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(GUEST_GATE_DISMISSED_KEY);
  localStorage.removeItem(GUEST_ANALYSIS_COUNT_KEY);
}

/** Call when the user is signed in so prior guest trial state does not carry over. */
export function clearGuestTrialStateForSignedInUser() {
  if (typeof localStorage === "undefined") return;
  clearGuestTrialState();
  localStorage.setItem(HAD_AUTH_SESSION_KEY, "true");
}

/**
 * If a device previously had an authenticated session but is now signed out
 * (for example after deleting test users in Supabase), clear stale guest trial state once.
 */
export function clearGuestTrialStateAfterAuthTransition(): boolean {
  if (typeof localStorage === "undefined") return false;
  if (localStorage.getItem(HAD_AUTH_SESSION_KEY) !== "true") return false;
  clearGuestTrialState();
  localStorage.removeItem(HAD_AUTH_SESSION_KEY);
  return true;
}

export function guestGateDismissedInStorage(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(GUEST_GATE_DISMISSED_KEY) === "true";
}

export function markGuestGateDismissed() {
  if (typeof localStorage !== "undefined") localStorage.setItem(GUEST_GATE_DISMISSED_KEY, "true");
}

export function getStoredGuestAnalysisCount(): number {
  if (typeof localStorage === "undefined") return 0;
  const v = localStorage.getItem(GUEST_ANALYSIS_COUNT_KEY);
  const n = parseInt(v ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export function setStoredGuestAnalysisCount(count: number) {
  if (typeof localStorage !== "undefined") localStorage.setItem(GUEST_ANALYSIS_COUNT_KEY, String(count));
}
