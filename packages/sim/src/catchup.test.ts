import { describe, it, expect } from "vitest";
import { catchUp } from "./catchup.js";
import { emptyResources, type SimSettlement, type SimBuilding } from "./economy.js";
import { MS_PER_HOUR, SEASON_CYCLE_MS, SEASONS, BASE_STORAGE } from "./constants.js";

let idc = 0;
function b(p: Partial<SimBuilding> & Pick<SimBuilding, "type">): SimBuilding {
  return { id: `b${idc++}`, level: 1, workers: 0, constructionEndsAt: 0, ...p };
}
function settlement(buildings: SimBuilding[], resources = emptyResources()): SimSettlement {
  return { buildings, resources };
}

const EPOCH = 0; // season 0 (spring) begins at t=0

describe("catchUp", () => {
  it("is a no-op when toTime <= fromTime", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3 })]);
    const r = catchUp(s, 1000, 1000, EPOCH);
    expect(r.settlement.resources.wood).toBe(0);
  });

  it("accrues one hour of woodcutter output within a single season", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3 })]);
    // Start well inside spring so no season boundary is crossed.
    const from = 1 * MS_PER_HOUR;
    const r = catchUp(s, from, from + MS_PER_HOUR, EPOCH);
    expect(r.settlement.resources.wood).toBeCloseTo(60);
  });

  it("respects storage cap across a long offline window", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3 })]);
    // 100 hours would be 6000 wood, but cap is BASE_STORAGE.
    const r = catchUp(s, MS_PER_HOUR, MS_PER_HOUR + 100 * MS_PER_HOUR, EPOCH);
    expect(r.settlement.resources.wood).toBe(BASE_STORAGE);
  });

  it("stops farm food production when crossing into winter", () => {
    // Farm running from the last hour of autumn into winter. Quarter = SEASON_CYCLE_MS/4.
    const quarter = SEASON_CYCLE_MS / SEASONS.length;
    const winterStart = 3 * quarter; // spring,summer,autumn,|winter
    const from = winterStart - MS_PER_HOUR; // 1h before winter (autumn)
    const to = winterStart + MS_PER_HOUR; // 1h into winter
    const s = settlement([b({ type: "farm", workers: 4 })]);
    const r = catchUp(s, from, to, EPOCH);
    // 1h autumn @80/h + 1h winter @0/h = 80 (capped well under BASE_STORAGE).
    expect(r.settlement.resources.food).toBeCloseTo(80);
  });

  it("a building that finishes mid-window only produces after completion", () => {
    const from = 1 * MS_PER_HOUR;
    const finishesAt = from + MS_PER_HOUR; // operational after 1h
    const to = from + 2 * MS_PER_HOUR; // total 2h window
    const s = settlement([b({ type: "woodcutter", workers: 3, constructionEndsAt: finishesAt })]);
    const r = catchUp(s, from, to, EPOCH);
    // Only the second hour produces → ~60 wood, and completion is reported.
    expect(r.settlement.resources.wood).toBeCloseTo(60);
    expect(r.completedBuildings).toContain(s.buildings[0]!.id);
  });

  it("is deterministic: same inputs give same output", () => {
    const mk = () => settlement([b({ type: "woodcutter", workers: 2 })]);
    const a = catchUp(mk(), MS_PER_HOUR, 10 * MS_PER_HOUR, EPOCH);
    const c = catchUp(mk(), MS_PER_HOUR, 10 * MS_PER_HOUR, EPOCH);
    expect(a.settlement.resources).toEqual(c.settlement.resources);
  });

  it("does not mutate the input settlement resources", () => {
    const res = { ...emptyResources(), wood: 10 };
    const s = settlement([b({ type: "woodcutter", workers: 3 })], res);
    catchUp(s, MS_PER_HOUR, 2 * MS_PER_HOUR, EPOCH);
    expect(res.wood).toBe(10);
  });
});
