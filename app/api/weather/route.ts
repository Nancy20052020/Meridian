import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Point = { lat: number; lon: number };

type CacheEntry = { at: number; body: unknown };

const cache = new Map<string, CacheEntry>();
const TTL = 15 * 60 * 1000;

type CurrentBlock = {
  current?: {
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    precipitation?: number;
    wave_height?: number | null;
  };
};

function asList(payload: unknown): CurrentBlock[] {
  if (Array.isArray(payload)) return payload as CurrentBlock[];
  if (payload && typeof payload === "object") return [payload as CurrentBlock];
  return [];
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("points");
  if (!raw) {
    return NextResponse.json({ error: "points required" }, { status: 400 });
  }

  const points: Point[] = [];
  for (const part of raw.split(";")) {
    const [latText, lonText] = part.split(",");
    const lat = Number(latText);
    const lon = Number(lonText);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: "bad point" }, { status: 400 });
    }
    points.push({ lat, lon });
  }
  if (points.length < 2 || points.length > 16) {
    return NextResponse.json({ error: "point count" }, { status: 400 });
  }

  const key = points.map((point) => `${point.lat.toFixed(2)},${point.lon.toFixed(2)}`).join(";");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.body);
  }

  const lats = points.map((point) => point.lat.toFixed(3)).join(",");
  const lons = points.map((point) => point.lon.toFixed(3)).join(",");

  try {
    const [windRes, waveRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_gusts_10m,precipitation&wind_speed_unit=kn`,
        { cache: "no-store" },
      ),
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&current=wave_height`,
        { cache: "no-store" },
      ),
    ]);

    if (!windRes.ok) {
      return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
    }

    const wind = asList(await windRes.json());
    const waves = waveRes.ok ? asList(await waveRes.json()) : [];
    if (wind.length !== points.length) {
      return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
    }

    const body = {
      points: points.map((point, index) => {
        const current = wind[index]?.current ?? {};
        const wave = waves[index]?.current?.wave_height;
        return {
          lat: point.lat,
          lon: point.lon,
          windKnots: Number(current.wind_speed_10m ?? 0),
          gustKnots: Number(current.wind_gusts_10m ?? 0),
          precipitationMm: Number(current.precipitation ?? 0),
          waveMeters: typeof wave === "number" ? wave : null,
        };
      }),
      fetchedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }
}
