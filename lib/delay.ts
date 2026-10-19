/**
 * A leg keeps the schedule below 22 knots of wind and 2.5 meters of sea.
 * Above that, speed falls. Wind can take half the speed, waves a little more.
 * The extra time is scheduled time times (1 / remaining speed − 1).
 * Eight equal legs cover the route. A leg is drawn in amber once it loses 8% of its speed.
 */

export const BANDS = 8;
export const STORM_SLOWDOWN = 0.08;

export function slowdown(windKnots: number, waveMeters: number | null): number {
  const wind = Math.min(0.5, Math.max(0, (windKnots - 22) / 40));
  const wave =
    waveMeters == null ? 0 : Math.min(0.55, Math.max(0, (waveMeters - 2.5) / 8));
  return Math.min(0.6, 1 - (1 - wind) * (1 - wave));
}

export function delayHours(slows: number[], scheduledHours: number): number {
  if (slows.length === 0 || scheduledHours <= 0) return 0;
  const share = 1 / slows.length;
  let extra = 0;
  for (const slow of slows) {
    if (slow <= 0) continue;
    extra += scheduledHours * share * (1 / (1 - slow) - 1);
  }
  return extra;
}

export function bandFractions(bands = BANDS): number[] {
  return Array.from({ length: bands }, (_, i) => (i + 0.5) / bands);
}
