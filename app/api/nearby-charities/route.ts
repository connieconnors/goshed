import { NextRequest, NextResponse } from "next/server";

/** Distance in km between two lat/lng points (Haversine). */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const MAX_DISTANCE_KM = 16;

function isLikelyVehicleDonationResult(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    /\b(car|vehicle|auto)\s+donations?\b/.test(lower) ||
    /\bdonat(e|ion)\s+(your\s+)?(car|vehicle|auto)\b/.test(lower) ||
    /\bjunk\s+car\b/.test(lower)
  );
}

const ITEM_CATEGORIES = ["furniture", "clothing", "housewares", "electronics", "books", "art", "general"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

type NationalOrg = { id: string; name: string; note: string; url: string; categories: readonly ItemCategory[] };

// National pickup services — filter by item_category when provided
const NATIONAL_PICKUP: NationalOrg[] = [
  {
    id: "restore",
    name: "Habitat for Humanity ReStore",
    note: "Accepts furniture, appliances, building materials. May offer pickup in some areas — confirm locally.",
    url: "https://www.habitat.org/restores",
    categories: ["furniture", "housewares"],
  },
  {
    id: "vva",
    name: "Veterans of America",
    note: "Accepts clothing, housewares, small furniture. Pickup may be available in some areas — confirm locally.",
    url: "https://pickupplease.org",
    categories: ["clothing", "furniture", "general"],
  },
  {
    id: "salvation-army",
    name: "Salvation Army",
    note: "Accepts most household items. Pickup may be offered in some areas — confirm locally.",
    url: "https://www.salvationarmyusa.org/usn/donate-goods",
    categories: ["furniture", "clothing", "housewares", "electronics", "books", "art", "general"],
  },
];

function nationalForCategory(category: ItemCategory): Array<{ name: string; note: string; url: string }> {
  return NATIONAL_PICKUP.filter((org) => org.categories.includes(category)).map(({ name, note, url }) => ({ name, note, url }));
}

export async function POST(request: NextRequest) {
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  let body: { lat?: number; lng?: number; item_label?: string; item_category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lat, lng, item_label, item_category } = body;
  const category: ItemCategory = ITEM_CATEGORIES.includes((item_category ?? "") as ItemCategory) ? (item_category as ItemCategory) : "general";

  const national = nationalForCategory(category);

  // If no location, return national pickup options only
  if (!lat || !lng) {
    return NextResponse.json({
      local: [],
      national,
      source: "national_only",
    });
  }

  if (!googleApiKey) {
    console.warn("[nearby-charities] No Google Places API key configured");
    return NextResponse.json({
      local: [],
      national,
      source: "national_only",
    });
  }

  try {
    type PlaceResult = {
      name: string;
      vicinity?: string;
      formatted_address?: string;
      rating?: number;
      place_id: string;
      opening_hours?: { open_now: boolean };
      geometry?: { location: { lat: number; lng: number } };
    };
    type TextSearchResponse = { results?: PlaceResult[]; status: string };

    const queries = [
      `Goodwill near ${lat},${lng}`,
      `Salvation Army donation near ${lat},${lng}`,
      `Veterans of America pickup near ${lat},${lng}`,
      `Habitat for Humanity ReStore near ${lat},${lng}`,
      `thrift store donation drop off near ${lat},${lng}`,
      `clothing donation bin near ${lat},${lng}`,
    ];

    // radius=16000 meters (~10 miles) limits results to that distance
    const results = await Promise.all(
      queries.map((q) =>
        fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${lat},${lng}&radius=16000&key=${googleApiKey}`
        ).then((r) => r.json() as Promise<TextSearchResponse>)
      )
    );

    console.log("[nearby-charities] Google Places full response:", results.map((data, i) => ({ query: queries[i], status: data.status, results: data.results })));

    const userLat = lat as number;
    const userLng = lng as number;
    const seen = new Set<string>();
    const local = results
      .flatMap((data) => (data.status === "OK" ? data.results ?? [] : []))
      .filter((place) => {
        if (!place?.place_id || seen.has(place.place_id)) return false;
        seen.add(place.place_id);
        const loc = place.geometry?.location;
        if (loc && haversineKm(userLat, userLng, loc.lat, loc.lng) > MAX_DISTANCE_KM) return false;
        return true;
      })
      .filter((place) => !isLikelyVehicleDonationResult(place.name ?? ""))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5)
      .map((place) => ({
        name: place.name,
        address: place.vicinity ?? place.formatted_address ?? "",
        rating: place.rating,
        open_now: place.opening_hours?.open_now ?? null,
        place_id: place.place_id,
      }));

    return NextResponse.json({
      local,
      national,
      source: "google_places",
      item_label: item_label ?? null,
    });
  } catch (err) {
    console.error("[nearby-charities] fetch error:", err);
    return NextResponse.json({
      local: [],
      national,
      source: "national_only",
    });
  }
}
