import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyVesselFeed,
  mergeVessel,
  updateFromEvent,
  updateFromFeature,
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
    });
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
          properties: { mmsi: 2, kind: "vessel", seen: "2026-10-03T11:00:00.000Z" },
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
    });
    assert.equal(track, false);
    assert.equal(vessel.transit, null);
    assert.equal(vessel.lat, 41.2);
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
