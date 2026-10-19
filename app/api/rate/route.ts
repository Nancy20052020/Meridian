import { NextResponse } from "next/server";
import { upstream } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CacheEntry = { at: number; body: unknown };

const cache = new Map<string, CacheEntry>();
const TTL = 60 * 60 * 1000;

const CODE = /^[A-Z]{3}$/;

async function fromOpenEr(from: string, to: string): Promise<{ rate: number; asOf: string } | null> {
  const response = await upstream("https://open.er-api.com/v6/latest/USD");
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (payload.result !== "success" || !payload.rates) return null;
  const fromPerUsd = from === "USD" ? 1 : payload.rates[from];
  const toPerUsd = to === "USD" ? 1 : payload.rates[to];
  if (!fromPerUsd || !toPerUsd) return null;
  const asOf = payload.time_last_update_utc
    ? new Date(payload.time_last_update_utc).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return { rate: toPerUsd / fromPerUsd, asOf };
}

async function fromFrankfurter(from: string, to: string): Promise<{ rate: number; asOf: string } | null> {
  const response = await upstream(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
  const rate = payload.rates?.[to];
  if (typeof rate !== "number") return null;
  return { rate, asOf: payload.date ?? new Date().toISOString().slice(0, 10) };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = (url.searchParams.get("from") ?? "").toUpperCase();
  const to = (url.searchParams.get("to") ?? "").toUpperCase();
  if (!CODE.test(from) || !CODE.test(to)) {
    return NextResponse.json({ error: "bad currency" }, { status: 400 });
  }

  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.body);
  }

  try {
    const quote =
      from === to ? { rate: 1, asOf: new Date().toISOString().slice(0, 10) } : await fromOpenEr(from, to);
    const resolved = quote ?? (await fromFrankfurter(from, to));
    if (!resolved) {
      return NextResponse.json({ error: "rate unavailable" }, { status: 502 });
    }
    const body = { from, to, rate: resolved.rate, asOf: resolved.asOf };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "rate unavailable" }, { status: 502 });
  }
}
