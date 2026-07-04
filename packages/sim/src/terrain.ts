import { GRID_SIZE } from "./constants.js";
import { mulberry32, deriveSeed } from "./prng.js";

/**
 * Procedural settlement terrain (AGENT.md §3.2): a GRID_SIZE×GRID_SIZE map generated
 * deterministically from the settlement's seed. The SERVER uses it to validate building
 * adjacency requirements; the CLIENT renders the exact same terrain from the same seed.
 * Both call this pure function — no divergence possible.
 */

export const TERRAIN_TYPES = ["grass", "forest", "stone", "iron", "water"] as const;
export type TerrainType = (typeof TERRAIN_TYPES)[number];

export interface TerrainMap {
  size: number;
  /** Row-major tiles, length size*size. */
  tiles: TerrainType[];
}

export function terrainAt(map: TerrainMap, x: number, y: number): TerrainType | null {
  if (x < 0 || y < 0 || x >= map.size || y >= map.size) return null;
  return map.tiles[y * map.size + x]!;
}

/** Does the tile at (x,y), or any orthogonally adjacent tile, match the given terrain? */
export function hasAdjacentTerrain(
  map: TerrainMap,
  x: number,
  y: number,
  w: number,
  h: number,
  terrain: TerrainType,
): boolean {
  for (let ty = y - 1; ty <= y + h; ty++) {
    for (let tx = x - 1; tx <= x + w; tx++) {
      // Only the ring around the footprint (adjacency), not diagon*inside*.
      const insideFootprint = tx >= x && tx < x + w && ty >= y && ty < y + h;
      if (insideFootprint) continue;
      if (terrainAt(map, tx, ty) === terrain) return true;
    }
  }
  return false;
}

/**
 * Value-noise-ish generation using the seeded PRNG. Deterministic: same seed → same map.
 * The center is kept clear (grass) as the spawn/build zone; resources cluster toward edges.
 */
export function generateTerrain(seed: number, size: number = GRID_SIZE): TerrainMap {
  const tiles: TerrainType[] = new Array(size * size).fill("grass");
  const center = (size - 1) / 2;
  const clearRadius = size * 0.18;

  // Scatter a handful of resource "blobs" of each kind, seeded per-kind for stability.
  const blobKinds: { kind: TerrainType; blobs: number; radius: number }[] = [
    { kind: "forest", blobs: 6, radius: size * 0.09 },
    { kind: "stone", blobs: 3, radius: size * 0.06 },
    { kind: "iron", blobs: 2, radius: size * 0.05 },
  ];

  for (const { kind, blobs, radius } of blobKinds) {
    const rng = mulberry32(deriveSeed(seed, `terrain:${kind}`));
    for (let i = 0; i < blobs; i++) {
      const cx = rng.int(0, size);
      const cy = rng.int(0, size);
      const r = radius * (0.6 + rng.next() * 0.8);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy > r * r) continue;
          // Keep the central spawn zone clear of resources.
          const dcx = x - center;
          const dcy = y - center;
          if (dcx * dcx + dcy * dcy < clearRadius * clearRadius) continue;
          // Soft edge: skip some border tiles for an organic shape.
          if (rng.next() < 0.25) continue;
          tiles[y * size + x] = kind;
        }
      }
    }
  }

  // A meandering river along one axis, offset by seed.
  const rng = mulberry32(deriveSeed(seed, "terrain:river"));
  let rx = rng.int(size * 0.1, size * 0.9);
  for (let y = 0; y < size; y++) {
    rx += rng.int(-1, 2); // -1, 0, or 1
    rx = Math.max(1, Math.min(size - 2, rx));
    for (const nx of [rx - 1, rx]) {
      const dcx = nx - center;
      const dcy = y - center;
      if (dcx * dcx + dcy * dcy < clearRadius * clearRadius) continue; // keep spawn dry
      tiles[y * size + nx] = "water";
    }
  }

  return { size, tiles };
}
