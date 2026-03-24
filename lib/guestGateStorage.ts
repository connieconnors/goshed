export const GUEST_GATE_DISMISSED_KEY = "goshed_guest_gate_dismissed";

/** Call when the user is signed in so a prior guest dismissal does not carry over. */
export function clearGuestGateDismissedForSignedInUser() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(GUEST_GATE_DISMISSED_KEY);
}

export function guestGateDismissedInStorage(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(GUEST_GATE_DISMISSED_KEY) === "true";
}

export function markGuestGateDismissed() {
  if (typeof localStorage !== "undefined") localStorage.setItem(GUEST_GATE_DISMISSED_KEY, "true");
}
