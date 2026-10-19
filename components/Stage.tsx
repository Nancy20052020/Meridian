"use client";

import { useEffect, useMemo, useState } from "react";
import GlobeView from "./GlobeView";
import PlayBar from "./PlayBar";
import { afterLanding, cashLine, delayLine, formatDay, landingLine, money } from "@/lib/format";
import {
  DEFAULT_HOME,
  DEFAULT_ORIGIN,
  findRoute,
  homesFor,
  origins,
  type Route,
} from "@/lib/routes";
import { picture, planVoyage, type WeatherPoint } from "@/lib/voyage";

type WeatherPayload = { points: (WeatherPoint & { lat: number; lon: number })[] };
type RatePayload = { rate: number };

const originList = origins();

export default function Stage() {
  const [originId, setOriginId] = useState(DEFAULT_ORIGIN);
  const [homeId, setHomeId] = useState(DEFAULT_HOME);
  const [clock, setClock] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherPoint[] | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [rateFailed, setRateFailed] = useState(false);
  const [shipFraction, setShipFraction] = useState<number | null>(null);

  const route = useMemo(() => findRoute(originId, homeId), [originId, homeId]);
  const homes = homesFor(originId);

  useEffect(() => {
    const opened = new Date();
    const voyage = planVoyage(route, opened);
    const points = voyage.samples.map((sample) => `${sample.lat.toFixed(3)},${sample.lon.toFixed(3)}`).join(";");
    let cancelled = false;
    setClock(opened);
    setWeather(null);
    setWeatherFailed(false);
    setRate(null);
    setRateFailed(false);
    setShipFraction(null);

    fetch(`/api/weather?points=${encodeURIComponent(points)}`, { signal: AbortSignal.timeout(12000) })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("weather"))))
      .then((payload: WeatherPayload) => {
        if (cancelled) return;
        if (!payload.points || payload.points.length !== voyage.samples.length) {
          setWeatherFailed(true);
          return;
        }
        setWeather(payload.points);
      })
      .catch(() => {
        if (!cancelled) setWeatherFailed(true);
      });

    fetch(`/api/rate?from=${route.origin.currency}&to=${route.home.currency}`, {
      signal: AbortSignal.timeout(12000),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("rate"))))
      .then((payload: RatePayload) => {
        if (cancelled) return;
        if (typeof payload.rate !== "number") {
          setRateFailed(true);
          return;
        }
        setRate(payload.rate);
      })
      .catch(() => {
        if (!cancelled) setRateFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [route]);

  function chooseOrigin(next: string) {
    setOriginId(next);
    const available = homesFor(next);
    if (!available.some((home) => home.id === homeId)) {
      setHomeId(available[0]?.id ?? homeId);
    }
  }

  const voyage = useMemo(() => (clock ? planVoyage(route, clock) : null), [route, clock]);

  return (
    <main className="stage">
      <div className="stars" aria-hidden="true" />
      {clock && voyage ? (
        <Scene
          route={route}
          clock={clock}
          weather={weather}
          rate={rate}
          voyage={voyage}
          shipFraction={shipFraction}
        />
      ) : (
        <div className="globe-layer" />
      )}
      <div className="veil" />
      <div className="ui">
        <header>
          <p className="brand">Meridian</p>
          <h1>Will the goods land before payday?</h1>
        </header>
        <section className="columns">
          <div className="column">
            <div className="route-pick">
              <label className="sr-only" htmlFor="origin">
                Origin port
              </label>
              <select id="origin" value={originId} onChange={(event) => chooseOrigin(event.target.value)}>
                {originList.map((origin) => (
                  <option key={origin.id} value={origin.id}>
                    {origin.name}
                  </option>
                ))}
              </select>
              <span className="to">to</span>
              <label className="sr-only" htmlFor="home">
                Home city
              </label>
              <select id="home" value={homeId} onChange={(event) => setHomeId(event.target.value)}>
                {homes.map((home) => (
                  <option key={home.id} value={home.id}>
                    {home.name}
                  </option>
                ))}
              </select>
            </div>

            <Fact
              label="Scheduled arrival"
              value={clock ? formatDay(planVoyage(route, clock).scheduledArrival, route.home.timeZone) : "Reading."}
              pending={!clock}
            />
            <WeatherFact
              route={route}
              clock={clock}
              weather={weather}
              weatherFailed={weatherFailed}
            />
            <p className="note">
              {weatherFailed
                ? "Position is scheduled progress. The weather did not answer."
                : "Position is scheduled progress, plus the weather delay."}
            </p>
          </div>
          <div className="column-play">
            {clock && voyage ? (
              <PlayBar
                key={`${route.origin.id}-${route.home.id}`}
                route={route}
                clock={clock}
                voyage={voyage}
                weather={weather}
                rate={rate}
                weatherFailed={weatherFailed}
                onFraction={setShipFraction}
              />
            ) : null}
          </div>
          <CashColumn
            route={route}
            clock={clock}
            weather={weather}
            weatherFailed={weatherFailed}
            rate={rate}
            rateFailed={rateFailed}
          />
        </section>
      </div>
    </main>
  );
}

function Scene({
  route,
  clock,
  weather,
  rate,
  voyage,
  shipFraction,
}: {
  route: Route;
  clock: Date;
  weather: WeatherPoint[] | null;
  rate: number | null;
  voyage: ReturnType<typeof planVoyage>;
  shipFraction: number | null;
}) {
  const view = useMemo(() => picture(route, voyage, weather, rate, clock), [route, voyage, weather, rate, clock]);
  const ports = useMemo(
    () => [
      { lat: route.origin.lat, lon: route.origin.lon },
      { lat: route.home.lat, lon: route.home.lon },
    ],
    [route],
  );
  return (
    <GlobeView
      path={voyage.path}
      slows={view.slows}
      shipFraction={shipFraction ?? view.fraction}
      ports={ports}
      focus={voyage.focus}
    />
  );
}

function WeatherFact({
  route,
  clock,
  weather,
  weatherFailed,
}: {
  route: Route;
  clock: Date | null;
  weather: WeatherPoint[] | null;
  weatherFailed: boolean;
}) {
  if (!clock || (!weather && !weatherFailed)) {
    return <Fact label="With this weather" value="Reading the weather." pending />;
  }
  if (weatherFailed || !weather) {
    return <Fact label="With this weather" value="The weather feed did not answer." pending />;
  }
  const voyage = planVoyage(route, clock);
  const view = picture(route, voyage, weather, null, clock);
  return (
    <>
      <Fact
        label="With this weather"
        value={view.adjustedArrival ? formatDay(view.adjustedArrival, route.home.timeZone) : "Reading the weather."}
      />
      <p className="note">{view.delayHours == null ? "" : delayLine(view.delayHours)}</p>
      {view.daysBeforePayday != null ? <p className="answer">{landingLine(view.daysBeforePayday)}</p> : null}
    </>
  );
}

function CashColumn({
  route,
  clock,
  weather,
  weatherFailed,
  rate,
  rateFailed,
}: {
  route: Route;
  clock: Date | null;
  weather: WeatherPoint[] | null;
  weatherFailed: boolean;
  rate: number | null;
  rateFailed: boolean;
}) {
  const home = route.home.currency;
  const billOrigin = money(route.cash.supplierBill, route.origin.currency);
  const ready = Boolean(clock && weather && rate != null);
  const view = clock ? picture(route, planVoyage(route, clock), weather, rate, clock) : null;
  const zero = view?.cash?.firstZeroAt ?? null;
  const payrollAt = view?.cash?.payrollAt ?? (clock ? planVoyage(route, clock).payrollAt : null);

  let zeroValue = "Reading.";
  let zeroPending = true;
  if (weatherFailed) {
    zeroValue = "The weather feed did not answer.";
  } else if (rateFailed) {
    zeroValue = "The rate feed did not answer.";
  } else if (ready && view?.cash) {
    zeroValue = zero ? formatDay(zero, route.home.timeZone) : "No such day";
    zeroPending = zero == null;
  }

  return (
    <div className="column column-right">
      <Fact label="Cash today" value={money(route.cash.cashOnHand, home)} />
      <Fact
        label="The bill"
        value={rate == null ? billOrigin : money(route.cash.supplierBill * rate, home)}
        detail={
          rateFailed
            ? "The rate feed did not answer."
            : rate == null
              ? "Reading the rate."
              : `${billOrigin} at today's rate.`
        }
      />
      <Fact
        label="The invoice"
        value={money(route.cash.customerInvoice, home)}
        detail={afterLanding(route.cash.invoiceDaysAfterLanding)}
      />
      <Fact label="First zero day" value={zeroValue} pending={zeroPending} />
      <Fact
        label="Payroll"
        value={payrollAt ? formatDay(payrollAt, route.home.timeZone) : "Reading."}
        detail={money(route.cash.payroll, home)}
        pending={!payrollAt}
      />
      {ready && payrollAt && view?.cash ? (
        <p className="answer">{cashLine(zero, payrollAt, route.home.timeZone)}</p>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  detail,
  pending,
}: {
  label: string;
  value: string;
  detail?: string;
  pending?: boolean;
}) {
  return (
    <div className="fact">
      <div className="label">{label}</div>
      <div className={pending ? "pending" : "value"}>{value}</div>
      {detail ? <div className="detail">{detail}</div> : null}
    </div>
  );
}
