import { projectCash, calendarDaysBetween } from "./cash";
import { BANDS, bandFractions, delayHours, slowdown } from "./delay";
import { buildPath, frameFor, pointOnPath, type Path } from "./geo";
import type { Route } from "./routes";

export type WeatherPoint = {
  windKnots: number;
  waveMeters: number | null;
};

export type Voyage = {
  path: Path;
  focus: { lat: number; lng: number; altitude: number };
  samples: { lat: number; lon: number }[];
  scheduledHours: number;
  elapsedHours: number;
  scheduledArrival: Date;
  payrollAt: Date;
};

const DAY = 24 * 60 * 60 * 1000;

export function planVoyage(route: Route, now: Date): Voyage {
  const path = buildPath(route.waypoints, 80);
  const scheduledHours = path.totalNm / route.speedKnots;
  const elapsedHours = scheduledHours * route.elapsedShare;
  const scheduledArrival = new Date(now.getTime() + (scheduledHours - elapsedHours) * 60 * 60 * 1000);
  const samples = bandFractions(BANDS).map((fraction) => pointOnPath(path, fraction));
  return {
    path,
    focus: frameFor(path),
    samples,
    scheduledHours,
    elapsedHours,
    scheduledArrival,
    payrollAt: new Date(
      scheduledArrival.getTime() + route.cash.payrollDaysAfterScheduledArrival * DAY,
    ),
  };
}

export function shipFraction(elapsedHours: number, scheduledHours: number, delay: number): number {
  const total = scheduledHours + Math.max(0, delay);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedHours / total));
}

/** Where the ship is at `at`, counting weather delay against the whole passage. */
export function fractionAlong(voyage: Voyage, delayHours: number, now: Date, at: Date): number {
  const extraHours = (at.getTime() - now.getTime()) / (60 * 60 * 1000);
  return shipFraction(voyage.elapsedHours + extraHours, voyage.scheduledHours, delayHours);
}

export function picture(route: Route, voyage: Voyage, weather: WeatherPoint[] | null, rate: number | null, now: Date) {
  const slows =
    weather && weather.length === voyage.samples.length
      ? weather.map((point) => slowdown(point.windKnots, point.waveMeters))
      : null;
  const delay = slows ? delayHours(slows, voyage.scheduledHours) : null;
  const adjustedArrival =
    delay == null ? null : new Date(voyage.scheduledArrival.getTime() + delay * 60 * 60 * 1000);
  const billHome = rate == null ? null : route.cash.supplierBill * rate;
  const cash =
    adjustedArrival && billHome != null
      ? projectCash({
          now,
          timeZone: route.home.timeZone,
          cashOnHand: route.cash.cashOnHand,
          billHome,
          invoice: route.cash.customerInvoice,
          invoiceDaysAfterLanding: route.cash.invoiceDaysAfterLanding,
          payroll: route.cash.payroll,
          scheduledArrival: voyage.scheduledArrival,
          adjustedArrival,
          payrollDaysAfterScheduledArrival: route.cash.payrollDaysAfterScheduledArrival,
        })
      : null;

  return {
    slows,
    delayHours: delay,
    adjustedArrival,
    billHome,
    fraction: shipFraction(voyage.elapsedHours, voyage.scheduledHours, delay ?? 0),
    cash,
    daysBeforePayday:
      adjustedArrival == null
        ? null
        : calendarDaysBetween(adjustedArrival, voyage.payrollAt, route.home.timeZone),
  };
}
