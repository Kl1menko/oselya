import type { WireTerrain, WireBuilding } from "@oselya/shared";
import { CLIENT_BUILDINGS } from "./buildingCatalog.js";

/**
 * A* pathfinding over the settlement tile grid for villager movement (AGENT.md §7 Phase 1).
 * Walkable = not water and not covered by a building footprint. Paths are cached by the caller.
 * This is presentation-only (villagers are a visual layer), so it never touches server state.
 */

export interface TileXY {
  x: number;
  y: number;
}

/** Precomputed walkability grid; rebuilt when terrain or buildings change. */
export class WalkGrid {
  readonly size: number;
  private readonly blocked: Uint8Array;

  constructor(terrain: WireTerrain, buildings: WireBuilding[]) {
    this.size = terrain.size;
    this.blocked = new Uint8Array(this.size * this.size);
    for (let i = 0; i < this.blocked.length; i++) {
      if (terrain.tiles[i] === "w") this.blocked[i] = 1;
    }
    for (const b of buildings) {
      const def = CLIENT_BUILDINGS[b.type];
      if (!def) continue;
      for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
          const idx = (b.y + dy) * this.size + (b.x + dx);
          if (idx >= 0 && idx < this.blocked.length) this.blocked[idx] = 1;
        }
      }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.blocked[y * this.size + x] === 0;
  }

  /** Nearest walkable tile to (x,y) within a small radius (villagers stand next to buildings). */
  nearestWalkable(x: number, y: number, radius = 3): TileXY | null {
    if (this.isWalkable(x, y)) return { x, y };
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // ring only
          if (this.isWalkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  }
}

const NEIGHBORS: TileXY[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** A* on the 4-connected grid. Returns a list of tiles start→goal (inclusive), or null. */
export function findPath(grid: WalkGrid, start: TileXY, goal: TileXY): TileXY[] | null {
  if (!grid.isWalkable(goal.x, goal.y) || !grid.isWalkable(start.x, start.y)) return null;
  const size = grid.size;
  const key = (x: number, y: number) => y * size + x;

  const open = new MinHeap();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const startK = key(start.x, start.y);
  gScore.set(startK, 0);
  open.push(startK, heuristic(start, goal));

  while (open.size > 0) {
    const currentK = open.pop()!;
    const cx = currentK % size;
    const cy = Math.floor(currentK / size);
    if (cx === goal.x && cy === goal.y) {
      return reconstruct(cameFrom, currentK, size);
    }
    const baseG = gScore.get(currentK)!;
    for (const n of NEIGHBORS) {
      const nx = cx + n.x;
      const ny = cy + n.y;
      if (!grid.isWalkable(nx, ny)) continue;
      const nk = key(nx, ny);
      const tentative = baseG + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, currentK);
        gScore.set(nk, tentative);
        open.push(nk, tentative + heuristic({ x: nx, y: ny }, goal));
      }
    }
  }
  return null;
}

function heuristic(a: TileXY, b: TileXY): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstruct(cameFrom: Map<number, number>, endK: number, size: number): TileXY[] {
  const path: TileXY[] = [];
  let k: number | undefined = endK;
  while (k !== undefined) {
    path.push({ x: k % size, y: Math.floor(k / size) });
    k = cameFrom.get(k);
  }
  return path.reverse();
}

/** Tiny binary min-heap keyed by priority; stores tile keys. */
class MinHeap {
  private readonly keys: number[] = [];
  private readonly prio: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, priority: number): void {
    this.keys.push(key);
    this.prio.push(priority);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent]! <= this.prio[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number | undefined {
    if (this.keys.length === 0) return undefined;
    const top = this.keys[0]!;
    const lastKey = this.keys.pop()!;
    const lastPrio = this.prio.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.prio[0] = lastPrio;
      let i = 0;
      const n = this.keys.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.prio[l]! < this.prio[smallest]!) smallest = l;
        if (r < n && this.prio[r]! < this.prio[smallest]!) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(i: number, j: number): void {
    [this.keys[i], this.keys[j]] = [this.keys[j]!, this.keys[i]!];
    [this.prio[i], this.prio[j]] = [this.prio[j]!, this.prio[i]!];
  }
}
