import { FREE_LOGGED_IN_ITEM_LIMIT, GUEST_ANALYSIS_LIMIT } from "./freeTier";

/** Single source for paywall / guest / nudge copy (see product spec). */
export const MOMENT_COPY = {
  guestGateBody: `You’ve made ${GUEST_ANALYSIS_LIMIT} decisions. Create a free account to keep your first ${FREE_LOGGED_IN_ITEM_LIMIT} items, sync across devices, and access your Shed anytime.`,
  paywallTitle: "You've filled your free shed.",
  paywallTitleVoluntary: "You're just getting started.",
  /** Notification / nudge opt-in (password onboarding + Upgrade inline signup). */
  notificationNudgeCheckboxLabel: "Check in with me — I work better with a nudge.",
} as const;
