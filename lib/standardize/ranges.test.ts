import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RANGES, softenCountRange } from "@/lib/standardize/ranges";

describe("softenCountRange", () => {
  it("opens a logged band so a usual count is not the rail", () => {
    assert.deepEqual(softenCountRange(142, 153), { min: 90, max: 210 });
  });
});

describe("passage ranges", () => {
  it("runs from an empty four hours to a busy one", () => {
    assert.deepEqual(RANGES.vesselCount, { min: 0, max: 40 });
    assert.deepEqual(RANGES.northboundCount, { min: 0, max: 20 });
    assert.deepEqual(RANGES.southboundCount, { min: 0, max: 20 });
  });
});
