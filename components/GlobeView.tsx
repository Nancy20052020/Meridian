"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import landTopo from "@/data/land-50m.json";
import { STORM_SLOWDOWN } from "@/lib/delay";
import { pointOnPath, splitDateline, type LatLon, type Path } from "@/lib/geo";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const land = feature(
  landTopo as unknown as Parameters<typeof feature>[0],
  (landTopo as unknown as { objects: { land: Parameters<typeof feature>[1] } }).objects.land,
) as unknown as FeatureCollection;

type Focus = { lat: number; lng: number; altitude: number };

type GlobeHandle = {
  pointOfView: (coords: Focus, transitionMs?: number) => void;
  controls: () => {
    enablePan: boolean;
    autoRotate: boolean;
    minDistance: number;
    maxDistance: number;
  };
};

type ArcPoint = LatLon & { alt: number };

type Arc = {
  id: string;
  pts: ArcPoint[];
  color: string;
  stroke: number;
};

function stamp(points: LatLon[], alt: number): ArcPoint[] {
  return points.map((point) => ({ ...point, alt }));
}

function runs(path: Path, slows: number[] | null): LatLon[][] {
  if (!slows || slows.length === 0) return [];
  const found: LatLon[][] = [];
  let current: LatLon[] = [];
  path.points.forEach((point, index) => {
    const fraction = path.totalNm === 0 ? 0 : (path.cumNm[index] ?? 0) / path.totalNm;
    const band = Math.min(slows.length - 1, Math.max(0, Math.floor(fraction * slows.length)));
    if ((slows[band] ?? 0) >= STORM_SLOWDOWN) current.push(point);
    else if (current.length) {
      found.push(current);
      current = [];
    }
  });
  if (current.length) found.push(current);
  return found.filter((run) => run.length > 1);
}

export default function GlobeView({
  path,
  slows,
  shipFraction,
  ports,
  focus,
}: {
  path: Path;
  slows: number[] | null;
  shipFraction: number;
  ports: LatLon[];
  focus: Focus;
}) {
  const globeRef = useRef<GlobeHandle | null>(null);
  const shown = useRef(shipFraction);
  const framed = useRef(false);
  const [, setFrame] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  const material = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color("#071422"),
      emissive: new THREE.Color("#10243c"),
      emissiveIntensity: 0.55,
      shininess: 3,
      specular: new THREE.Color("#081420"),
    });
  }, []);

  const arcs = useMemo<Arc[]>(() => {
    const gold = splitDateline(path.points);
    const amber = runs(path, slows).flatMap((run) => splitDateline(run));
    return [
      ...gold.map((pts, index) => ({
        id: `halo-${index}`,
        pts: stamp(pts, 0.004),
        color: "rgba(228, 201, 138, 0.18)",
        stroke: 2.4,
      })),
      ...gold.map((pts, index) => ({
        id: `gold-${index}`,
        pts: stamp(pts, 0.008),
        color: "rgba(232, 208, 150, 0.96)",
        stroke: 1.15,
      })),
      ...amber.map((pts, index) => ({
        id: `storm-${index}`,
        pts: stamp(pts, 0.013),
        color: "rgba(224, 158, 84, 0.62)",
        stroke: 5,
      })),
    ];
  }, [path, slows]);

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let raf = 0;
    let live = true;
    const step = () => {
      if (!live) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const delta = shipFraction - shown.current;
      if (reduce || Math.abs(delta) < 0.0004) {
        if (shown.current !== shipFraction) {
          shown.current = shipFraction;
          setFrame((value) => value + 1);
        }
        return;
      }
      shown.current += delta * 0.08;
      setFrame((value) => value + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [shipFraction]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe) return;
    const controls = globe.controls();
    controls.autoRotate = false;
    controls.enablePan = false;
    globe.pointOfView(focus, framed.current ? 900 : 0);
    framed.current = true;
  }, [ready, focus.lat, focus.lng, focus.altitude, focus]);

  const ship = pointOnPath(path, shown.current);
  const points = [
    ...ports.map((port) => ({ ...port, color: "#e4c98a", radius: 0.32, alt: 0.01 })),
    { ...ship, color: "#f7f4ee", radius: 0.62, alt: 0.02 },
  ];

  if (size.w === 0 || material == null) return <div className="globe-layer" />;

  return (
    <div className="globe-layer" aria-hidden="true">
      <Globe
        ref={globeRef as never}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#8eafc9"
        atmosphereAltitude={0.18}
        showGraticules={false}
        globeMaterial={material}
        animateIn={false}
        polygonsData={land.features}
        polygonCapColor={() => "#13283d"}
        polygonSideColor={() => "#0b1a2b"}
        polygonStrokeColor={() => "rgba(148, 176, 204, 0.16)"}
        polygonAltitude={0.004}
        polygonsTransitionDuration={0}
        pathsData={arcs}
        pathPoints="pts"
        pathPointLat="lat"
        pathPointLng="lon"
        pathPointAlt="alt"
        pathColor="color"
        pathStroke="stroke"
        pathTransitionDuration={0}
        pointsData={points}
        pointLat="lat"
        pointLng="lon"
        pointColor="color"
        pointAltitude="alt"
        pointRadius="radius"
        pointLabel={() => ""}
        pointsTransitionDuration={0}
        onGlobeReady={() => setReady(true)}
      />
    </div>
  );
}
