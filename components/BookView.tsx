"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Frame from "./Frame";
import { ledger, type LedgerLine } from "@/lib/cash";
import { cashLine, delayLine, formatDay, money } from "@/lib/format";
import { fetchRate, fetchWeather } from "@/lib/feeds";
import { laneHref, readExtra, resolveLane } from "@/lib/routes";
import { picture, planVoyage, type WeatherPoint } from "@/lib/voyage";
import { useSearchParams } from "next/navigation";

export default function BookView() {
  const params = useSearchParams();
  const route = resolveLane(params.get("from"), params.get("to"));
  const extra = readExtra(params.get("extra"));
  const [clock, setClock] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherPoint[] | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [rateFailed, setRateFailed] = useState(false);

  useEffect(() => {
    const now = new Date();
    const voyage = planVoyage(route, now);
    let cancelled = false;
    setClock(now);
    setWeather(null);
    setWeatherFailed(false);
    setRate(null);
    setRateFailed(false);

    fetchWeather(voyage.samples).then((points) => {
      if (cancelled) return;
      if (!points) setWeatherFailed(true);
      else setWeather(points);
    });
    fetchRate(route.origin.currency, route.home.currency).then((next) => {
      if (cancelled) return;
      if (next == null) setRateFailed(true);
      else setRate(next);
    });

    return () => {
      cancelled = true;
    };
  }, [route]);

  const voyage = useMemo(() => (clock ? planVoyage(route, clock) : null), [route, clock]);
  const live = voyage && clock ? picture(route, voyage, weather, rate, clock) : null;
  const judged = voyage && clock ? picture(route, voyage, weather, rate, clock, extra) : null;
  const home = route.home.currency;
  const lines: LedgerLine[] | null =
    judged?.cash && judged.adjustedArrival && judged.billHome != null && clock
      ? ledger({
          now: clock,
          timeZone: route.home.timeZone,
          cashOnHand: route.cash.cashOnHand,
          billHome: judged.billHome,
          invoice: route.cash.customerInvoice,
          invoiceDaysAfterLanding: route.cash.invoiceDaysAfterLanding,
          payroll: route.cash.payroll,
          scheduledArrival: voyage!.scheduledArrival,
          adjustedArrival: judged.adjustedArrival,
          payrollDaysAfterScheduledArrival: route.cash.payrollDaysAfterScheduledArrival,
        })
      : null;

  return (
    <Frame>
      <p className="doc-kicker">
        {route.origin.name} to {route.home.name}
      </p>
      <h1 className="doc-title">The book</h1>
      {extra > 0 ? (
        <p className="note">
          This book adds {extra === 1 ? "one day" : `${extra} days`} beyond today&apos;s weather. It is a scenario, not the forecast.
        </p>
      ) : (
        <p className="note">This book is today&apos;s weather and today&apos;s rate. Payroll does not move.</p>
      )}
      {live?.delayHours != null ? <p className="note">{delayLine(live.delayHours)}</p> : null}
      {lines && judged?.cash ? (
        <p className="summary">{cashLine(judged.cash.firstZeroAt, judged.cash.payrollAt, route.home.timeZone)}</p>
      ) : (
        <p className="summary pending-title">{waitingCopy(weatherFailed, rateFailed, Boolean(weather), rate != null)}</p>
      )}

      {lines ? (
        <div className="sheet-wrap">
          <table className="sheet">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th className="num">Amount</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={`${line.kind}-${line.at.toISOString()}`} className={line.kind !== "open" && line.balance <= 0 ? "broke" : undefined}>
                  <td>{formatDay(line.at, route.home.timeZone)}</td>
                  <td>{line.label}</td>
                  <td className="num">{line.delta === 0 ? "—" : money(line.delta, home)}</td>
                  <td className="num">{money(line.balance, home)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="note book-links">
        <Link href={laneHref("/", route.origin.id, route.home.id, extra)}>Watch this lane</Link>
        <Link href={laneHref("/lanes", route.origin.id, route.home.id, extra)}>All lanes</Link>
      </p>
    </Frame>
  );
}

function waitingCopy(weatherFailed: boolean, rateFailed: boolean, hasWeather: boolean, hasRate: boolean): string {
  if (!hasWeather && !weatherFailed) return "Reading the weather.";
  if (!hasRate && !rateFailed && hasWeather) return "Reading the rate.";
  if (weatherFailed && rateFailed) return "The weather and the rate did not answer.";
  if (weatherFailed) return "The weather did not answer, so the landing day is not in this book.";
  if (rateFailed) return "The rate did not answer, so the bill is not in home currency yet.";
  return "Reading.";
}
