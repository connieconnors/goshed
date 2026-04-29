import { NextRequest, NextResponse } from "next/server";
import {
  isShelterTextileContext,
  isFabricBedding,
  isMedicalMobility,
  getCarDonationPlacesQuery,
  isBulkyPickupDonationContext,
} from "@/lib/contextualSuggestions";

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

type PlaceHit = { name: string; place_id: string; distance_mi: number };

/** Google may return the same venue under different `place_id`s across text queries. */
function dedupePlacesByNameAndDistance(places: PlaceHit[]): PlaceHit[] {
  const seen = new Set<string>();
  const out: PlaceHit[] = [];
  for (const p of places) {
    const nameKey = p.name.trim().toLowerCase().replace(/\s+/g, " ");
    const key = `${nameKey}|${p.distance_mi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Safety filter — consignment belongs on Sell only, never in Donate lists. */
function isLikelyConsignmentResaleName(name: string): boolean {
  const n = name.toLowerCase();
  return /\b(consign|consignment|resale|re-?sale|tag\s+sale|worth\s+repeating)\b/.test(n);
}

/** Donation search filter — excludes vehicle-donation SEO results without globally blocking "car". */
function isLikelyVehicleDonationResult(name: string): boolean {
  const n = name.toLowerCase();
  return (
    /\b(car|vehicle|auto)\s+donations?\b/.test(n) ||
    /\bdonat(e|ion)\s+(your\s+)?(car|vehicle|auto)\b/.test(n) ||
    /\bjunk\s+car\b/.test(n)
  );
}

async function fetchPlaces(
  apiKey: string,
  query: string,
  lat: number,
  lng: number
): Promise<PlaceHit[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=20000&key=${apiKey}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      name: string;
      place_id: string;
      geometry?: { location: { lat: number; lng: number } };
    }>;
  };
  if (data.status !== "OK" || !data.results?.length) return [];
  return data.results.map((place) => {
    const loc = place.geometry?.location;
    const distance_km = loc != null ? haversineKm(lat, lng, loc.lat, loc.lng) : 0;
    const distance_mi = Math.round(distance_km * 0.621371 * 10) / 10;
    return { name: place.name, place_id: place.place_id, distance_mi };
  });
}

/** Fabric/bedding: bins + rescues, top 8. Else: thrift + extras; optional pickup orgs (ReStore, SVdP, SA) for bulky items, max 3. General non-fabric list capped at 5, deduped against pickup. */
export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ places: [], pickupPlaces: [] });
  }

  let body: { lat?: number; lng?: number; item_label?: string; value_range?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ places: [], pickupPlaces: [] });
  }

  const { lat, lng, item_label, value_range, description } = body;
  if (lat == null || lng == null) {
    return NextResponse.json({ places: [], pickupPlaces: [] });
  }

  try {
    /** Thrift-heavy queries are wrong for used plain bedding — shelters first, drop-off only. */
    if (isShelterTextileContext(item_label, description)) {
      const [rescueHits, shelterHits, humaneHits] = await Promise.all([
        fetchPlaces(apiKey, "animal rescue", lat, lng),
        fetchPlaces(apiKey, "animal shelter", lat, lng),
        fetchPlaces(apiKey, "humane society animal shelter", lat, lng),
      ]);
      const byId = new Map<string, PlaceHit>();
      for (const p of [...rescueHits, ...shelterHits, ...humaneHits]) {
        if (!byId.has(p.place_id)) byId.set(p.place_id, p);
      }
      const places = dedupePlacesByNameAndDistance(
        [...byId.values()]
          .filter((p) => !isLikelyConsignmentResaleName(p.name))
          .filter((p) => !isLikelyVehicleDonationResult(p.name))
          .sort((a, b) => a.distance_mi - b.distance_mi)
      ).slice(0, 8);
      return NextResponse.json({ places, pickupPlaces: [] });
    }

    const fabric = isFabricBedding(item_label);

    if (fabric) {
      const [binResults, rescueResults] = await Promise.all([
        Promise.all([
          fetchPlaces(apiKey, "clothing donation bin", lat, lng),
          fetchPlaces(apiKey, "donation bin", lat, lng),
        ]).then(([a, b]) => [...a, ...b]),
        Promise.all([
          fetchPlaces(apiKey, "animal rescue", lat, lng),
          fetchPlaces(apiKey, "animal shelter", lat, lng),
        ]).then(([a, b]) => [...a, ...b]),
      ]);
      const byId = new Map<string, PlaceHit>();
      [...binResults, ...rescueResults].forEach((p) => {
        if (!byId.has(p.place_id)) byId.set(p.place_id, p);
      });
      const places = dedupePlacesByNameAndDistance(
        [...byId.values()]
          .filter((p) => !isLikelyVehicleDonationResult(p.name))
          .sort((a, b) => a.distance_mi - b.distance_mi)
      ).slice(0, 8);
      return NextResponse.json({ places, pickupPlaces: [] });
    }

    const bulkyPickup = isBulkyPickupDonationContext(item_label, description);

    const pickupSearchPromise: Promise<PlaceHit[]> = bulkyPickup
      ? Promise.all([
          fetchPlaces(apiKey, "Breast Cancer donation pickup", lat, lng),
          fetchPlaces(apiKey, "Vietnam Veterans donation pickup", lat, lng),
          fetchPlaces(apiKey, "Big Brothers Big Sisters donation pickup", lat, lng),
          fetchPlaces(apiKey, "Lupus Foundation donation pickup", lat, lng),
          fetchPlaces(apiKey, "GreenDrop donation pickup", lat, lng),
          fetchPlaces(apiKey, "Habitat for Humanity ReStore donation pickup", lat, lng),
          fetchPlaces(apiKey, "Salvation Army donation pickup", lat, lng),
          fetchPlaces(apiKey, "St. Vincent de Paul donation pickup", lat, lng),
          fetchPlaces(apiKey, "furniture donation pickup charity", lat, lng),
        ]).then((pickupResults) => {
          const pickupById = new Map<string, PlaceHit>();
          for (const p of pickupResults.flat()) {
            const existing = pickupById.get(p.place_id);
            if (existing == null || p.distance_mi < existing.distance_mi) {
              pickupById.set(p.place_id, p);
            }
          }
          return dedupePlacesByNameAndDistance(
            [...pickupById.values()]
              .filter((p) => !isLikelyConsignmentResaleName(p.name))
              .filter((p) => !isLikelyVehicleDonationResult(p.name))
              .sort((a, b) => a.distance_mi - b.distance_mi)
          ).slice(0, 5);
        })
      : Promise.resolve([]);

    const medical = isMedicalMobility(item_label);
    const carDonationQuery = getCarDonationPlacesQuery(item_label, value_range, description);

    /** Primary donation discovery (Donate flow only — consignment is Sell-only via /api/places/consignment). */
    const queryPromises: Promise<PlaceHit[]>[] = [
      fetchPlaces(apiKey, "thrift store", lat, lng),
      fetchPlaces(apiKey, "donation drop off", lat, lng),
      fetchPlaces(apiKey, "charity donation center", lat, lng),
    ];
    if (medical) {
      queryPromises.push(fetchPlaces(apiKey, "senior center", lat, lng));
    }
    if (carDonationQuery) {
      queryPromises.push(fetchPlaces(apiKey, carDonationQuery, lat, lng));
    }

    const [pickupPlaces, resultSets] = await Promise.all([
      pickupSearchPromise,
      Promise.all(queryPromises),
    ]);
    const pickupIds = new Set(pickupPlaces.map((p) => p.place_id));
    const byId = new Map<string, PlaceHit>();
    for (const p of resultSets.flat()) {
      const existing = byId.get(p.place_id);
      if (existing == null || p.distance_mi < existing.distance_mi) {
        byId.set(p.place_id, p);
      }
    }
    const places = dedupePlacesByNameAndDistance(
      [...byId.values()]
        .filter((p) => !pickupIds.has(p.place_id))
        .filter((p) => !isLikelyConsignmentResaleName(p.name))
        .filter((p) => !isLikelyVehicleDonationResult(p.name))
        .sort((a, b) => a.distance_mi - b.distance_mi)
    ).slice(0, 5);
    const pickupDeduped = dedupePlacesByNameAndDistance(
      pickupPlaces.filter((p) => !isLikelyVehicleDonationResult(p.name))
    );
    return NextResponse.json({ places, pickupPlaces: pickupDeduped });
  } catch {
    return NextResponse.json({ places: [], pickupPlaces: [] });
  }
}
