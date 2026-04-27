import { NextRequest, NextResponse } from "next/server";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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

export type ConsignmentPlace = {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  distance_mi: number;
};

/**
 * Drop obvious donation / generic-thrift hits that Google often mixes into "consignment" text search.
 * Keep rows that mention consignment, resale, or buy/sell–type resale (not donation-only).
 */
function shouldExcludeFromConsignmentList(name: string, address: string): boolean {
  const text = `${name} ${address}`.toLowerCase();
  if (/\bconsignment\b/.test(text) || /\bresale\b/.test(text) || /\bre-?sale\b/.test(text)) {
    return false;
  }
  if (/\b(buy\s*[&/]\s*sell|sell\s+your|we\s+buy|cash\s+for\s+clothes)\b/i.test(text)) {
    return false;
  }
  if (
    /\b(goodwill|salvation\s+army|habitat\s+for\s+humanity|habitat\s+restore|savers|value\s+village|society\s+of\s+st\.?\s*vincent|st\.?\s*vincent\s+de\s+paul|\bsvdp\b)\b/i.test(
      text
    )
  ) {
    return true;
  }
  if (/\b(donation\s+(bin|center|drop|station)|clothing\s+donation|donation\s+only)\b/i.test(text)) {
    return true;
  }
  if (/\b(thrift\s+store|thrift\s+shop|thrift\s+&\s*donation)\b/i.test(text)) {
    return true;
  }
  return false;
}

/** Charity / social-service names that are not resale shops (e.g. "Guardian Angel Family"). */
function shouldExcludeCharityMisclassified(name: string, address: string): boolean {
  const text = `${name} ${address}`.toLowerCase();
  if (/\bconsign/i.test(text) || /\bresale\b/.test(text) || /\btag\s+sale\b/.test(text)) return false;
  if (/\b(buy\s*[&/]\s*sell|vintage|designer|jewelry|furniture|clothing)\b/.test(text)) return false;
  return /\b(guardian\s+angel|st\.?\s*jude|american\s+red\s+cross|catholic\s+charities|united\s+way|food\s+pantry|soup\s+kitchen|homeless|shelter|rescue\s+mission|social\s+services|community\s+services|outreach|parish\s+office)\b/i.test(
    text
  );
}

/** Only list places that clearly read as consignment/resale (not vague "family" thrift). */
function hasConsignmentOrResaleSignal(name: string, address: string): boolean {
  const text = `${name} ${address}`.toLowerCase();
  if (/\bconsign/i.test(text)) return true;
  if (/\bresale\b|\bre-?sale\b/.test(text)) return true;
  if (/\btag\s+sale\b/.test(text)) return true;
  if (/second\s*hand|pre\s*loved|preloved|estate\s+sale|buy\s*[&/]\s*sell/.test(text)) return true;
  if (/worth\s+repeating/i.test(text)) return true;
  return false;
}

async function textSearch(
  apiKey: string,
  query: string,
  lat: number,
  lng: number
): Promise<ConsignmentPlace[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=25000&key=${apiKey}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      name: string;
      place_id: string;
      formatted_address?: string;
      rating?: number;
      geometry?: { location: { lat: number; lng: number } };
    }>;
  };
  if (data.status !== "OK" || !data.results?.length) return [];
  return data.results.map((place) => {
    const loc = place.geometry?.location;
    const distance_km =
      loc != null ? haversineKm(lat, lng, loc.lat, loc.lng) : 0;
    const distance_mi = Math.round(distance_km * 0.621371 * 10) / 10;
    return {
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address ?? "",
      rating: typeof place.rating === "number" ? place.rating : null,
      distance_mi,
    };
  });
}

/**
 * GET ?lat=&lng=
 * Uses only two Text Search queries: "consignment store" and "resale shop".
 * Does not use thrift/donation queries (those live on /api/contextual-places).
 * Results are filtered to remove donation, generic-thrift, and charity mis-hits.
 * Returns at most **3** closest places that clearly signal consignment/resale in the name or address.
 */
export async function GET(request: NextRequest) {
  /** Public read: lat/lng + Places text search only (same idea as POST /api/contextual-places). Guests use this from the home Sell flow. */
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ places: [] as ConsignmentPlace[] });
  }

  const latRaw = request.nextUrl.searchParams.get("lat");
  const lngRaw = request.nextUrl.searchParams.get("lng");
  const lat = latRaw != null ? Number.parseFloat(latRaw) : NaN;
  const lng = lngRaw != null ? Number.parseFloat(lngRaw) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ places: [] as ConsignmentPlace[] });
  }

  try {
    const [a, b] = await Promise.all([
      textSearch(apiKey, "consignment store", lat, lng),
      textSearch(apiKey, "resale shop", lat, lng),
    ]);
    const combined = [...a, ...b].filter((p) => {
      if (!p.place_id) return false;
      if (shouldExcludeFromConsignmentList(p.name, p.address)) return false;
      if (shouldExcludeCharityMisclassified(p.name, p.address)) return false;
      return hasConsignmentOrResaleSignal(p.name, p.address);
    });
    const byId = new Map<string, ConsignmentPlace>();
    for (const p of combined) {
      const existing = byId.get(p.place_id);
      if (existing == null || p.distance_mi < existing.distance_mi) {
        byId.set(p.place_id, p);
      }
    }
    const places = [...byId.values()]
      .sort((x, y) => x.distance_mi - y.distance_mi)
      .slice(0, 3);
    return NextResponse.json({ places });
  } catch (err) {
    console.error("[GET /api/places/consignment]", err);
    return NextResponse.json({ places: [] as ConsignmentPlace[] });
  }
}
