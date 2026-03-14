/**
 * Server-side RevenueCat entitlement check.
 * Uses REST API: GET /v1/subscribers/{app_user_id}
 * Requires REVENUECAT_SECRET_API_KEY (Secret API key from RevenueCat dashboard).
 * Use Supabase user ID as app_user_id so purchases are tied to the same user.
 */

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";
const ENTITLEMENT_ID = "GoShed Pro";

export type RevenueCatEntitlement = {
  expires_date: string | null;
  product_identifier?: string;
};

export type RevenueCatSubscriber = {
  entitlements?: Record<string, RevenueCatEntitlement>;
};

/** Returns true if the user has an active "GoShed Pro" entitlement. */
export async function hasProEntitlement(appUserId: string): Promise<boolean> {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!secretKey) {
    return false;
  }

  const encodedId = encodeURIComponent(appUserId);
  try {
    const res = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodedId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      if (res.status === 404) return false;
      console.error("[revenuecat] subscriber fetch failed:", res.status, await res.text());
      return false;
    }

    const data = (await res.json()) as { subscriber?: RevenueCatSubscriber };
    const entitlements = data.subscriber?.entitlements;
    if (!entitlements || typeof entitlements !== "object") return false;

    const pro = entitlements[ENTITLEMENT_ID];
    if (!pro) return false;

    const expires = pro.expires_date;
    if (expires == null) return true; // lifetime
    const expiresMs = new Date(expires).getTime();
    return expiresMs > Date.now();
  } catch (err) {
    console.error("[revenuecat] error:", err);
    return false;
  }
}

/** Grant GoShed Pro entitlement (promotional). Duration: "yearly" or "lifetime". */
export async function grantProEntitlement(
  appUserId: string,
  duration: "yearly" | "lifetime" = "yearly"
): Promise<boolean> {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!secretKey) return false;

  const encodedUserId = encodeURIComponent(appUserId);
  const encodedEntitlement = encodeURIComponent(ENTITLEMENT_ID);
  const url = `${REVENUECAT_API_BASE}/subscribers/${encodedUserId}/entitlements/${encodedEntitlement}/promotional`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ duration }),
    });
    return res.ok;
  } catch (err) {
    console.error("[revenuecat] grant entitlement error:", err);
    return false;
  }
}
