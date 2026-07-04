import { BUILDINGS, type BuildingType, type Adjacency } from "./buildings.js";
import { hasAdjacentTerrain, type TerrainMap, type TerrainType } from "./terrain.js";

/**
 * Placement validation (AGENT.md §4.4: geometry + adjacency). Pure so the client can render a
 * red/green preview with the exact same rules the server enforces. Overlap with existing
 * buildings is checked by the server against its own occupancy set (see `footprintTiles`).
 */

export type PlacementError = "out_of_bounds" | "missing_adjacency" | "blocked_terrain" | "occupied";

/** Map a building's adjacency requirement to the terrain it must touch. */
const ADJACENCY_TERRAIN: Record<Exclude<Adjacency, "none">, TerrainType> = {
  forest: "forest",
  stone: "stone",
  iron: "iron",
  water: "water",
};

/** All tiles a building of this type would occupy at (x,y). */
export function footprintTiles(
  type: BuildingType,
  x: number,
  y: number,
): { x: number; y: number }[] {
  const { w, h } = BUILDINGS[type].size;
  const tiles: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push({ x: x + dx, y: y + dy });
    }
  }
  return tiles;
}

/**
 * Validate footprint bounds, buildable terrain, and adjacency. Returns null if valid, else the
 * first violation. `isOccupied` lets the caller inject its own overlap check (server state).
 */
export function validatePlacement(
  type: BuildingType,
  x: number,
  y: number,
  terrain: TerrainMap,
  isOccupied?: (x: number, y: number) => boolean,
): PlacementError | null {
  const def = BUILDINGS[type];
  const { w, h } = def.size;

  // Bounds.
  if (x < 0 || y < 0 || x + w > terrain.size || y + h > terrain.size) {
    return "out_of_bounds";
  }

  // The footprint itself must sit on buildable ground (not water/resource tiles) and be free.
  for (const tile of footprintTiles(type, x, y)) {
    const t = terrain.tiles[tile.y * terrain.size + tile.x];
    if (t === "water") return "blocked_terrain";
    if (isOccupied?.(tile.x, tile.y)) return "occupied";
  }

  // Adjacency requirement (woodcutter→forest, quarry→stone, mine→iron, fishing_hut→water).
  if (def.requires !== "none") {
    const terrainNeeded = ADJACENCY_TERRAIN[def.requires];
    if (!hasAdjacentTerrain(terrain, x, y, w, h, terrainNeeded)) {
      return "missing_adjacency";
    }
  }

  return null;
}
