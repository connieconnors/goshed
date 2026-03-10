import { NextRequest, NextResponse } from "next/server";

const CHARITY_KEYWORDS = [
  "Habitat for Humanity ReStore",
  "Goodwill",
  "Salvation Army",
  "Vietnam Veterans",
  "Savers",
  "ThriftTown",
  "donation center",
];

// National pickup services — hardcoded fallback
const NATIONAL_PICKUP = [
  {
    name: "Habitat for Humanity ReStore",
    note: "Accepts furniture, appliances, building materials. Free pickup available.",
    url: "https://www.habitat.org/restores",
  },
  {
    name: "Vietnam Veterans of America",
    note: "Accepts clothing, housewares, small furniture. Free pickup.",
    url: "https://pickupplease.org",
  },
  {
    name: "Salvation Army",
    note: "Accepts most household items. Pickup available in many areas.",
    url: "https://www.salvationarmyusa.org/usn/donate-goods",
  },
];

export async function POST(request: NextRequest) {
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  let body: { lat?: number; lng?: number; item_label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lat, lng, item_label } = body;

  // If no location, return national pickup options only
  if (!lat || !lng) {
    return NextResponse.json({
      local: [],
      national: NATIONAL_PICKUP,
      source: "national_only",
    });
  }

  if (!googleApiKey) {
    console.warn("[nearby-charities] No Google Places API key configured");
    return NextResponse.json({
      local: [],
      national: NATIONAL_PICKUP,
      source: "national_only",
    });
  }

  try {
    // Search for donation/thrift locations near the user
    const query = encodeURIComponent("donation drop off thrift store charity");
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=8000&keyword=${query}&key=${googleApiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as {
      results?: Array<{
        name: string;
        vicinity: string;
        rating?: number;
        place_id: string;
        opening_hours?: { open_now: boolean };
      }>;
      status: string;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[nearby-charities] Places API error:", data.status);
      return NextResponse.json({
        local: [],
        national: NATIONAL_PICKUP,
        source: "national_only",
      });
    }

    const local = (data.results ?? [])
      .filter((place) =>
        CHARITY_KEYWORDS.some((kw) =>
          place.name.toLowerCase().includes(kw.toLowerCase())
        )
      )
      .slice(0, 3)
      .map((place) => ({
        name: place.name,
        address: place.vicinity,
        rating: place.rating,
        open_now: place.opening_hours?.open_now ?? null,
        place_id: place.place_id,
      }));

    return NextResponse.json({
      local,
      national: NATIONAL_PICKUP,
      source: "google_places",
      item_label: item_label ?? null,
    });
  } catch (err) {
    console.error("[nearby-charities] fetch error:", err);
    return NextResponse.json({
      local: [],
      national: NATIONAL_PICKUP,
      source: "national_only",
    });
  }
}
