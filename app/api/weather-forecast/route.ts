import { NextRequest, NextResponse } from "next/server";

/**
 * Returns whether rain is expected in the next 24 hours (for curb/large-item suggestion).
 * Uses OpenWeatherMap 5-day forecast (3-hour steps). Free tier.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ rain_next_24h: false });
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lon") ?? searchParams.get("lng");
  if (lat == null || lng == null) {
    return NextResponse.json({ rain_next_24h: false });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=imperial&cnt=8`;
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ rain_next_24h: false });
    }
    const data = (await res.json()) as {
      list?: Array<{
        weather?: Array<{ main: string }>;
        /** Probability of precipitation, 0–1 */
        pop?: number;
        rain?: { "3h"?: number };
      }>;
      cod?: number | string;
    };

    if (data.cod !== 200 && data.cod !== "200") {
      return NextResponse.json({ rain_next_24h: false });
    }

    const list = data.list ?? [];
    // OpenWeather "main" alone is noisy (e.g. Drizzle on low-chance slots). Prefer
    // modeled precip volume + probability so curb advice matches what people call "rain."
    const rainInNext24h = list.some((entry) => {
      const rainMm = entry.rain?.["3h"] ?? 0;
      if (rainMm > 0) return true;
      const pop = typeof entry.pop === "number" ? entry.pop : 0;
      if (pop < 0.35) return false;
      return (entry.weather ?? []).some(
        (w) =>
          w.main === "Rain" ||
          w.main === "Drizzle" ||
          w.main === "Thunderstorm"
      );
    });

    return NextResponse.json({ rain_next_24h: rainInNext24h });
  } catch {
    return NextResponse.json({ rain_next_24h: false });
  }
}
