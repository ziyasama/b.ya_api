import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectCrossings, MAX_GAP_MS, transitDirection } from "@/lib/vessels/events";
import type { VesselFix } from "@/lib/vessels/events";

function fix(
  mmsi: string,
  lat: number,
  lon: number,
  lastSeen: string,
): VesselFix {
  return { mmsi, lat, lon, lastSeen, shipName: "TEST" };
}

const t0 = "2026-09-02T12:00:00.000Z";
const t1 = "2026-09-02T12:01:00.000Z";

describe("transitDirection", () => {
  it("is northbound when latitude increases by more than jitter", () => {
    assert.equal(
      transitDirection({ lat: 41.1, lon: 29.05 }, { lat: 41.12, lon: 29.05 }),
      "northbound",
    );
  });

  it("is southbound when latitude decreases by more than jitter", () => {
    assert.equal(
      transitDirection({ lat: 41.12, lon: 29.05 }, { lat: 41.1, lon: 29.05 }),
      "southbound",
    );
  });

  it("is unknown for AIS jitter", () => {
    assert.equal(
      transitDirection({ lat: 41.1, lon: 29.05 }, { lat: 41.10005, lon: 29.05 }),
      null,
    );
  });
});

describe("detectCrossings", () => {
  it("fires northbound at the Rumeli–Anadolu line", () => {
    const events = detectCrossings(
      fix("1", 41.2, 29.13, t0),
      fix("1", 41.25, 29.13, t1),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.gate, "north");
    assert.equal(events[0]?.direction, "northbound");
    assert.ok(events[0] && events[0].lat > 41.21 && events[0].lat < 41.24);
  });

  it("fires southbound at the Ahırkapı–İnciburnu line", () => {
    const events = detectCrossings(
      fix("2", 41.03, 29.0, t0),
      fix("2", 40.98, 29.0, t1),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.gate, "south");
    assert.equal(events[0]?.direction, "southbound");
  });

  it("does not invent a crossing from jitter", () => {
    const events = detectCrossings(
      fix("3", 41.2, 29.13, t0),
      fix("3", 41.20005, 29.13, t1),
    );
    assert.equal(events.length, 0);
  });

  it("does not invent a crossing across a long AIS gap", () => {
    const later = new Date(Date.parse(t0) + MAX_GAP_MS + 1000).toISOString();
    const events = detectCrossings(
      fix("4", 41.2, 29.13, t0),
      fix("4", 41.25, 29.13, later),
    );
    assert.equal(events.length, 0);
  });

  it("does not fire when the track misses the lighthouse line", () => {
    const events = detectCrossings(
      fix("5", 41.2, 28.9, t0),
      fix("5", 41.25, 28.9, t1),
    );
    assert.equal(events.length, 0);
  });
});
