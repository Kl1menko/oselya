import {
  RESOURCES,
  UNCAPPED_RESOURCES,
  BASE_STORAGE,
  WINTER,
  MS_PER_HOUR,
  type ResourceType,
  type Season,
} from "./constants.js";
import { BUILDINGS, type BuildingType } from "./buildings.js";

/**
 * Pure economy engine (AGENT.md §4.6): the entire economy is deterministic pure functions in
 * this package, shared by the server tick and by tests. The client never imports it.
 */

export type ResourceMap = Record<ResourceType, number>;

/** A placed building in a settlement (the sim only needs these fields). */
export interface SimBuilding {
  id: string;
  type: BuildingType;
  level: number;
  /** Assigned workers (clamped to the type's workSlots elsewhere). */
  workers: number;
  /** Absolute time (ms) construction completes; <= now means operational. */
  constructionEndsAt: number;
}

/** Minimal settlement view the economy needs. */
export interface SimSettlement {
  buildings: SimBuilding[];
  resources: ResourceMap;
}

export function emptyResources(): ResourceMap {
  return Object.fromEntries(RESOURCES.map((r) => [r, 0])) as ResourceMap;
}

/** A building is operational when built and (for producers) staffed. */
export function isOperational(b: SimBuilding, now: number): boolean {
  return b.constructionEndsAt <= now;
}

/** Storage cap for a resource, given warehouse/town-hall bonuses present in the settlement. */
export function storageCap(settlement: SimSettlement, resource: ResourceType, now: number): number {
  if (UNCAPPED_RESOURCES.includes(resource)) return Number.POSITIVE_INFINITY;
  let cap = BASE_STORAGE;
  for (const b of settlement.buildings) {
    if (!isOperational(b, now)) continue;
    const def = BUILDINGS[b.type];
    if (def.storageBonus) cap += def.storageBonus * b.level;
  }
  return cap;
}

/** Total population capacity from operational houses (plus starting pop handled by caller). */
export function housingCapacity(settlement: SimSettlement, now: number): number {
  let cap = 0;
  for (const b of settlement.buildings) {
    if (!isOperational(b, now)) continue;
    const housing = BUILDINGS[b.type].housing;
    if (housing) cap += housing * b.level;
  }
  return cap;
}

/** Count operational buildings of a given type. */
function countType(settlement: SimSettlement, type: BuildingType, now: number): number {
  let n = 0;
  for (const b of settlement.buildings) {
    if (b.type === type && isOperational(b, now)) n++;
  }
  return n;
}

/**
 * Net production/consumption per HOUR at the current instant, before storage clamping.
 * Positive = produced, negative = consumed. Deterministic given (settlement, season, now).
 */
export function ratesPerHour(settlement: SimSettlement, season: Season, now: number): ResourceMap {
  const rates = emptyResources();

  for (const b of settlement.buildings) {
    if (!isOperational(b, now)) continue;
    const def = BUILDINGS[b.type];

    // Staffing fraction. Passive buildings (0 slots) run at full effect for their non-worker roles.
    const staffing = def.workSlots > 0 ? Math.min(b.workers, def.workSlots) / def.workSlots : 1;
    if (def.workSlots > 0 && staffing === 0) continue; // no workers → no production/consumption

    const scale = staffing * b.level;

    for (const [res, amt] of Object.entries(def.inputs) as [ResourceType, number][]) {
      rates[res] -= amt * scale;
    }
    for (const [res, amt] of Object.entries(def.outputs) as [ResourceType, number][]) {
      let out = amt * scale;
      // Winter: farms stop producing food (fishing huts unaffected).
      if (season === "winter" && b.type === "farm" && res === "food") {
        out *= WINTER.farmFoodMultiplier;
      }
      rates[res] += out;
    }
  }

  // Winter heating: every operational house burns extra wood.
  if (season === "winter") {
    const houses = countType(settlement, "house", now);
    rates.wood -= houses * WINTER.heatingWoodPerHousePerHour;
  }

  return rates;
}

/**
 * Advance resources by `elapsedMs` at the current rates, clamped to [0, cap]. This is the core
 * used both by the live tick (small elapsed) and by offline catch-up (large elapsed) — see
 * catchup.ts, which re-evaluates rates at each season boundary.
 *
 * Returns a NEW resource map; does not mutate input.
 */
export function applyRates(
  settlement: SimSettlement,
  rates: ResourceMap,
  elapsedMs: number,
  now: number,
): ResourceMap {
  const hours = elapsedMs / MS_PER_HOUR;
  const next = { ...settlement.resources };

  for (const res of RESOURCES) {
    const delta = rates[res] * hours;
    let value = next[res] + delta;
    if (value < 0) value = 0;
    const cap = storageCap(settlement, res, now);
    if (value > cap) value = cap;
    next[res] = value;
  }
  return next;
}

/** Can the settlement afford a cost map right now? */
export function canAfford(
  resources: ResourceMap,
  cost: Partial<Record<ResourceType, number>>,
): boolean {
  for (const [res, amt] of Object.entries(cost) as [ResourceType, number][]) {
    if (resources[res] < amt) return false;
  }
  return true;
}

/** Subtract a cost map (returns a new map). Caller must have checked canAfford. */
export function spend(
  resources: ResourceMap,
  cost: Partial<Record<ResourceType, number>>,
): ResourceMap {
  const next = { ...resources };
  for (const [res, amt] of Object.entries(cost) as [ResourceType, number][]) {
    next[res] -= amt;
  }
  return next;
}
