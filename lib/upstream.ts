export function upstream(url: string, timeoutMs = 8000): Promise<Response> {
  return fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "application/json",
      "User-Agent": "Meridian/1.0",
    },
  });
}
