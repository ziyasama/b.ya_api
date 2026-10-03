import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RANGES, softenCountRange } from "@/lib/standardize/ranges";

describe("softenCountRange", () => {
  it("opens the logged vessel band so a usual count is not the rail", () => {
    assert.deepEqual(softenCountRange(142, 153), { min: 90, max: 210 });
    assert.deepEqual(RANGES.vesselCount, { min: 90, max: 210 });
  });

  it("keeps a modest change inside the span", () => {
    const { min, max } = RANGES.vesselCount;
    assert.ok(100 > min && 100 < max);
    assert.ok(120 > min && 120 < max);
    assert.ok(145 > min && 145 < max);
  });
});
