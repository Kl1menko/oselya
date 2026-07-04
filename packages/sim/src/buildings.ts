import type { ResourceType } from "./constants.js";

/**
 * Building catalog — SINGLE SOURCE OF TRUTH for the 14 MVP buildings (AGENT.md §3.2).
 * Mirror every change in docs/balance.md. No magic numbers elsewhere.
 *
 * Rates are per real hour at full staffing (all workSlots filled); the tick applies a
 * pro-rated fraction. `inputs`/`outputs` are resource-per-hour maps. A building with an
 * empty `inputs` gathers from the map (needs an adjacency requirement); one with `inputs`
 * refines them.
 */

export const BUILDING_TYPES = [
  "town_hall",
  "house",
  "woodcutter",
  "sawmill",
  "quarry",
  "farm",
  "fishing_hut",
  "mine",
  "smithy",
  "market",
  "weavery",
  "pasture",
  "warehouse",
  "barracks",
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

/** Terrain adjacency a building requires to be placeable / productive. */
export type Adjacency = "forest" | "stone" | "iron" | "water" | "none";

export interface BuildingDef {
  /** Footprint in tiles. */
  size: { w: number; h: number };
  /** One-time construction cost (resource → amount). */
  cost: Partial<Record<ResourceType, number>>;
  /** Construction time in ms at level 1. */
  buildTimeMs: number;
  /** Number of worker slots; production scales with assigned/slots. 0 = passive. */
  workSlots: number;
  /** Consumed per hour at full staffing. */
  inputs: Partial<Record<ResourceType, number>>;
  /** Produced per hour at full staffing. */
  outputs: Partial<Record<ResourceType, number>>;
  /** Required adjacent terrain to place/operate. */
  requires: Adjacency;
  /** Population capacity added (houses). */
  housing?: number;
  /** Extra storage capacity added (warehouse / town hall). */
  storageBonus?: number;
  /** Max count per settlement (town_hall = 1). */
  maxCount?: number;
}

const MIN = 60_000;

/**
 * Balance targets (see docs/balance.md): the wood→planks→level-2 building chain should be
 * completable in ~20 min of active play (AGENT.md acceptance). Numbers are tuned for that.
 */
export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  town_hall: {
    size: { w: 3, h: 3 },
    cost: {},
    buildTimeMs: 0,
    workSlots: 0,
    inputs: {},
    outputs: {},
    requires: "none",
    storageBonus: 200,
    maxCount: 1,
  },
  house: {
    size: { w: 1, h: 1 },
    cost: { wood: 20 },
    buildTimeMs: 2 * MIN,
    workSlots: 0,
    inputs: {},
    outputs: {},
    requires: "none",
    housing: 4,
  },
  woodcutter: {
    size: { w: 1, h: 1 },
    cost: { wood: 10 },
    buildTimeMs: 2 * MIN,
    workSlots: 3,
    inputs: {},
    outputs: { wood: 60 },
    requires: "forest",
  },
  sawmill: {
    size: { w: 2, h: 1 },
    cost: { wood: 40 },
    buildTimeMs: 5 * MIN,
    workSlots: 3,
    inputs: { wood: 40 },
    outputs: { planks: 30 },
    requires: "none",
  },
  quarry: {
    size: { w: 2, h: 2 },
    cost: { wood: 30 },
    buildTimeMs: 6 * MIN,
    workSlots: 4,
    inputs: {},
    outputs: { stone: 40 },
    requires: "stone",
  },
  farm: {
    size: { w: 2, h: 2 },
    cost: { wood: 30 },
    buildTimeMs: 5 * MIN,
    workSlots: 4,
    inputs: {},
    outputs: { food: 80 },
    requires: "none",
  },
  fishing_hut: {
    size: { w: 1, h: 1 },
    cost: { wood: 20, planks: 10 },
    buildTimeMs: 4 * MIN,
    workSlots: 2,
    inputs: {},
    outputs: { food: 40 },
    requires: "water",
  },
  mine: {
    size: { w: 2, h: 2 },
    cost: { wood: 40, planks: 20 },
    buildTimeMs: 8 * MIN,
    workSlots: 4,
    inputs: {},
    outputs: { iron: 30 },
    requires: "iron",
  },
  smithy: {
    size: { w: 2, h: 1 },
    cost: { wood: 30, planks: 20, stone: 20 },
    buildTimeMs: 8 * MIN,
    workSlots: 3,
    inputs: { iron: 30 },
    outputs: { tools: 15 },
    requires: "none",
  },
  market: {
    size: { w: 2, h: 2 },
    cost: { wood: 40, planks: 30 },
    buildTimeMs: 10 * MIN,
    workSlots: 2,
    inputs: {},
    outputs: {},
    requires: "none",
  },
  // Wool is not one of the 8 tracked resources (AGENT.md §3.2), so the sheep→wool step is
  // folded in: the pasture grazes sheep (consumes food) and yields cloth's raw input as `cloth`
  // at low rate; the weavery refines food+that into finished cloth. Net chain: food → cloth.
  weavery: {
    size: { w: 2, h: 1 },
    cost: { wood: 30, planks: 20 },
    buildTimeMs: 7 * MIN,
    workSlots: 3,
    inputs: { food: 20 },
    outputs: { cloth: 20 },
    requires: "none",
  },
  pasture: {
    size: { w: 3, h: 3 },
    cost: { wood: 30 },
    buildTimeMs: 6 * MIN,
    workSlots: 2,
    inputs: { food: 10 },
    outputs: { cloth: 10 },
    requires: "none",
  },
  warehouse: {
    size: { w: 2, h: 2 },
    cost: { wood: 50, planks: 30, stone: 20 },
    buildTimeMs: 10 * MIN,
    workSlots: 0,
    inputs: {},
    outputs: {},
    requires: "none",
    storageBonus: 500,
  },
  barracks: {
    size: { w: 2, h: 2 },
    cost: { wood: 60, planks: 40, stone: 30 },
    buildTimeMs: 15 * MIN,
    workSlots: 0,
    inputs: {},
    outputs: {},
    requires: "none",
  },
};

/** Convenience: all building type keys. */
export function buildingDef(type: BuildingType): BuildingDef {
  return BUILDINGS[type];
}
