"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { STORM_SLOWDOWN } from "@/lib/delay";
import { pointOnPath, splitDateline, type LatLon, type Path } from "@/lib/geo";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const emptyLabel = () => "";

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
  dash: number;
  gap: number;
  animate: number;
};

const GLOBE_RADIUS = 100;

function polar(lat: number, lng: number, relAltitude: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  const r = GLOBE_RADIUS * (1 + relAltitude);
  const phiSin = Math.sin(phi);
  return {
    x: r * phiSin * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * phiSin * Math.sin(theta),
  };
}

function moveMesh(mesh: THREE.Object3D, lat: number, lon: number, alt: number) {
  const at = polar(lat, lon, alt);
  mesh.position.set(at.x, at.y, at.z);
}

function placeShip(group: THREE.Group, path: Path, fraction: number, motion: boolean) {
  const alt = 0.016;
  const here = pointOnPath(path, fraction);
  const halo = group.children[0];
  const core = group.children[1];
  if (!halo || !core) return;
  moveMesh(halo, here.lat, here.lon, alt + 0.004);
  moveMesh(core, here.lat, here.lon, alt);
  const pulse = motion ? 1 + Math.sin(performance.now() / 680) * 0.1 : 1;
  halo.scale.setScalar(pulse);
  for (let i = 2; i < group.children.length; i++) {
    const wake = group.children[i];
    const behind = pointOnPath(path, Math.max(0, fraction - (i - 1) * 0.018));
    moveMesh(wake, behind.lat, behind.lon, alt);
    const material = (wake as THREE.Mesh).material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0.04, 0.34 - (i - 1) * 0.06);
  }
}

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
  const target = useRef(shipFraction);
  const pathRef = useRef(path);
  const shipHold = useRef<THREE.Group | null>(null);
  const framed = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [motion, setMotion] = useState(true);
  target.current = shipFraction;
  pathRef.current = path;

  const material = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color("#071422"),
      emissive: new THREE.Color("#081624"),
      emissiveIntensity: 0.22,
      shininess: 3,
      specular: new THREE.Color("#081420"),
    });
  }, []);

  useEffect(() => {
    if (!material) return;
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.load("/land.png", (texture) => {
      if (!alive) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      material.map = texture;
      material.color.set("#ffffff");
      material.needsUpdate = true;
    });
    return () => {
      alive = false;
      material.map?.dispose();
      material.dispose();
    };
  }, [material]);

  const markReady = useCallback(() => setReady(true), []);

  const arcs = useMemo<Arc[]>(() => {
    const gold = splitDateline(path.points);
    const amber = runs(path, slows).flatMap((run) => splitDateline(run));
    const solid = { dash: 1, gap: 0, animate: 0 };
    return [
      ...gold.map((pts, index) => ({
        id: `halo-${index}`,
        pts: stamp(pts, 0.004),
        color: "rgba(228, 201, 138, 0.2)",
        stroke: 2.6,
        ...solid,
      })),
      ...gold.map((pts, index) => ({
        id: `gold-${index}`,
        pts: stamp(pts, 0.008),
        color: "rgba(232, 208, 150, 0.92)",
        stroke: 1.05,
        ...solid,
      })),
      ...(motion
        ? gold.map((pts, index) => ({
            id: `gleam-${index}`,
            pts: stamp(pts, 0.011),
            color: "rgba(255, 244, 220, 0.95)",
            stroke: 0.72,
            dash: 0.13,
            gap: 0.87,
            animate: 11000,
          }))
        : []),
      ...amber.map((pts, index) => ({
        id: `storm-${index}`,
        pts: stamp(pts, 0.014),
        color: "rgba(224, 158, 84, 0.62)",
        stroke: 5,
        ...solid,
      })),
    ];
  }, [path, slows, motion]);

  const points = useMemo(
    () =>
      ports.flatMap((port) => [
        { ...port, color: "rgba(228, 201, 138, 0.28)", radius: 0.78, alt: 0.006 },
        { ...port, color: "#e8d2a0", radius: 0.26, alt: 0.012 },
      ]),
    [ports],
  );

  const shipLayer = useMemo(() => [{ id: "vessel" }], []);

  const makeShip = useCallback(() => {
    const group = new THREE.Group();
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xf7f1e4, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xfffaf3 }),
    );
    group.add(halo, core);
    for (let i = 0; i < 5; i++) {
      group.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.48, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xe4c98a, transparent: true, opacity: 0.3, depthWrite: false }),
        ),
      );
    }
    shipHold.current = group;
    return group;
  }, []);

  const syncShip = useCallback((obj: THREE.Object3D) => {
    const group = obj as THREE.Group;
    shipHold.current = group;
    placeShip(group, pathRef.current, shown.current, true);
  }, []);

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => setMotion(!reduce.matches);
    applyMotion();
    reduce.addEventListener("change", applyMotion);
    window.addEventListener("resize", measure);
    return () => {
      reduce.removeEventListener("change", applyMotion);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let live = true;
    const step = () => {
      if (!live) return;
      const goal = target.current;
      const delta = goal - shown.current;
      if (!motion || Math.abs(delta) < 0.0008) shown.current = goal;
      else shown.current += delta * 0.14;
      const group = shipHold.current;
      if (group) placeShip(group, pathRef.current, shown.current, motion);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [motion]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe) return;
    const controls = globe.controls();
    controls.autoRotate = false;
    controls.enablePan = false;
    globe.pointOfView(focus, framed.current ? 900 : 0);
    framed.current = true;
  }, [ready, focus.lat, focus.lng, focus.altitude, focus]);

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
        enablePointerInteraction={false}
        pathsData={arcs}
        pathPoints="pts"
        pathPointLat="lat"
        pathPointLng="lon"
        pathPointAlt="alt"
        pathColor="color"
        pathStroke="stroke"
        pathDashLength="dash"
        pathDashGap="gap"
        pathDashAnimateTime="animate"
        pathDashInitialGap={0}
        pathTransitionDuration={0}
        pointsData={points}
        pointLat="lat"
        pointLng="lon"
        pointColor="color"
        pointAltitude="alt"
        pointRadius="radius"
        pointLabel={emptyLabel}
        pointsTransitionDuration={0}
        customLayerData={shipLayer}
        customThreeObject={makeShip}
        customThreeObjectUpdate={syncShip}
        onGlobeReady={markReady}
      />
    </div>
  );
}
