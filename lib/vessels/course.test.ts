import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AisVesselRaw } from "@/lib/fetchers/types";
import { toBosphorusState } from "@/lib/standardize";
import { carryUnderway, resolveTransit, transitFromCourse } from "@/lib/vessels/course";
import { inStrait } from "@/lib/vessels/inside";

const NOW = Date.parse("2026-10-04T13:48:26.000Z");

describe("transitFromCourse", () => {
  it("is northbound on a bow pointed up the strait, including the Rumeli bend", () => {
    assert.equal(transitFromCourse(1.1, 12.7), "northbound");
    assert.equal(transitFromCourse(46, 7), "northbound");
    assert.equal(transitFromCourse(347, 4.2), "northbound");
  });

  it("is southbound toward the Marmara", () => {
    assert.equal(transitFromCourse(200, 9.7), "southbound");
    assert.equal(transitFromCourse(134, 4), "southbound");
  });

  it("is unknown when the ship is slow or crossing the channel", () => {
    assert.equal(transitFromCourse(1, 2.3), null);
    assert.equal(transitFromCourse(104, 5), null);
    assert.equal(transitFromCourse(null, 10), null);
  });
});

describe("carryUnderway", () => {
  it("walks a northbound ship from the Marmara mouth into the strait", () => {
    // CMA CGM OSAKA, 4 Oct 2026: last fix south of the box, course due north
    // at 12.7 kn, fifteen minutes old. From the shore it is already inside.
    const placed = carryUnderway(
      {
        lat: 40.9739,
        lon: 28.9934,
        lastSeen: "2026-10-04T13:33:26.000Z",
        sog: 12.7,
        cog: 1.1,
        heading: 2,
        navStatus: 0,
        transit: null,
      },
      NOW,
    );
    assert.equal(placed.transit, "northbound");
    assert.equal(inStrait(placed.lat, placed.lon), true);
    assert.ok(placed.lat > 41.01 && placed.lat < 41.05);
  });

  it("keeps a fast ship inside for the count window after the line has left the far mouth", () => {
    const placed = carryUnderway(
      {
        lat: 41.2,
        lon: 29.1,
        lastSeen: new Date(NOW - 90 * 60 * 1000).toISOString(),
        sog: 12,
        cog: 0,
        transit: null,
      },
      NOW,
    );
    assert.equal(placed.transit, "northbound");
    assert.equal(inStrait(placed.lat, placed.lon), true);
    assert.ok(placed.lat > 41.2);
  });

  it("stops carrying a ship once the six-hour window has passed", () => {
    const placed = carryUnderway(
      {
        lat: 40.9739,
        lon: 28.9934,
        lastSeen: new Date(NOW - 7 * 60 * 60 * 1000).toISOString(),
        sog: 12.7,
        cog: 1.1,
        navStatus: 0,
        transit: null,
      },
      NOW,
    );
    assert.equal(placed.lat, 40.9739);
    assert.equal(inStrait(placed.lat, placed.lon), false);
  });

  it("leaves a ship that is still well out in the Marmara where it was", () => {
    const placed = carryUnderway(
      {
        lat: 40.9,
        lon: 29.0,
        lastSeen: "2026-10-04T13:33:26.000Z",
        sog: 12.7,
        cog: 1.1,
        navStatus: 0,
        transit: null,
      },
      NOW,
    );
    assert.equal(placed.lat, 40.9);
    assert.equal(placed.transit, "northbound");
    assert.equal(inStrait(placed.lat, placed.lon), false);
  });

  it("does not move a moored ship or a ship under 3 knots", () => {
    const moored = carryUnderway(
      {
        lat: 40.9739,
        lon: 28.9934,
        lastSeen: "2026-10-04T13:33:26.000Z",
        sog: 12.7,
        cog: 1.1,
        navStatus: 5,
        transit: "northbound",
      },
      NOW,
    );
    assert.equal(moored.lat, 40.9739);
    assert.equal(moored.transit, null);

    const docking = carryUnderway(
      {
        lat: 41.026,
        lon: 28.986,
        lastSeen: "2026-10-04T13:00:00.000Z",
        sog: 2.3,
        cog: 254,
        transit: "southbound",
      },
      NOW,
    );
    assert.equal(docking.lat, 41.026);
    assert.equal(docking.transit, null);
  });
});

describe("resolveTransit", () => {
  it("trusts course when a latitude step points the other way", () => {
    assert.equal(
      resolveTransit(
        { lat: 41.02, lon: 29.01, sog: 10, cog: 1, transit: null },
        "southbound",
      ),
      "northbound",
    );
  });
});

describe("toBosphorusState vessel direction", () => {
  it("counts the ship north of a stale mouth fix, and still counts one whose course has left the far mouth", () => {
    const cma: AisVesselRaw = {
      mmsi: "1",
      lat: 40.9739,
      lon: 28.9934,
      size: 260,
      shipName: "CMA CGM OSAKA",
      shipType: 70,
      lastSeen: "2026-10-04T13:33:26.000Z",
      sog: 12.7,
      cog: 1.1,
      heading: 2,
      navStatus: 0,
      transit: null,
    };
    const stopped: AisVesselRaw = {
      mmsi: "2",
      lat: 41.05,
      lon: 29.02,
      size: 40,
      shipName: "ALONGSIDE",
      shipType: 60,
      lastSeen: "2026-10-04T13:40:00.000Z",
      sog: 0.2,
      cog: 10,
      navStatus: 5,
      transit: null,
    };
    const gone: AisVesselRaw = {
      mmsi: "3",
      lat: 41.2,
      lon: 29.1,
      size: 200,
      shipName: "ALREADY OUT",
      shipType: 70,
      lastSeen: new Date(NOW - 90 * 60 * 1000).toISOString(),
      sog: 12,
      cog: 0,
      navStatus: 0,
      transit: null,
    };
    const south: AisVesselRaw = {
      mmsi: "4",
      lat: 41.1,
      lon: 29.04,
      size: 32,
      shipName: "KURTARMA",
      shipType: 52,
      lastSeen: "2026-10-04T13:48:00.000Z",
      sog: 9.7,
      cog: 200,
      navStatus: 0,
      transit: null,
    };

    const state = toBosphorusState({
      now: new Date(NOW),
      openMeteo: {
        ok: false,
        health: "unavailable",
        data: null,
        fetchedAt: new Date(NOW).toISOString(),
        error: "not used",
      },
      ais: {
        ok: true,
        health: "ok",
        fetchedAt: new Date(NOW).toISOString(),
        data: { vesselCount: 4, vessels: [cma, stopped, gone, south] },
      },
    });

    assert.equal(state.vesselCount, 4);
    assert.equal(state.northboundCount, 2);
    assert.equal(state.southboundCount, 1);
    const published = state.vesselData.find((vessel) => vessel.mmsi === "1");
    assert.equal(published?.transit, "northbound");
    assert.equal(published != null && inStrait(published.lat, published.lon), true);
  });
});
