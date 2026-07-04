import { Container } from "pixi.js";
import type { WireSettlement, WireTerrain } from "@oselya/shared";
import { Villager } from "./villager.js";
import { WalkGrid, findPath, type TileXY } from "./pathfinding.js";
import { CLIENT_BUILDINGS } from "./buildingCatalog.js";

/**
 * Presentation-only villager simulation (AGENT.md §4.2). Villagers are derived entirely from the
 * authoritative snapshot — one per assigned worker across staffed buildings, spawned at a house,
 * walking to their workplace and back on a day cycle. The server never sees them.
 *
 * Reconciliation: on each settlement update we recompute the desired (home, work) assignments and
 * add/remove villagers to match, reusing existing ones so paths aren't reset every tick.
 */

const VILLAGER_TINTS = [0xb2603f, 0x9c7b4e, 0x7f8a55, 0xa85f6a, 0x6f7f9a, 0x8a6f4a];

/** In-game day cycle: villagers go to work in the morning, home in the evening. */
const DAY_CYCLE_MS = 20 * 60 * 1000;

interface Assignment {
  home: TileXY;
  work: TileXY;
  buildingId: string;
}

export class VillagerManager {
  readonly container = new Container();
  private grid: WalkGrid | null = null;
  private terrain: WireTerrain | null = null;
  private villagers: Villager[] = [];
  private lastAssignmentKey = "";

  constructor() {
    this.container.sortableChildren = true;
  }

  /** Rebuild walkability + re-derive assignments when the settlement changes. */
  sync(settlement: WireSettlement, terrain: WireTerrain, now: number): void {
    this.terrain = terrain;
    this.grid = new WalkGrid(terrain, settlement.buildings);

    const assignments = this.deriveAssignments(settlement, now);
    const key = assignments.map((a) => `${a.buildingId}:${a.work.x},${a.work.y}`).join("|");
    if (key === this.lastAssignmentKey) return; // nothing changed
    this.lastAssignmentKey = key;

    this.reconcile(assignments);
  }

  /**
   * One villager per assigned worker in each operational, staffed building. Their "home" is the
   * nearest house (or the town hall if none), their "work" is a walkable tile next to the building.
   */
  private deriveAssignments(settlement: WireSettlement, now: number): Assignment[] {
    if (!this.grid) return [];
    const houses = settlement.buildings.filter(
      (b) => b.type === "house" && b.constructionEndsAt <= now,
    );
    const townHall = settlement.buildings.find((b) => b.type === "town_hall");
    const homeSpots: TileXY[] = houses.map((h) => ({ x: h.x, y: h.y }));
    if (homeSpots.length === 0 && townHall) homeSpots.push({ x: townHall.x, y: townHall.y });
    if (homeSpots.length === 0) return [];

    const assignments: Assignment[] = [];
    let homeIdx = 0;
    for (const b of settlement.buildings) {
      if (b.constructionEndsAt > now) continue;
      const def = CLIENT_BUILDINGS[b.type];
      if (!def || def.workSlots === 0 || b.workers === 0) continue;

      const workSpot = this.grid.nearestWalkable(b.x, b.y + def.h);
      if (!workSpot) continue;

      for (let w = 0; w < b.workers; w++) {
        const rawHome = homeSpots[homeIdx % homeSpots.length]!;
        homeIdx++;
        const home = this.grid.nearestWalkable(rawHome.x, rawHome.y + 1) ?? rawHome;
        assignments.push({ home, work: workSpot, buildingId: b.id });
      }
    }
    return assignments;
  }

  private reconcile(assignments: Assignment[]): void {
    // Grow / shrink the villager pool to match the assignment count.
    while (this.villagers.length < assignments.length) {
      const a = assignments[this.villagers.length]!;
      const tint = VILLAGER_TINTS[this.villagers.length % VILLAGER_TINTS.length]!;
      const v = new Villager(a.home, tint);
      this.villagers.push(v);
      this.container.addChild(v.container);
    }
    while (this.villagers.length > assignments.length) {
      const v = this.villagers.pop()!;
      this.container.removeChild(v.container);
      v.destroy();
    }

    // Assign home/work; leave any in-flight movement alone (it'll be retargeted next leg).
    assignments.forEach((a, i) => {
      const v = this.villagers[i]!;
      v.homeTile = a.home;
      v.workTile = a.work;
    });
  }

  /** Dev override to force a day phase, for testing the walk cycle without waiting 20 min. */
  debugForcePhase: number | null = null;

  /** Number of active villagers (for debug/telemetry). */
  get count(): number {
    return this.villagers.length;
  }

  /** Advance villagers each frame: follow current path, and flip legs on the day cycle. */
  update(dtSec: number, now: number): void {
    if (!this.grid) return;
    // Day phase: first ~55% of the cycle at work, remainder heading home / resting.
    const phase = this.debugForcePhase ?? (now % DAY_CYCLE_MS) / DAY_CYCLE_MS;
    const shouldBeAtWork = phase < 0.55;

    for (const v of this.villagers) {
      if (!v.workTile) continue;

      // Retarget when the villager is idle and on the wrong side of the day cycle.
      if (!v.isMoving) {
        const at = v.currentTile();
        const wantWork = shouldBeAtWork;
        const atWork = at.x === v.workTile.x && at.y === v.workTile.y;
        const atHome = at.x === v.homeTile.x && at.y === v.homeTile.y;
        if (wantWork && !atWork) {
          const path = findPath(this.grid, at, v.workTile);
          if (path) v.setPath(path, "toWork", false);
        } else if (!wantWork && !atHome) {
          const path = findPath(this.grid, at, v.homeTile);
          // Carry a resource home on the evening leg (visual only).
          if (path) v.setPath(path, "toHome", true);
        }
      }

      v.update(dtSec);
    }
  }

  clear(): void {
    for (const v of this.villagers) {
      this.container.removeChild(v.container);
      v.destroy();
    }
    this.villagers = [];
    this.lastAssignmentKey = "";
  }
}
