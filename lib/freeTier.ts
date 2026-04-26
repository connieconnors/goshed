/** Logged-in users: non-hidden items before analyze paywall (matches GET /api/auth/session count). */
export const FREE_LOGGED_IN_ITEM_LIMIT = 10;

/** Guest: completed analyze + initial recommendation flows before account gate (localStorage). */
export const GUEST_ANALYSIS_LIMIT = 10;

/** Logged-in home banner: show upgrade nudge when saved item count reaches this (of FREE_LOGGED_IN_ITEM_LIMIT). */
export const UPGRADE_NUDGE_AT_ITEM_COUNT = 5;
