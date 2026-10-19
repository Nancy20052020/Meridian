"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import GlobeView from "./GlobeView";
import Nav from "./Nav";
import { afterLanding, cashLine, delayLine, formatDay, landingLine, money } from "@/lib/format";
import { fetchRate, fetchWeather } from "@/lib/feeds";
import { homesFor, laneHref, origins, readExtra, resolveLane, type Route } from "@/lib/routes";
import { picture, planVoyage, type WeatherPoint } from "@/lib/voyage";

const originList = origins();

export default function Stage() {
  const router = useRouter();
  const params = useSearchParams();
  const route = resolveLane(params.get("from"), params.get("to"));
  const extra = readExtra(params.get("extra"));
  const originId = route.origin.id;
  const homeId = route.home.id;
  const [clock, setClock] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherPoint[] | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [rateFailed, setRateFailed] = useState(false);

  const homes = homesFor(originId);

  useEffect(() => {
    const opened = new Date();
    const voyage = planVoyage(route, opened);
    let cancelled = false;
    setClock(opened);
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

  function write(origin: string, home: string, days: number) {
    router.replace(laneHref("/", origin, home, days), { scroll: false });
  }

  function chooseOrigin(next: string) {
    const available = homesFor(next);
    const home = available.some((port) => port.id === homeId) ? homeId : available[0]?.id ?? homeId;
    write(next, home, extra);
  }

  const voyage = useMemo(() => (clock ? planVoyage(route, clock) : null), [route, clock]);

  return (
    <main className="stage">
      <div className="stars" aria-hidden="true" />
      {clock && voyage ? (
        <Scene route={route} clock={clock} weather={weather} rate={rate} voyage={voyage} />
      ) : (
        <div className="globe-layer" />
      )}
      <div className="veil" />
      <div className="ui">
        <header>
          <div className="brand-row">
            <p className="brand">Meridian</p>
            <Nav />
          </div>
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
              <select id="home" value={homeId} onChange={(event) => write(originId, event.target.value, extra)}>
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
            <Scenario
              extra={extra}
              disabled={!weather || weatherFailed}
              onChange={(days) => write(originId, homeId, days)}
            />
          </div>
          <CashColumn
            route={route}
            clock={clock}
            weather={weather}
            weatherFailed={weatherFailed}
            rate={rate}
            rateFailed={rateFailed}
            extra={extra}
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
}: {
  route: Route;
  clock: Date;
  weather: WeatherPoint[] | null;
  rate: number | null;
  voyage: ReturnType<typeof planVoyage>;
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
      shipFraction={view.fraction}
      ports={ports}
      focus={voyage.focus}
    />
  );
}

function Scenario({
  extra,
  disabled,
  onChange,
}: {
  extra: number;
  disabled: boolean;
  onChange: (days: number) => void;
}) {
  const word = extra === 0 ? "None" : extra === 1 ? "1 day" : `${extra} days`;
  return (
    <div className="scenario">
      <div className="label">Further slip</div>
      <div className="stepper">
        <button type="button" onClick={() => onChange(extra - 1)} disabled={disabled || extra === 0}>
          Less
        </button>
        <span className="step-value">{word}</span>
        <button type="button" onClick={() => onChange(extra + 1)} disabled={disabled || extra === 10}>
          More
        </button>
      </div>
      <p className="note">
        {disabled
          ? "The further slip waits on the weather."
          : extra === 0
            ? "The book on the right is today's weather. Add days to test a later landing."
            : `The book on the right adds ${extra === 1 ? "one day" : `${extra} days`} beyond today's weather. It is a scenario.`}
      </p>
    </div>
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
  extra,
}: {
  route: Route;
  clock: Date | null;
  weather: WeatherPoint[] | null;
  weatherFailed: boolean;
  rate: number | null;
  rateFailed: boolean;
  extra: number;
}) {
  const home = route.home.currency;
  const billOrigin = money(route.cash.supplierBill, route.origin.currency);
  const ready = Boolean(clock && weather && rate != null);
  const view = clock ? picture(route, planVoyage(route, clock), weather, rate, clock, extra) : null;
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
      {extra > 0 ? <p className="note">Scenario, not the forecast.</p> : null}
      {extra > 0 && view?.adjustedArrival ? (
        <Fact label="Lands, if it slips" value={formatDay(view.adjustedArrival, route.home.timeZone)} />
      ) : null}
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
      <p className="note">
        <Link className="text-link" href={laneHref("/book", route.origin.id, route.home.id, extra)}>
          Open the book
        </Link>
      </p>
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
