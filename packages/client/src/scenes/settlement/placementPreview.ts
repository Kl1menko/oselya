import type { WireTerrain, WireBuilding } from "@oselya/shared";
import { CLIENT_BUILDINGS, type Adjacency } from "./buildingCatalog.js";

/**
 * Client-side placement validity for the red/green preview. Mirrors sim/placement.ts rules; the
 * server is still authoritative. Returns true if placement looks valid.
 */

const ADJ_TERRAIN: Record<Exclude<Adjacency, "none">, string> = {
  forest: "f",
  stone: "s",
  iron: "i",
  water: "w",
};

function tileAt(terrain: WireTerrain, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= terrain.size || y >= terrain.size) return null;
  return terrain.tiles[y * terrain.size + x] ?? null;
}

/** Build an occupancy set from the current buildings' footprints. */
export function occupancySet(buildings: WireBuilding[]): Set<number> {
  const occ = new Set<number>();
  for (const b of buildings) {
    const def = CLIENT_BUILDINGS[b.type];
    if (!def) continue;
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        occ.add((b.y + dy) * 10000 + (b.x + dx));
      }
    }
  }
  return occ;
}

export function isPlacementValid(
  type: string,
  x: number,
  y: number,
  terrain: WireTerrain,
  occupied: Set<number>,
): boolean {
  const def = CLIENT_BUILDINGS[type];
  if (!def) return false;
  const { w, h } = def;

  if (x < 0 || y < 0 || x + w > terrain.size || y + h > terrain.size) return false;

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tileAt(terrain, tx, ty) === "w") return false; // can't build on water
      if (occupied.has(ty * 10000 + tx)) return false;
    }
  }

  if (def.requires !== "none") {
    const need = ADJ_TERRAIN[def.requires];
    let found = false;
    for (let ty = y - 1; ty <= y + h && !found; ty++) {
      for (let tx = x - 1; tx <= x + w && !found; tx++) {
        const inside = tx >= x && tx < x + w && ty >= y && ty < y + h;
        if (inside) continue;
        if (tileAt(terrain, tx, ty) === need) found = true;
      }
    }
    if (!found) return false;
  }

  return true;
}
