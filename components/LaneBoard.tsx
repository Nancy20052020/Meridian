"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Frame from "./Frame";
import { delayBrief, formatDay, missesPayday, seaDays } from "@/lib/format";
import { fetchRate, fetchWeather, pool } from "@/lib/feeds";
import { laneHref, ROUTES, type Route } from "@/lib/routes";
import { picture, planVoyage } from "@/lib/voyage";

type Status = "reading" | "holds" | "misses" | "unknown";

type Row = {
  route: Route;
  days: string;
  weather: string;
  lands: string;
  cash: string;
  status: Status;
  cushion: number;
};

function blank(route: Route, now: Date): Row {
  const voyage = planVoyage(route, now);
  return {
    route,
    days: seaDays(voyage.scheduledHours),
    weather: "Reading.",
    lands: "Reading.",
    cash: "Reading.",
    status: "reading",
    cushion: 999,
  };
}

export default function LaneBoard() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const now = new Date();
    const initial = ROUTES.map((route) => blank(route, now));
    setRows(initial);
    let cancelled = false;
    const rates = new Map<string, Promise<number | null>>();

    function rateFor(route: Route) {
      const key = `${route.origin.currency}:${route.home.currency}`;
      let pending = rates.get(key);
      if (!pending) {
        pending = fetchRate(route.origin.currency, route.home.currency);
        rates.set(key, pending);
      }
      return pending;
    }

    pool(ROUTES, 3, async (route) => {
      const voyage = planVoyage(route, now);
      const [weather, rate] = await Promise.all([fetchWeather(voyage.samples), rateFor(route)]);
      if (cancelled) return;
      const view = picture(route, voyage, weather, rate, now);
      const known = Boolean(view.cash && view.adjustedArrival);
      const misses = known && view.cash ? missesPayday(view.cash.firstZeroAt, view.cash.payrollAt, route.home.timeZone) : false;
      const next: Row = {
        route,
        days: seaDays(voyage.scheduledHours),
        weather: weather ? (view.delayHours == null ? "Reading." : delayBrief(view.delayHours)) : "No answer",
        lands: view.adjustedArrival ? formatDay(view.adjustedArrival, route.home.timeZone) : "No answer",
        cash: !known ? "No answer" : misses ? "Misses" : "Holds",
        status: !known ? "unknown" : misses ? "misses" : "holds",
        cushion: view.daysBeforePayday ?? 999,
      };
      setRows((current) => current?.map((row) => (row.route.id === route.id ? next : row)) ?? current);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const list = rows ?? [];
  const finished = list.length > 0 && list.every((row) => row.status !== "reading");
  const misses = list.filter((row) => row.status === "misses").length;
  const unknown = list.filter((row) => row.status === "unknown").length;
  let summary = "Reading the lanes.";
  if (list.length && finished && misses === 0 && unknown === 0) summary = "Every lane holds through payday.";
  else if (list.length && finished && unknown > 0) {
    summary = `${misses} of ${list.length} lanes miss payroll. ${unknown} did not answer.`;
  } else if (list.length && finished) summary = `${misses} of ${list.length} lanes miss payroll on today's weather.`;
  else if (list.some((row) => row.status !== "reading")) {
    summary = `${misses} of ${list.length} lanes miss payroll, so far.`;
  }

  const ordered = [...list].sort((a, b) => rank(a.status) - rank(b.status) || a.cushion - b.cushion);

  return (
    <Frame>
      <p className="doc-kicker">All corridors</p>
      <h1 className="doc-title">Which lanes miss payroll?</h1>
      <p className="summary">{summary}</p>
      <p className="note">Sample books for one importer. The weather and the rate are live. No extra slip is added here.</p>
      <div className="sheet-wrap">
        <table className="sheet">
          <thead>
            <tr>
              <th>Lane</th>
              <th>At sea</th>
              <th>Weather</th>
              <th>Lands</th>
              <th>Cash</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr key={row.route.id} className={row.status === "misses" ? "broke" : undefined}>
                <td>
                  <Link href={laneHref("/", row.route.origin.id, row.route.home.id)}>
                    {row.route.origin.name} to {row.route.home.name}
                  </Link>
                </td>
                <td>{row.days}</td>
                <td>{row.weather}</td>
                <td>{row.lands}</td>
                <td>{row.cash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

function rank(status: Status): number {
  if (status === "misses") return 0;
  if (status === "holds") return 1;
  if (status === "unknown") return 2;
  return 3;
}
