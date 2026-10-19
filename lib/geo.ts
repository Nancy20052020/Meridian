export type LatLon = { lat: number; lon: number };

export type Path = {
  points: LatLon[];
  cumNm: number[];
  totalNm: number;
};

const EARTH_NM = 3440.065;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function toVec(p: LatLon): [number, number, number] {
  const lat = (p.lat * Math.PI) / 180;
  const lon = (p.lon * Math.PI) / 180;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
}

function fromVec(v: [number, number, number]): LatLon {
  const lat = (Math.asin(clamp(v[2], -1, 1)) * 180) / Math.PI;
  const lon = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  return { lat, lon };
}

export function slerp(a: LatLon, b: LatLon, t: number): LatLon {
  const va = toVec(a);
  const vb = toVec(b);
  const dot = clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1);
  const theta = Math.acos(dot);
  if (theta < 1e-8) return { ...a };
  const s = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / s;
  const w2 = Math.sin(t * theta) / s;
  return fromVec([
    w1 * va[0] + w2 * vb[0],
    w1 * va[1] + w2 * vb[1],
    w1 * va[2] + w2 * vb[2],
  ]);
}

export function haversineNm(a: LatLon, b: LatLon): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function samePoint(a: LatLon, b: LatLon): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;
}

export function chain(...parts: LatLon[][]): LatLon[] {
  const out: LatLon[] = [];
  for (const part of parts) {
    for (const point of part) {
      const last = out[out.length - 1];
      if (last && samePoint(last, point)) continue;
      out.push(point);
    }
  }
  return out;
}

export function buildPath(waypoints: LatLon[], spacingNm = 80): Path {
  const points: LatLon[] = [];
  if (waypoints.length === 0) {
    return { points, cumNm: [], totalNm: 0 };
  }
  points.push(waypoints[0]);
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const dist = haversineNm(a, b);
    const steps = Math.max(1, Math.round(dist / spacingNm));
    for (let s = 1; s <= steps; s++) {
      points.push(slerp(a, b, s / steps));
    }
  }
  const cumNm = [0];
  for (let i = 1; i < points.length; i++) {
    cumNm.push(cumNm[i - 1] + haversineNm(points[i - 1], points[i]));
  }
  return { points, cumNm, totalNm: cumNm[cumNm.length - 1] ?? 0 };
}

export function pointOnPath(path: Path, fraction: number): LatLon {
  if (path.points.length === 0) return { lat: 0, lon: 0 };
  if (path.points.length === 1 || path.totalNm <= 0) return path.points[0];
  const target = clamp(fraction, 0, 1) * path.totalNm;
  for (let i = 1; i < path.points.length; i++) {
    const end = path.cumNm[i];
    const start = path.cumNm[i - 1];
    if (end >= target) {
      const span = end - start;
      const t = span === 0 ? 0 : (target - start) / span;
      return slerp(path.points[i - 1], path.points[i], t);
    }
  }
  return path.points[path.points.length - 1];
}

export function fractionOfIndex(path: Path, index: number): number {
  if (path.totalNm <= 0) return 0;
  return (path.cumNm[index] ?? 0) / path.totalNm;
}

/** Break a path where it crosses the date line, so the globe does not draw the long way around. */
export function splitDateline(points: LatLon[]): LatLon[][] {
  if (points.length < 2) return points.length ? [points] : [];
  const segments: LatLon[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    let unwrapped = curr.lon;
    if (unwrapped - prev.lon > 180) unwrapped -= 360;
    if (prev.lon - unwrapped > 180) unwrapped += 360;
    if (Math.abs(unwrapped - prev.lon) <= 180 && unwrapped === curr.lon) {
      segments[segments.length - 1].push(curr);
      continue;
    }
    const goingEast = unwrapped > prev.lon;
    const edge = goingEast ? 180 : -180;
    const span = unwrapped - prev.lon;
    const t = span === 0 ? 0 : (edge - prev.lon) / span;
    const lat = prev.lat + (curr.lat - prev.lat) * clamp(t, 0, 1);
    segments[segments.length - 1].push({ lat, lon: edge });
    segments.push([
      { lat, lon: goingEast ? -180 : 180 },
      { lat: curr.lat, lon: curr.lon },
    ]);
  }
  return segments.filter((segment) => segment.length > 1);
}

export function frameFor(path: Path): { lat: number; lng: number; altitude: number } {
  const mid = pointOnPath(path, 0.5);
  let maxDeg = 0;
  for (const fraction of [0, 0.2, 0.8, 1]) {
    const point = pointOnPath(path, fraction);
    maxDeg = Math.max(maxDeg, haversineNm(mid, point) / 60);
  }
  return {
    lat: mid.lat,
    lng: mid.lon,
    altitude: clamp(0.58 + maxDeg / 36, 0.72, 2.05),
  };
}
