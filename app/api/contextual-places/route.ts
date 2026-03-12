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

/** Search: "thrift donation", 20km radius, no place type filter. Returns top 5 by distance with name, distance_mi, place_id for Maps link. */
export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ places: [] });
  }

  let body: { lat?: number; lng?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ places: [] });
  }

  const { lat, lng } = body;
  if (lat == null || lng == null) {
    return NextResponse.json({ places: [] });
  }

  const searchQuery = `thrift donation near ${lat},${lng}`;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&location=${lat},${lng}&radius=20000&key=${apiKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        name: string;
        vicinity?: string;
        formatted_address?: string;
        place_id: string;
        geometry?: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json({ places: [] });
    }

    const withDistance = data.results.map((place) => {
      const loc = place.geometry?.location;
      const distance_km =
        loc != null ? haversineKm(lat, lng, loc.lat, loc.lng) : 0;
      const distance_mi = Math.round(distance_km * 0.621371 * 10) / 10;
      return {
        name: place.name,
        distance_mi,
        place_id: place.place_id,
      };
    });
    const places = withDistance
      .sort((a, b) => a.distance_mi - b.distance_mi)
      .slice(0, 5);

    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
