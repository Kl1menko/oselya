import { randomUUID } from "node:crypto";
import {
  BUILDINGS,
  BUILDING_TYPES,
  GRID_SIZE,
  STARTING_POPULATION,
  emptyResources,
  generateTerrain,
  validatePlacement,
  footprintTiles,
  housingCapacity,
  canAfford,
  spend,
  seasonAt,
  type BuildingType,
  type ResourceMap,
  type SimBuilding,
  type SimSettlement,
  type TerrainMap,
  type PlacementError,
} from "@oselya/sim";
import type { WireBuilding, WireSettlement } from "@oselya/shared";

export interface ServerBuilding extends SimBuilding {
  x: number;
  y: number;
}

export type CommandError =
  | PlacementError
  | "unknown_building_type"
  | "cannot_afford"
  | "max_count_reached"
  | "not_found"
  | "invalid_workers";

function isBuildingType(t: string): t is BuildingType {
  return (BUILDING_TYPES as readonly string[]).includes(t);
}

/**
 * Authoritative in-memory settlement (AGENT.md §4.1: server holds live state, Postgres persists
 * snapshots). All mutations go through validated command methods; the tick reads it via
 * `toSim()`. This is the single source of truth the client only mirrors.
 */
export class SettlementState {
  readonly id: string;
  readonly playerId: string;
  readonly gridSeed: number;
  readonly terrain: TerrainMap;

  townHallLevel = 1;
  population = STARTING_POPULATION;
  happiness = 100;
  resources: ResourceMap;
  buildings: ServerBuilding[] = [];

  /** Occupancy grid for O(1) overlap checks. */
  private readonly occupied: Uint8Array;

  constructor(params: {
    id: string;
    playerId: string;
    gridSeed: number;
    resources?: ResourceMap;
    buildings?: ServerBuilding[];
    townHallLevel?: number;
    population?: number;
    happiness?: number;
  }) {
    this.id = params.id;
    this.playerId = params.playerId;
    this.gridSeed = params.gridSeed;
    this.terrain = generateTerrain(params.gridSeed, GRID_SIZE);
    this.resources = params.resources ?? emptyResources();
    this.occupied = new Uint8Array(GRID_SIZE * GRID_SIZE);
    if (params.townHallLevel) this.townHallLevel = params.townHallLevel;
    if (params.population !== undefined) this.population = params.population;
    if (params.happiness !== undefined) this.happiness = params.happiness;
    if (params.buildings) {
      for (const b of params.buildings) this.addBuildingInternal(b);
    }
  }

  private markFootprint(type: BuildingType, x: number, y: number, value: number): void {
    for (const t of footprintTiles(type, x, y)) {
      this.occupied[t.y * GRID_SIZE + t.x] = value;
    }
  }

  private isOccupied = (x: number, y: number): boolean => this.occupied[y * GRID_SIZE + x] === 1;

  private addBuildingInternal(b: ServerBuilding): void {
    this.buildings.push(b);
    this.markFootprint(b.type, b.x, b.y, 1);
  }

  /** Place a new building. Validates type, geometry/adjacency/overlap, then cost. */
  placeBuilding(
    typeStr: string,
    x: number,
    y: number,
    now: number,
  ): { building: ServerBuilding } | { error: CommandError } {
    if (!isBuildingType(typeStr)) return { error: "unknown_building_type" };
    const type = typeStr;
    const def = BUILDINGS[type];

    if (def.maxCount !== undefined) {
      const count = this.buildings.filter((b) => b.type === type).length;
      if (count >= def.maxCount) return { error: "max_count_reached" };
    }

    const placementError = validatePlacement(type, x, y, this.terrain, this.isOccupied);
    if (placementError) return { error: placementError };

    if (!canAfford(this.resources, def.cost)) return { error: "cannot_afford" };
    this.resources = spend(this.resources, def.cost);

    const building: ServerBuilding = {
      id: randomUUID(),
      type,
      level: 1,
      workers: 0,
      x,
      y,
      constructionEndsAt: now + def.buildTimeMs,
    };
    this.addBuildingInternal(building);
    return { building };
  }

  demolishBuilding(buildingId: string): { ok: true } | { error: CommandError } {
    const idx = this.buildings.findIndex((b) => b.id === buildingId);
    if (idx === -1) return { error: "not_found" };
    const b = this.buildings[idx]!;
    this.markFootprint(b.type, b.x, b.y, 0);
    this.buildings.splice(idx, 1);
    return { ok: true };
  }

  assignWorkers(buildingId: string, workers: number): { ok: true } | { error: CommandError } {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return { error: "not_found" };
    const slots = BUILDINGS[b.type].workSlots;
    if (workers < 0 || workers > slots) return { error: "invalid_workers" };
    b.workers = workers;
    return { ok: true };
  }

  /** Population cap = starting pop + housing from operational houses. */
  populationCap(now: number): number {
    return STARTING_POPULATION + housingCapacity(this.toSim(), now);
  }

  /** View for the pure sim (economy/catch-up). */
  toSim(): SimSettlement {
    return { buildings: this.buildings, resources: this.resources };
  }

  season(now: number, seasonEpoch: number) {
    return seasonAt(now - seasonEpoch);
  }

  toWire(now: number): WireSettlement {
    return {
      gridSeed: this.gridSeed,
      townHallLevel: this.townHallLevel,
      population: this.population,
      populationCap: this.populationCap(now),
      happiness: this.happiness,
      resources: { ...this.resources },
      buildings: this.buildings.map((b): WireBuilding => ({
        id: b.id,
        type: b.type,
        level: b.level,
        x: b.x,
        y: b.y,
        workers: b.workers,
        constructionEndsAt: b.constructionEndsAt,
      })),
    };
  }
}
