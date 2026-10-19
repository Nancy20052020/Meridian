const SMALL = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

export function money(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  if (currency === "CNY") {
    return `¥${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)}`;
  }
  if (currency === "SGD") {
    return `S${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(rounded)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function formatDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${day} ${month}`;
}

export function delayBrief(hours: number): string {
  const rounded = Math.round(hours);
  if (rounded < 1) return "Calm";
  if (rounded < 48) return `${rounded} h`;
  const days = Math.round((rounded / 24) * 10) / 10;
  const text = Number.isInteger(days) ? String(days) : days.toFixed(1);
  return `${text} days`;
}

export function seaDays(hours: number): string {
  const days = Math.max(1, Math.round(hours / 24));
  return days === 1 ? "1 day" : `${days} days`;
}

export function missesPayday(zero: Date | null, payroll: Date, timeZone: string): boolean {
  const line = cashLine(zero, payroll, timeZone);
  return line === "Cash crosses zero before payday." || line === "Cash crosses zero on payday.";
}

export function delayLine(hours: number): string {
  const rounded = Math.round(hours);
  if (rounded < 1) return "The weather adds no time.";
  if (rounded === 1) return "The weather adds one hour.";
  if (rounded < 48) return `The weather adds ${rounded} hours.`;
  const days = Math.round((rounded / 24) * 10) / 10;
  if (days === 1) return "The weather adds one day.";
  const text = Number.isInteger(days) ? String(days) : days.toFixed(1);
  return `The weather adds ${text} days.`;
}

export function landingLine(daysBeforePayday: number): string {
  if (daysBeforePayday > 1) return `Lands ${daysBeforePayday} days before payday.`;
  if (daysBeforePayday === 1) return "Lands one day before payday.";
  if (daysBeforePayday === 0) return "Lands on payday.";
  if (daysBeforePayday === -1) return "Lands one day after payday.";
  return `Lands ${-daysBeforePayday} days after payday.`;
}

export function cashLine(zero: Date | null, payroll: Date, timeZone: string): string {
  if (!zero) return "Cash holds through payday.";
  const zeroKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(zero);
  const payKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(payroll);
  if (zeroKey < payKey) return "Cash crosses zero before payday.";
  if (zeroKey === payKey) return "Cash crosses zero on payday.";
  return "Cash crosses zero after payday.";
}

export function afterLanding(days: number): string {
  const word = SMALL[days] ?? String(days);
  const unit = days === 1 ? "day" : "days";
  const capital = word.charAt(0).toUpperCase() + word.slice(1);
  return `${capital} ${unit} after the goods land.`;
}
