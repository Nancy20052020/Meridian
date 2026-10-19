import type { WeatherPoint } from "./voyage";

export async function fetchWeather(samples: { lat: number; lon: number }[]): Promise<WeatherPoint[] | null> {
  const points = samples.map((sample) => `${sample.lat.toFixed(3)},${sample.lon.toFixed(3)}`).join(";");
  try {
    const response = await fetch(`/api/weather?points=${encodeURIComponent(points)}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { points?: WeatherPoint[] };
    if (!payload.points || payload.points.length !== samples.length) return null;
    return payload.points;
  } catch {
    return null;
  }
}

export async function fetchRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  try {
    const response = await fetch(`/api/rate?from=${from}&to=${to}`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;
    const payload = (await response.json()) as { rate?: number };
    return typeof payload.rate === "number" ? payload.rate : null;
  } catch {
    return null;
  }
}

export async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
}
