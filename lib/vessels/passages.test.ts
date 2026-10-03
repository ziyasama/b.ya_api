import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityAt,
  activitySeries,
  completedPassages,
  MAX_TRANSIT_MS,
  PASSAGE_WINDOW_MS,
  type Crossing,
} from "@/lib/vessels/passages";

function crossing(
  mmsi: string,
  gate: Crossing["gate"],
  direction: Crossing["direction"],
  at: string,
): Crossing {
  return { mmsi, gate, direction, crossedAt: at };
}

const now = Date.parse("2026-10-03T19:00:00.000Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("completedPassages", () => {
  it("counts a northbound ship that clears the Black Sea mouth", () => {
    const passages = completedPassages([
      crossing("1", "south", "northbound", ago(3 * 60 * 60 * 1000)),
      crossing("1", "north", "northbound", ago(60 * 60 * 1000)),
    ]);
    assert.equal(passages.length, 1);
    assert.equal(passages[0]?.direction, "northbound");
    assert.equal(passages[0]?.mmsi, "1");
  });

  it("counts a southbound ship that clears the Marmara mouth", () => {
    const passages = completedPassages([
      crossing("2", "north", "southbound", ago(2 * 60 * 60 * 1000)),
      crossing("2", "south", "southbound", ago(30 * 60 * 1000)),
    ]);
    assert.equal(passages.length, 1);
    assert.equal(passages[0]?.direction, "southbound");
  });

  it("does not count a ship that has only entered", () => {
    const passages = completedPassages([
      crossing("3", "south", "northbound", ago(20 * 60 * 1000)),
    ]);
    assert.equal(passages.length, 0);
  });

  it("keeps the latest entry when the ship jitters on the line", () => {
    const passages = completedPassages([
      crossing("4", "south", "northbound", ago(90 * 60 * 1000)),
      crossing("4", "south", "northbound", ago(80 * 60 * 1000)),
      crossing("4", "north", "northbound", ago(70 * 60 * 1000)),
      crossing("4", "north", "northbound", ago(69 * 60 * 1000)),
    ]);
    assert.equal(passages.length, 1);
    assert.equal(passages[0]?.enteredAt, ago(80 * 60 * 1000));
  });

  it("drops an entry when the ship turns around", () => {
    const passages = completedPassages([
      crossing("5", "south", "northbound", ago(3 * 60 * 60 * 1000)),
      crossing("5", "south", "southbound", ago(2 * 60 * 60 * 1000)),
      crossing("5", "north", "northbound", ago(60 * 60 * 1000)),
    ]);
    assert.equal(passages.length, 0);
  });

  it("does not pair an exit with an entry older than the transit limit", () => {
    const passages = completedPassages([
      crossing("6", "south", "northbound", ago(MAX_TRANSIT_MS + 60_000)),
      crossing("6", "north", "northbound", ago(30_000)),
    ]);
    assert.equal(passages.length, 0);
  });
});

describe("activityAt", () => {
  it("counts a completion inside the four-hour window whose entry began earlier", () => {
    const counts = activityAt(
      [
        crossing("7", "south", "northbound", ago(PASSAGE_WINDOW_MS + 30 * 60 * 1000)),
        crossing("7", "north", "northbound", ago(60 * 60 * 1000)),
        crossing("8", "north", "southbound", ago(PASSAGE_WINDOW_MS + 3 * 60 * 60 * 1000)),
        crossing("8", "south", "southbound", ago(PASSAGE_WINDOW_MS + 60 * 60 * 1000)),
      ],
      now,
    );
    assert.deepEqual(counts, { total: 1, northbound: 1, southbound: 0 });
  });

  it("splits the window by direction", () => {
    const counts = activityAt(
      [
        crossing("9", "south", "northbound", ago(3 * 60 * 60 * 1000)),
        crossing("9", "north", "northbound", ago(2 * 60 * 60 * 1000)),
        crossing("10", "north", "southbound", ago(90 * 60 * 1000)),
        crossing("10", "south", "southbound", ago(20 * 60 * 1000)),
      ],
      now,
    );
    assert.deepEqual(counts, { total: 2, northbound: 1, southbound: 1 });
  });
});

describe("activitySeries", () => {
  it("leaves a passage that just completed out of the previous sample", () => {
    const series = activitySeries(
      [
        crossing("11", "south", "northbound", ago(40 * 60 * 1000)),
        crossing("11", "north", "northbound", ago(30_000)),
      ],
      now,
    );
    assert.equal(series.current.total, 1);
    assert.equal(series.previous.total, 0);
    assert.equal(series.history.total.at(-1)?.v, 1);
    assert.ok(series.history.northbound.length > 2);
  });
});
