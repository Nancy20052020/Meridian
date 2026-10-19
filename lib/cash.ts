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

export function projectCash(input: CashInput): CashPicture {
  const billAt = input.adjustedArrival;
  const invoiceAt = new Date(billAt.getTime() + input.invoiceDaysAfterLanding * DAY);
  const payrollAt = new Date(
    input.scheduledArrival.getTime() + input.payrollDaysAfterScheduledArrival * DAY,
  );

  const events = [
    { at: billAt.getTime(), delta: -input.billHome, rank: 0 },
    { at: payrollAt.getTime(), delta: -input.payroll, rank: 1 },
    { at: invoiceAt.getTime(), delta: input.invoice, rank: 2 },
  ]
    .filter((event) => event.at >= input.now.getTime())
    .sort((a, b) => a.at - b.at || a.rank - b.rank);

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
