/** Single source for paywall / guest / nudge copy (see product spec). */
export const MOMENT_COPY = {
  guestGateBody:
    "You've analyzed 10 items. Create a free account to save your shed and keep going — your first 10 saved items are free.",
  guestGateSubtext: "After 10 saved items, plans start at $2.99/month.",
  nearLimitNudge: "Almost there — 1 item left on your free plan.",
  nearLimitNudgeSubtext: "After that, it's $2.99/month or $24.99/year.",
  paywallTitle: "You've filled your free shed.",
  paywallTitleVoluntary: "You're just getting started.",
  /** Notification / nudge opt-in (password onboarding + Upgrade inline signup). */
  notificationNudgeCheckboxLabel: "Check in with me — I work better with a nudge.",
} as const;
