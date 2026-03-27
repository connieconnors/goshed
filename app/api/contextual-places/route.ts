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

/** True if item sounds like fabric/bedding (used sheets, pillows, towels, blankets) for Places search. */
function isFabricBedding(itemLabel: string | undefined): boolean {
  if (!itemLabel?.trim()) return false;
  const t = itemLabel.toLowerCase();
  return (
    /\b(sheet|pillowcase|pillow|blanket|towel|towels|fabric|bedding|linen)\b/.test(t) ||
    /\b(comforter|quilt|spread|rag|scraps)\b/.test(t)
  );
}

type PlaceHit = { name: string; place_id: string; distance_mi: number };

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

/** Search: thrift store + donation drop off (or fabric/bedding: bins + animal rescue). 20km radius. Non-fabric: top 5 by distance; fabric: top 8. */
export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ places: [] });
  }

  let body: { lat?: number; lng?: number; item_label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ places: [] });
  }

  const { lat, lng, item_label } = body;
  if (lat == null || lng == null) {
    return NextResponse.json({ places: [] });
  }

  try {
    const fabric = isFabricBedding(item_label);

    if (fabric) {
      // Consumer-facing donation bins (not B2B textile recyclers). Animal rescue/shelters for bedding and towels.
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
      const places = [...byId.values()]
        .sort((a, b) => a.distance_mi - b.distance_mi)
        .slice(0, 8);
      return NextResponse.json({ places });
    }

    const [thriftResults, dropOffResults] = await Promise.all([
      fetchPlaces(apiKey, "thrift store", lat, lng),
      fetchPlaces(apiKey, "donation drop off", lat, lng),
    ]);
    const byId = new Map<string, PlaceHit>();
    for (const p of [...thriftResults, ...dropOffResults]) {
      const existing = byId.get(p.place_id);
      if (existing == null || p.distance_mi < existing.distance_mi) {
        byId.set(p.place_id, p);
      }
    }
    const places = [...byId.values()]
      .sort((a, b) => a.distance_mi - b.distance_mi)
      .slice(0, 5);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
