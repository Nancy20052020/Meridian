import assert from "node:assert/strict";
import test from "node:test";
import { calendarDaysBetween, projectCash } from "../lib/cash";
import { delayHours, slowdown } from "../lib/delay";
import { buildPath, haversineNm, pointOnPath, splitDateline } from "../lib/geo";
import { cashLine, delayLine, landingLine } from "../lib/format";
import { DEFAULT_HOME, DEFAULT_ORIGIN, findRoute, ROUTES } from "../lib/routes";
import { picture, planVoyage, shipFraction } from "../lib/voyage";

test("a calm leg adds nothing and a gale adds time", () => {
  assert.equal(slowdown(10, 1.2), 0);
  const gale = slowdown(29, 5);
  assert.ok(gale > 0.3 && gale <= 0.6);
  const hours = delayHours([0, 0, gale, 0], 400);
  assert.ok(hours > 20);
  assert.equal(delayHours([0, 0, 0, 0], 400), 0);
});

test("the date line split does not jump across the map", () => {
  const segments = splitDateline([
    { lat: 40, lon: 170 },
    { lat: 41, lon: -170 },
    { lat: 42, lon: -160 },
  ]);
  assert.equal(segments.length, 2);
  for (const segment of segments) {
    for (let i = 1; i < segment.length; i++) {
      const jump = Math.abs(segment[i].lon - segment[i - 1].lon);
      assert.ok(jump <= 180, `jump ${jump}`);
    }
  }
});

test("delay holds the ship back on the schedule", () => {
  assert.ok(shipFraction(100, 400, 0) > shipFraction(100, 400, 40));
});

test("sample Shanghai to Los Angeles is a long sea lane already underway", () => {
  const route = findRoute(DEFAULT_ORIGIN, DEFAULT_HOME);
  const path = buildPath(route.waypoints, 80);
  assert.ok(path.totalNm > 5000);
  assert.ok(path.totalNm < 8000);
  const now = new Date("2026-10-19T19:00:00Z");
  const voyage = planVoyage(route, now);
  assert.ok(voyage.scheduledArrival.getTime() > now.getTime());
  const mid = pointOnPath(path, 0.4);
  assert.ok(mid.lat > 20 && mid.lat < 60);
});

test("two days of delay pushes the invoice past payroll", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const scheduled = new Date("2026-11-02T12:00:00Z");
  const held = projectCash({
    now,
    timeZone: "America/Los_Angeles",
    cashOnHand: 80000,
    billHome: 62000,
    invoice: 112000,
    invoiceDaysAfterLanding: 5,
    payroll: 44000,
    scheduledArrival: scheduled,
    adjustedArrival: scheduled,
    payrollDaysAfterScheduledArrival: 7,
  });
  assert.equal(held.firstZeroAt, null);

  const late = projectCash({
    now,
    timeZone: "America/Los_Angeles",
    cashOnHand: 80000,
    billHome: 62000,
    invoice: 112000,
    invoiceDaysAfterLanding: 5,
    payroll: 44000,
    scheduledArrival: scheduled,
    adjustedArrival: new Date(scheduled.getTime() + 3 * 24 * 60 * 60 * 1000),
    payrollDaysAfterScheduledArrival: 7,
  });
  assert.ok(late.firstZeroAt);
  assert.equal(cashLine(late.firstZeroAt, late.payrollAt, "America/Los_Angeles"), "Cash crosses zero on payday.");
  assert.equal(
    calendarDaysBetween(late.billAt, late.payrollAt, "America/Los_Angeles") > 0,
    true,
  );
});

test("a calm picture keeps cash above zero", () => {
  const route = findRoute("shanghai", "los-angeles");
  const now = new Date("2026-10-19T19:00:00Z");
  const voyage = planVoyage(route, now);
  const calm = voyage.samples.map(() => ({ windKnots: 8, waveMeters: 1.2 }));
  const view = picture(route, voyage, calm, 1 / 6.7, now);
  assert.equal(view.delayHours, 0);
  assert.equal(view.cash?.firstZeroAt ?? null, null);
  assert.equal(landingLine(view.daysBeforePayday ?? 0).includes("before payday"), true);
  assert.match(delayLine(0), /no time/);
});

test("every route has a sea lane and a cash book", () => {
  for (const route of ROUTES) {
    assert.ok(route.waypoints.length >= 2);
    assert.equal(route.waypoints[0].lat, route.origin.lat);
    assert.equal(route.waypoints.at(-1)?.lat, route.home.lat);
    assert.ok(route.cash.cashOnHand > route.cash.payroll * 0.5);
    assert.equal(route.speedKnots, 14);
    const miles = haversineNm(route.waypoints[0], route.waypoints[1]);
    assert.ok(miles < 2500, `${route.id} first hop ${miles}`);
  }
});
