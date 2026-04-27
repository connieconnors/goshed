import { FREE_LOGGED_IN_ITEM_LIMIT, GUEST_ANALYSIS_LIMIT } from "./freeTier";

/** Single source for paywall / guest / nudge copy (see product spec). */
export const MOMENT_COPY = {
  guestGateBody: `You've analyzed ${GUEST_ANALYSIS_LIMIT} items. Create a free account to save your shed and keep going — your first ${FREE_LOGGED_IN_ITEM_LIMIT} saved items are free.`,
  guestGateSubtext: `After ${FREE_LOGGED_IN_ITEM_LIMIT} saved items, plans start at $2.99/month.`,
  /** Home banner (shown from UPGRADE_NUDGE_AT_ITEM_COUNT through free-tier ceiling; title uses live count in UI). */
  upgradeNudgeSubtext: "Upgrade anytime for more room — or keep going on the free plan.",
  paywallTitle: "You've filled your free shed.",
  paywallTitleVoluntary: "You're just getting started.",
  /** Notification / nudge opt-in (password onboarding + Upgrade inline signup). */
  notificationNudgeCheckboxLabel: "Check in with me — I work better with a nudge.",
} as const;
