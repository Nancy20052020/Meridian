"use client";

import { useEffect, useRef, useState } from "react";
import { formatDay, money } from "@/lib/format";
import { describeMoment } from "@/lib/play";
import type { Route } from "@/lib/routes";
import type { Voyage, WeatherPoint } from "@/lib/voyage";
import { picture } from "@/lib/voyage";

const PLAY_MS = 16000;

export default function PlayBar({
  route,
  clock,
  voyage,
  weather,
  rate,
  weatherFailed,
  onFraction,
}: {
  route: Route;
  clock: Date;
  voyage: Voyage;
  weather: WeatherPoint[] | null;
  rate: number | null;
  weatherFailed: boolean;
  onFraction: (fraction: number) => void;
}) {
  const settled = weather != null || weatherFailed;
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const progressRef = useRef(0);
  const onFractionRef = useRef(onFraction);
  onFractionRef.current = onFraction;

  const view = picture(route, voyage, weather, rate, clock);
  const moment = describeMoment(
    route,
    voyage,
    clock,
    progress,
    view.delayHours,
    view.billHome,
    view.slows,
    weatherFailed,
  );

  useEffect(() => {
    onFractionRef.current(moment.fraction);
  }, [moment.fraction]);

  useEffect(() => {
    if (!settled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    progressRef.current = 0;
    setProgress(0);
    setPlaying(true);
  }, [settled]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let painted = last;
    const step = (now: number) => {
      const next = Math.min(1, progressRef.current + (now - last) / PLAY_MS);
      last = now;
      progressRef.current = next;
      if (now - painted > 70 || next >= 1) {
        painted = now;
        setProgress(next);
      }
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  function seek(value: number) {
    const next = Math.min(1, Math.max(0, value));
    progressRef.current = next;
    setPlaying(false);
    setProgress(next);
  }

  function toggle() {
    if (!playing && progressRef.current >= 0.999) {
      progressRef.current = 0;
      setProgress(0);
    }
    setPlaying((value) => !value);
  }

  const label = playing ? "Pause" : progress >= 0.999 ? "Replay" : "Play";
  const showLanding = moment.landingShare > 0.14 && Math.abs(moment.landingShare - moment.paydayShare) > 0.14;

  return (
    <div className="player">
      <div className="player-top">
        <button type="button" onClick={toggle} disabled={!settled} aria-pressed={playing}>
          {label}
        </button>
        <span className="player-when">{formatDay(moment.at, route.home.timeZone)}</span>
      </div>
      <input
        className="track"
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(progress * 1000)}
        aria-label="Voyage"
        disabled={!settled}
        style={{ ["--p" as string]: `${progress * 100}%` }}
        onChange={(event) => seek(Number(event.target.value) / 1000)}
      />
      <div className="scale" aria-hidden="true">
        <span>Now</span>
        {showLanding ? (
          <span className="mark" style={{ left: `${moment.landingShare * 100}%` }}>
            Lands
          </span>
        ) : null}
        <span>Payday</span>
      </div>
      <p className={moment.tone === "calm" ? "player-line" : `player-line ${moment.tone}`}>{moment.line}</p>
      {moment.balance != null ? (
        <p className="player-cash">{money(moment.balance, route.home.currency)} on this day</p>
      ) : null}
    </div>
  );
}
