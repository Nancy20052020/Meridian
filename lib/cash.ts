export type CashInput = {
  now: Date;
  timeZone: string;
  cashOnHand: number;
  billHome: number;
  invoice: number;
  invoiceDaysAfterLanding: number;
  payroll: number;
  scheduledArrival: Date;
  adjustedArrival: Date;
  payrollDaysAfterScheduledArrival: number;
};

export type CashPicture = {
  payrollAt: Date;
  invoiceAt: Date;
  billAt: Date;
  firstZeroAt: Date | null;
};

const DAY = 24 * 60 * 60 * 1000;

type CashEvent = {
  at: number;
  delta: number;
  rank: number;
  kind: "bill" | "payroll" | "invoice";
};

function schedule(input: CashInput) {
  const billAt = input.adjustedArrival;
  const invoiceAt = new Date(billAt.getTime() + input.invoiceDaysAfterLanding * DAY);
  const payrollAt = new Date(
    input.scheduledArrival.getTime() + input.payrollDaysAfterScheduledArrival * DAY,
  );
  const events: CashEvent[] = [
    { at: billAt.getTime(), delta: -input.billHome, rank: 0, kind: "bill" },
    { at: payrollAt.getTime(), delta: -input.payroll, rank: 1, kind: "payroll" },
    { at: invoiceAt.getTime(), delta: input.invoice, rank: 2, kind: "invoice" },
  ];
  events.sort((a, b) => a.at - b.at || a.rank - b.rank);
  return { billAt, invoiceAt, payrollAt, events: events.filter((event) => event.at >= input.now.getTime()) };
  return { billAt, invoiceAt, payrollAt, events };
}

export function projectCash(input: CashInput): CashPicture {
  const { billAt, invoiceAt, payrollAt, events } = schedule(input);
  let balance = input.cashOnHand;
  let firstZeroAt: Date | null = null;
  for (const event of events) {
    balance += event.delta;
    if (firstZeroAt === null && balance <= 0) {
      firstZeroAt = new Date(event.at);
    }
  }
  return { payrollAt, invoiceAt, billAt, firstZeroAt };
}

/** Balance after every cash event that has fallen by `at`. */
export function cashAt(input: CashInput, at: Date): number {
  if (at.getTime() <= input.now.getTime()) return input.cashOnHand;
  let balance = input.cashOnHand;
  for (const event of schedule(input).events) {
    if (event.at > at.getTime()) break;
    balance += event.delta;
  }
  return balance;
}

/** The cash event on this home-city day, if the playhead has reached it. */
export function beatOn(input: CashInput, at: Date): string | null {
  if (at.getTime() < input.now.getTime()) return null;
  const key = dayKey(at, input.timeZone);
  const today = schedule(input).events.filter(
    (event) => event.at <= at.getTime() && dayKey(new Date(event.at), input.timeZone) === key,
  );
  if (today.length === 0) return null;
  const picture = projectCash(input);
  if (picture.firstZeroAt && dayKey(picture.firstZeroAt, input.timeZone) === key) {
    return "Cash crosses zero.";
  }
  const kinds = new Set(today.map((event) => event.kind));
  if (kinds.has("bill") && kinds.has("payroll")) return "The bill leaves on payday.";
  if (kinds.has("invoice") && kinds.has("payroll")) return "The invoice arrives on payday.";
  if (kinds.has("bill")) return "The bill leaves.";
  if (kinds.has("payroll")) return "Payday.";
  if (kinds.has("invoice")) return "The invoice arrives.";
  return null;
}

export type LedgerLine = {
  at: Date;
  kind: "open" | "bill" | "payroll" | "invoice";
  label: string;
  delta: number;
  balance: number;
};

/** The book in order: cash today, then each outflow and the invoice. */
export function ledger(input: CashInput): LedgerLine[] {
  const labels = { bill: "The bill", payroll: "Payroll", invoice: "The invoice" } as const;
  const lines: LedgerLine[] = [
    {
      at: input.now,
      kind: "open",
      label: "Cash today",
      delta: 0,
      balance: input.cashOnHand,
    },
  ];
  let balance = input.cashOnHand;
  for (const event of schedule(input).events) {
    balance += event.delta;
    lines.push({
      at: new Date(event.at),
      kind: event.kind,
      label: labels[event.kind],
      delta: event.delta,
      balance,
    });
  }
  return lines;
}

export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Calendar days from `from` to `to` in the home city. Positive means `to` is later. */
export function calendarDaysBetween(from: Date, to: Date, timeZone: string): number {
  const [ay, am, ad] = dayKey(from, timeZone).split("-").map(Number);
  const [by, bm, bd] = dayKey(to, timeZone).split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / DAY);
}
