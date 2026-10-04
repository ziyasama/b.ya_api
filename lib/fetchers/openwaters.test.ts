import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyVesselFeed,
  mergeVessel,
  updateFromEvent,
  updateFromFeature,
  vesselStillCurrent,
} from "@/lib/fetchers/openwaters";
import type { AisVesselRaw } from "@/lib/fetchers/types";

const NOW = Date.parse("2026-10-03T16:00:00.000Z");

describe("updateFromFeature", () => {
  it("reads a fresh vessel from a GeoJSON feature", () => {
    const update = updateFromFeature(
      {
        geometry: { coordinates: [29.012, 41.004] },
        properties: {
          mmsi: 273213170,
          name: "MECHTA S",
          length: 119,
          type: 70,
          seen: "2026-10-03T15:59:00.000Z",
          kind: "vessel",
        },
      },
      NOW,
    );
    assert.deepEqual(update, {
      mmsi: "273213170",
      lat: 41.004,
      lon: 29.012,
      lastSeen: "2026-10-03T15:59:00.000Z",
      shipName: "MECHTA S",
      shipType: 70,
      size: 119,
      sog: null,
      cog: null,
      heading: null,
      navStatus: null,
    });
  });

  it("reads course, heading, and navigational status", () => {
    const update = updateFromFeature(
      {
        geometry: { coordinates: [28.9934, 40.9739] },
        properties: {
          mmsi: 123,
          name: "CMA CGM OSAKA",
          length: 260,
          type: 70,
          sog: 12.7,
          cog: 1.1,
          heading: 2,
          nav_status: 0,
          seen: "2026-10-04T13:33:26.000Z",
          kind: "vessel",
        },
      },
      Date.parse("2026-10-04T13:48:26.000Z"),
    );
    assert.equal(update?.cog, 1.1);
    assert.equal(update?.heading, 2);
    assert.equal(update?.navStatus, 0);
    assert.equal(update?.sog, 12.7);
  });

  it("keeps a docking-speed fix inside the strait past the four-hour window", () => {
    const update = updateFromFeature(
      {
        geometry: { coordinates: [28.986057, 41.026275] },
        properties: {
          mmsi: 256191000,
          name: "CELEBRITY ASCENT",
          length: 327,
          type: 60,
          sog: 2.3,
          seen: "2026-10-03T03:00:00.000Z",
          kind: "vessel",
        },
      },
      NOW,
    );
    assert.equal(update?.mmsi, "256191000");
    assert.equal(update?.sog, 2.3);
  });

  it("drops a transit-speed fix and a slow fix outside the strait once they go stale", () => {
    const stale = "2026-10-03T03:00:00.000Z";
    assert.equal(
      updateFromFeature(
        {
          geometry: { coordinates: [28.986057, 41.026275] },
          properties: { mmsi: 1, kind: "vessel", sog: 8, seen: stale },
        },
        NOW,
      ),
      null,
    );
    assert.equal(
      updateFromFeature(
        {
          geometry: { coordinates: [28.8, 40.9] },
          properties: { mmsi: 2, kind: "vessel", sog: 2.3, seen: stale },
        },
        NOW,
      ),
      null,
    );
    assert.equal(
      vesselStillCurrent(
        { lat: 41.026275, lon: 28.986057, lastSeen: stale, sog: 0 },
        NOW,
      ),
      false,
    );
  });

  it("drops aids to navigation and positions older than the stale window", () => {
    assert.equal(
      updateFromFeature(
        {
          geometry: { coordinates: [29, 41] },
          properties: { mmsi: 1, kind: "aton", seen: "2026-10-03T15:59:00.000Z" },
        },
        NOW,
      ),
      null,
    );
    assert.equal(
      updateFromFeature(
        {
          geometry: { coordinates: [29, 41] },
          properties: { mmsi: 2, kind: "vessel", seen: "2026-10-03T09:00:00.000Z" },
        },
        NOW,
      ),
      null,
    );
  });
});

describe("updateFromEvent", () => {
  it("reads a static name onto the last known position", () => {
    const update = updateFromEvent(
      {
        type: "event",
        mmsi: 273124530,
        msg_type: "ShipStaticData",
        lat: 40.9427,
        lon: 28.755,
        time: "2026-10-03T15:58:00.000Z",
        message: { Name: "GARNIZON   ", Type: 70, Dimension: { A: 80, B: 20 } },
      },
      NOW,
    );
    assert.equal(update?.shipName, "GARNIZON");
    assert.equal(update?.size, 100);
    assert.equal(update?.shipType, 70);
  });

  it("ignores base stations", () => {
    assert.equal(
      updateFromEvent(
        {
          type: "event",
          mmsi: 1,
          msg_type: "BaseStationReport",
          lat: 41,
          lon: 29,
          time: "2026-10-03T15:59:00.000Z",
        },
        NOW,
      ),
      null,
    );
  });
});

describe("mergeVessel", () => {
  const existing: AisVesselRaw = {
    mmsi: "1",
    lat: 41.01,
    lon: 29.01,
    size: 100,
    shipName: "OLD",
    shipType: 70,
    lastSeen: "2026-10-03T15:50:00.000Z",
    transit: null,
  };

  it("tracks a short move and keeps the name when the new fix has none", () => {
    const { vessel, track } = mergeVessel(existing, {
      mmsi: "1",
      lat: 41.02,
      lon: 29.01,
      lastSeen: "2026-10-03T15:51:00.000Z",
      shipName: null,
      shipType: null,
      size: null,
      sog: null,
    });
    assert.equal(track, true);
    assert.equal(vessel.transit, "northbound");
    assert.equal(vessel.shipName, "OLD");
    assert.equal(vessel.size, 100);
  });

  it("does not invent a transit across a multi-hour gap", () => {
    const { vessel, track } = mergeVessel(existing, {
      mmsi: "1",
      lat: 41.2,
      lon: 29.1,
      lastSeen: "2026-10-03T18:00:00.000Z",
      shipName: "OLD",
      shipType: 70,
      size: 100,
      sog: null,
    });
    assert.equal(track, false);
    assert.equal(vessel.transit, null);
    assert.equal(vessel.lat, 41.2);
  });

  it("takes northbound from course even when this step's latitude fell", () => {
    const { vessel, track } = mergeVessel(
      { ...existing, transit: "southbound", sog: 8, cog: 180 },
      {
        mmsi: "1",
        lat: 41.005,
        lon: 29.01,
        lastSeen: "2026-10-03T15:51:00.000Z",
        shipName: "OLD",
        shipType: 70,
        size: 100,
        sog: 12.7,
        cog: 1.1,
        heading: 2,
        navStatus: 0,
      },
    );
    assert.equal(track, true);
    assert.equal(vessel.transit, "northbound");
    assert.equal(vessel.cog, 1.1);
  });

  it("clears direction when the ship is no longer making way", () => {
    const { vessel } = mergeVessel(
      { ...existing, transit: "northbound", sog: 10, cog: 1 },
      {
        mmsi: "1",
        lat: 41.011,
        lon: 29.01,
        lastSeen: "2026-10-03T15:51:00.000Z",
        shipName: "OLD",
        shipType: 70,
        size: 100,
        sog: 0.4,
        cog: 1,
        navStatus: 0,
      },
    );
    assert.equal(vessel.transit, null);
  });
});

describe("vesselStillCurrent", () => {
  const inside = { lat: 41.05, lon: 29.02, sog: 8 };

  it("keeps an underway ship through the six-hour window and drops it after", () => {
    assert.equal(
      vesselStillCurrent(
        { ...inside, lastSeen: new Date(NOW - 5 * 60 * 60 * 1000).toISOString() },
        NOW,
      ),
      true,
    );
    assert.equal(
      vesselStillCurrent(
        { ...inside, lastSeen: new Date(NOW - 7 * 60 * 60 * 1000).toISOString() },
        NOW,
      ),
      false,
    );
  });
});

describe("classifyVesselFeed", () => {
  it("accepts only a recent non-empty roster", () => {
    assert.equal(
      classifyVesselFeed({ vesselCount: 140, ingestAgeMs: 30_000, silenceMs: 180_000 }),
      "ok",
    );
  });

  it("treats a fresh empty region as a failed feed", () => {
    assert.equal(
      classifyVesselFeed({ vesselCount: 0, ingestAgeMs: 5_000, silenceMs: 180_000 }),
      "empty",
    );
  });

  it("keeps ships visible when the feed is merely late", () => {
    assert.equal(
      classifyVesselFeed({ vesselCount: 40, ingestAgeMs: 400_000, silenceMs: 180_000 }),
      "late",
    );
  });
});
