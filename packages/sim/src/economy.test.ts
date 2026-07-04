import { describe, it, expect } from "vitest";
import {
  emptyResources,
  ratesPerHour,
  applyRates,
  storageCap,
  housingCapacity,
  canAfford,
  spend,
  isOperational,
  type SimSettlement,
  type SimBuilding,
} from "./economy.js";
import { BASE_STORAGE, WINTER, MS_PER_HOUR } from "./constants.js";

let idc = 0;
function b(partial: Partial<SimBuilding> & Pick<SimBuilding, "type">): SimBuilding {
  return {
    id: `b${idc++}`,
    level: 1,
    workers: 0,
    constructionEndsAt: 0, // operational by default
    ...partial,
  };
}

function settlement(buildings: SimBuilding[], resources = emptyResources()): SimSettlement {
  return { buildings, resources };
}

const NOW = 1_000_000;

describe("isOperational", () => {
  it("is false while under construction, true after", () => {
    expect(isOperational(b({ type: "farm", constructionEndsAt: NOW + 1 }), NOW)).toBe(false);
    expect(isOperational(b({ type: "farm", constructionEndsAt: NOW }), NOW)).toBe(true);
  });
});

describe("ratesPerHour — production", () => {
  it("fully staffed woodcutter produces its full output", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3 })]);
    expect(ratesPerHour(s, "summer", NOW).wood).toBe(60);
  });

  it("scales linearly with staffing fraction", () => {
    const s = settlement([b({ type: "woodcutter", workers: 1 })]); // 1/3 slots
    expect(ratesPerHour(s, "summer", NOW).wood).toBeCloseTo(20);
  });

  it("produces nothing with zero workers", () => {
    const s = settlement([b({ type: "woodcutter", workers: 0 })]);
    expect(ratesPerHour(s, "summer", NOW).wood).toBe(0);
  });

  it("does not run buildings still under construction", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3, constructionEndsAt: NOW + 5000 })]);
    expect(ratesPerHour(s, "summer", NOW).wood).toBe(0);
  });

  it("level multiplies output", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3, level: 2 })]);
    expect(ratesPerHour(s, "summer", NOW).wood).toBe(120);
  });
});

describe("ratesPerHour — chains", () => {
  it("sawmill consumes wood and produces planks", () => {
    const s = settlement([b({ type: "sawmill", workers: 3 })]);
    const r = ratesPerHour(s, "summer", NOW);
    expect(r.wood).toBe(-40);
    expect(r.planks).toBe(30);
  });

  it("woodcutter + sawmill net wood is the difference", () => {
    const s = settlement([
      b({ type: "woodcutter", workers: 3 }),
      b({ type: "sawmill", workers: 3 }),
    ]);
    const r = ratesPerHour(s, "summer", NOW);
    expect(r.wood).toBe(60 - 40);
    expect(r.planks).toBe(30);
  });

  it("smithy consumes iron and produces tools", () => {
    const s = settlement([b({ type: "smithy", workers: 3 })]);
    const r = ratesPerHour(s, "summer", NOW);
    expect(r.iron).toBe(-30);
    expect(r.tools).toBe(15);
  });
});

describe("ratesPerHour — winter", () => {
  it("farms produce no food in winter", () => {
    const s = settlement([b({ type: "farm", workers: 4 })]);
    expect(ratesPerHour(s, "summer", NOW).food).toBe(80);
    expect(ratesPerHour(s, "winter", NOW).food).toBe(0);
    expect(WINTER.farmFoodMultiplier).toBe(0);
  });

  it("fishing huts still work in winter", () => {
    const s = settlement([b({ type: "fishing_hut", workers: 2 })]);
    expect(ratesPerHour(s, "winter", NOW).food).toBe(40);
  });

  it("houses burn extra wood for heating in winter only", () => {
    const s = settlement([b({ type: "house" }), b({ type: "house" })]);
    expect(ratesPerHour(s, "summer", NOW).wood).toBe(0);
    expect(ratesPerHour(s, "winter", NOW).wood).toBe(-2 * WINTER.heatingWoodPerHousePerHour);
  });
});

describe("storageCap & housing", () => {
  it("base cap with no storage buildings", () => {
    const s = settlement([]);
    expect(storageCap(s, "wood", NOW)).toBe(BASE_STORAGE);
  });

  it("warehouse and town hall add capacity", () => {
    const s = settlement([b({ type: "warehouse" }), b({ type: "town_hall" })]);
    expect(storageCap(s, "wood", NOW)).toBe(BASE_STORAGE + 500 + 200);
  });

  it("gold is uncapped", () => {
    const s = settlement([]);
    expect(storageCap(s, "gold", NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it("houses provide population capacity, scaled by level", () => {
    const s = settlement([b({ type: "house" }), b({ type: "house", level: 2 })]);
    expect(housingCapacity(s, NOW)).toBe(4 + 8);
  });
});

describe("applyRates", () => {
  it("adds resources over elapsed time", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3 })]);
    const rates = ratesPerHour(s, "summer", NOW);
    const next = applyRates(s, rates, MS_PER_HOUR, NOW); // 1 hour → +60 wood
    expect(next.wood).toBe(60);
  });

  it("clamps to storage cap", () => {
    const s = settlement([b({ type: "woodcutter", workers: 3 })], {
      ...emptyResources(),
      wood: BASE_STORAGE - 10,
    });
    const rates = ratesPerHour(s, "summer", NOW);
    const next = applyRates(s, rates, MS_PER_HOUR, NOW);
    expect(next.wood).toBe(BASE_STORAGE);
  });

  it("never goes below zero", () => {
    const s = settlement([b({ type: "sawmill", workers: 3 })], { ...emptyResources(), wood: 5 });
    const rates = ratesPerHour(s, "summer", NOW); // wood -40/h
    const next = applyRates(s, rates, MS_PER_HOUR, NOW);
    expect(next.wood).toBe(0);
  });

  it("does not mutate the input resources", () => {
    const res = { ...emptyResources(), wood: 100 };
    const s = settlement([b({ type: "woodcutter", workers: 3 })], res);
    const rates = ratesPerHour(s, "summer", NOW);
    applyRates(s, rates, MS_PER_HOUR, NOW);
    expect(res.wood).toBe(100);
  });
});

describe("canAfford & spend", () => {
  it("canAfford checks every resource", () => {
    const res = { ...emptyResources(), wood: 50, planks: 10 };
    expect(canAfford(res, { wood: 40, planks: 10 })).toBe(true);
    expect(canAfford(res, { wood: 40, planks: 11 })).toBe(false);
  });

  it("spend subtracts and does not mutate", () => {
    const res = { ...emptyResources(), wood: 50 };
    const next = spend(res, { wood: 20 });
    expect(next.wood).toBe(30);
    expect(res.wood).toBe(50);
  });
});
