"use client";

const GUEST_REVENUECAT_APP_USER_ID_KEY = "goshed_guest_revenuecat_app_user_id";
const GUEST_PRO_ACTIVE_KEY = "goshed_guest_pro_active";

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newGuestRevenueCatAppUserId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest:${crypto.randomUUID()}`;
  }
  return `guest:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateGuestRevenueCatAppUserId(): string {
  if (!storageAvailable()) return newGuestRevenueCatAppUserId();
  const existing = localStorage.getItem(GUEST_REVENUECAT_APP_USER_ID_KEY);
  if (existing?.trim()) return existing;
  const next = newGuestRevenueCatAppUserId();
  localStorage.setItem(GUEST_REVENUECAT_APP_USER_ID_KEY, next);
  return next;
}

export function hasGuestProAccess(): boolean {
  if (!storageAvailable()) return false;
  return localStorage.getItem(GUEST_PRO_ACTIVE_KEY) === "true";
}

export function markGuestProAccessActive() {
  if (!storageAvailable()) return;
  localStorage.setItem(GUEST_PRO_ACTIVE_KEY, "true");
  window.dispatchEvent(new Event("goshed-guest-pro-updated"));
}
