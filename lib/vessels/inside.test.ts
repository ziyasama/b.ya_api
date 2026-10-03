import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inStrait, straitCounts, straitFirst } from "@/lib/vessels/inside";

describe("inStrait", () => {
  it("accepts a ship between the mouths", () => {
    assert.equal(inStrait(41.12, 29.05), true);
  });

  it("rejects the Marmara approaches and the Black Sea approaches", () => {
    assert.equal(inStrait(40.9, 29.0), false);
    assert.equal(inStrait(41.35, 29.2), false);
  });
});

describe("straitCounts", () => {
  it("counts only ships inside, split by the way they are moving", () => {
    const counts = straitCounts([
      { lat: 41.1, lon: 29.03, transit: "northbound" },
      { lat: 41.08, lon: 29.02, transit: "southbound" },
      { lat: 41.15, lon: 29.06, transit: null },
      { lat: 40.9, lon: 29.0, transit: "northbound" },
    ]);
    assert.deepEqual(counts, { total: 3, northbound: 1, southbound: 1 });
  });
});

describe("straitFirst", () => {
  it("lists ships inside the strait ahead of the approaches, keeping each group's order", () => {
    const ordered = straitFirst([
      { mmsi: "a", lat: 40.9, lon: 29.0 },
      { mmsi: "b", lat: 41.1, lon: 29.05 },
      { mmsi: "c", lat: 40.95, lon: 28.8 },
      { mmsi: "d", lat: 41.2, lon: 29.1 },
    ]);
    assert.deepEqual(
      ordered.map((vessel) => vessel.mmsi),
      ["b", "d", "a", "c"],
    );
  });
});