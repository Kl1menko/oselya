import { eq, sql } from "drizzle-orm";
import {
  RESOURCES,
  emptyResources,
  catchUp,
  type ResourceMap,
  type ResourceType,
} from "@oselya/sim";
import { db, schema } from "./db.js";
import { SettlementState, type ServerBuilding } from "../world/settlementState.js";
import { logger } from "../logger.js";

export interface LoadResult {
  settlement: SettlementState;
  /** Whether this was freshly created (vs loaded from DB). */
  created: boolean;
  /** ms of offline time simulated by catch-up on load (0 for fresh). */
  offlineMs: number;
  /** Buildings that finished construction during the offline window. */
  completedBuildings: string[];
}

/** Starting resources for a brand-new settlement (mirrors the pre-persistence registry). */
function startingResources(): ResourceMap {
  return { ...emptyResources(), wood: 120, planks: 40, stone: 40, food: 100 };
}

/**
 * Load a player's settlement from Postgres, applying offline catch-up (AGENT.md §4.2: offline
 * progress is computed by formula from `last_simulated_at` to now). Creates a fresh settlement on
 * first login. Returns the live in-memory state plus what happened while away.
 */
export async function loadOrCreateSettlement(
  playerId: string,
  gridSeed: number,
  worldSeasonEpoch: number,
  now: number,
): Promise<LoadResult> {
  const rows = await db
    .select()
    .from(schema.settlements)
    .where(eq(schema.settlements.playerId, playerId))
    .limit(1);
  const row = rows[0];

  if (!row) {
    const state = new SettlementState({
      id: crypto.randomUUID(),
      playerId,
      gridSeed,
      resources: startingResources(),
    });
    await insertSettlement(state, now);
    return { settlement: state, created: true, offlineMs: 0, completedBuildings: [] };
  }

  // Load buildings + resources.
  const [buildingRows, resourceRows] = await Promise.all([
    db.select().from(schema.buildings).where(eq(schema.buildings.settlementId, row.id)),
    db.select().from(schema.resources).where(eq(schema.resources.settlementId, row.id)),
  ]);

  const buildings: ServerBuilding[] = buildingRows.map((b) => ({
    id: b.id,
    type: b.type as ServerBuilding["type"],
    level: b.level,
    workers: b.workers,
    x: b.x,
    y: b.y,
    constructionEndsAt: b.constructionEndsAt ? b.constructionEndsAt.getTime() : 0,
  }));

  const resourceMap = emptyResources();
  for (const r of resourceRows) {
    if ((RESOURCES as readonly string[]).includes(r.resourceType)) {
      resourceMap[r.resourceType as ResourceType] = r.amount;
    }
  }

  const state = new SettlementState({
    id: row.id,
    playerId,
    gridSeed: row.gridSeed,
    resources: resourceMap,
    buildings,
    townHallLevel: row.townHallLevel,
    population: row.population,
    happiness: row.happiness,
  });

  // Offline catch-up: advance from last_simulated_at to now by formula.
  const lastSim = row.lastSimulatedAt.getTime();
  const offlineMs = Math.max(0, now - lastSim);
  let completedBuildings: string[] = [];
  if (offlineMs > 0) {
    const result = catchUp(state.toSim(), lastSim, now, worldSeasonEpoch);
    state.resources = result.settlement.resources;
    completedBuildings = result.completedBuildings;
  }

  logger.info({ playerId, settlementId: row.id, offlineMs }, "loaded settlement");
  return { settlement: state, created: false, offlineMs, completedBuildings };
}

async function insertSettlement(state: SettlementState, now: number): Promise<void> {
  await db.insert(schema.settlements).values({
    id: state.id,
    playerId: state.playerId,
    gridSeed: state.gridSeed,
    townHallLevel: state.townHallLevel,
    population: state.population,
    happiness: state.happiness,
    lastSimulatedAt: new Date(now),
  });
  await persistResources(state);
}

async function persistResources(state: SettlementState): Promise<void> {
  const values = RESOURCES.map((r) => ({
    settlementId: state.id,
    resourceType: r,
    amount: state.resources[r],
  }));
  await db
    .insert(schema.resources)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.resources.settlementId, schema.resources.resourceType],
      set: { amount: sql`excluded.amount` },
    });
}

/**
 * Persist the full current state of a settlement (buildings + resources + meta). Phase 1 does a
 * simple replace of buildings; field-level diffing is a later optimization. Called by the snapshot
 * writer (every ~30s) and on important events.
 */
export async function saveSettlement(state: SettlementState, now: number): Promise<void> {
  await db
    .update(schema.settlements)
    .set({
      townHallLevel: state.townHallLevel,
      population: state.population,
      happiness: state.happiness,
      lastSimulatedAt: new Date(now),
    })
    .where(eq(schema.settlements.id, state.id));

  await persistResources(state);

  // Replace buildings wholesale (small counts in Phase 1).
  await db.delete(schema.buildings).where(eq(schema.buildings.settlementId, state.id));
  if (state.buildings.length > 0) {
    await db.insert(schema.buildings).values(
      state.buildings.map((b) => ({
        id: b.id,
        settlementId: state.id,
        type: b.type,
        level: b.level,
        x: b.x,
        y: b.y,
        workers: b.workers,
        constructionEndsAt: b.constructionEndsAt ? new Date(b.constructionEndsAt) : null,
      })),
    );
  }
}
