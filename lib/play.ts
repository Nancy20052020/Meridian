import { beatOn, calendarDaysBetween, cashAt, type CashInput } from "./cash";
import { STORM_SLOWDOWN } from "./delay";
import { fractionAlong, type Voyage } from "./voyage";
import type { Route } from "./routes";

const DAY = 24 * 60 * 60 * 1000;

export type Moment = {
  at: Date;
  fraction: number;
  balance: number | null;
  line: string;
  tone: "calm" | "rough" | "zero";
  landingShare: number;
  paydayShare: number;
};

function untilLanding(at: Date, landing: Date, timeZone: string, fraction: number): string {
  if (fraction >= 0.999) return "The goods are alongside.";
  const days = calendarDaysBetween(at, landing, timeZone);
  if (days > 1) return `${days} days from landing.`;
  if (days === 1) return "One day from landing.";
  if (days === 0) return "Landing day.";
  return "The goods are alongside.";
}

function roughWater(slows: number[] | null, fraction: number): boolean {
  if (!slows || slows.length === 0 || fraction <= 0 || fraction >= 1) return false;
  const band = Math.min(slows.length - 1, Math.max(0, Math.floor(fraction * slows.length)));
  return (slows[band] ?? 0) >= STORM_SLOWDOWN;
}

/** One instant on the voyage, from now through the last cash day. */
export function describeMoment(
  route: Route,
  voyage: Voyage,
  now: Date,
  progress: number,
  delayHours: number | null,
  billHome: number | null,
  slows: number[] | null,
  weatherFailed: boolean,
): Moment {
  const held = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const landing =
    delayHours == null
      ? voyage.scheduledArrival
      : new Date(voyage.scheduledArrival.getTime() + delayHours * 60 * 60 * 1000);
  const invoiceAt = landing.getTime() + route.cash.invoiceDaysAfterLanding * DAY;
  const end = Math.max(landing.getTime(), voyage.payrollAt.getTime(), invoiceAt);
  const span = Math.max(1, end - now.getTime());
  const at = new Date(now.getTime() + held * span);
  const fraction = fractionAlong(voyage, delayHours ?? 0, now, at);
  const landingShare = Math.min(1, Math.max(0, (landing.getTime() - now.getTime()) / span));
  const paydayShare = Math.min(1, Math.max(0, (voyage.payrollAt.getTime() - now.getTime()) / span));

  let balance: number | null = null;
  let line = untilLanding(at, landing, route.home.timeZone, fraction);
  let tone: Moment["tone"] = "calm";

  if (weatherFailed || delayHours == null) {
    line = weatherFailed ? (fraction >= 0.999 ? "The goods are alongside." : "Scheduled progress.") : "Reading the weather.";
  } else if (billHome == null) {
    if (roughWater(slows, fraction)) {
      line = "Rough water on this stretch.";
      tone = "rough";
    }
  } else {
    const input: CashInput = {
      now,
      timeZone: route.home.timeZone,
      cashOnHand: route.cash.cashOnHand,
      billHome,
      invoice: route.cash.customerInvoice,
      invoiceDaysAfterLanding: route.cash.invoiceDaysAfterLanding,
      payroll: route.cash.payroll,
      scheduledArrival: voyage.scheduledArrival,
      adjustedArrival: landing,
      payrollDaysAfterScheduledArrival: route.cash.payrollDaysAfterScheduledArrival,
    };
    balance = cashAt(input, at);
    const beat = beatOn(input, at);
    if (beat) {
      line = beat;
      tone = beat === "Cash crosses zero." ? "zero" : "calm";
    } else if (roughWater(slows, fraction)) {
      line = "Rough water on this stretch.";
      tone = "rough";
    }
  }

  return { at, fraction, balance, line, tone, landingShare, paydayShare };
}
