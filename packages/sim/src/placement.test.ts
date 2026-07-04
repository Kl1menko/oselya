import { describe, it, expect } from "vitest";
import { generateTerrain, terrainAt, hasAdjacentTerrain, type TerrainMap } from "./terrain.js";
import { validatePlacement, footprintTiles } from "./placement.js";

describe("generateTerrain", () => {
  it("is deterministic for a given seed", () => {
    const a = generateTerrain(12345, 32);
    const b = generateTerrain(12345, 32);
    expect(a.tiles).toEqual(b.tiles);
  });

  it("differs across seeds", () => {
    const a = generateTerrain(1, 32);
    const b = generateTerrain(2, 32);
    expect(a.tiles).not.toEqual(b.tiles);
  });

  it("has the right dimensions and only valid terrain", () => {
    const t = generateTerrain(7, 32);
    expect(t.tiles.length).toBe(32 * 32);
    for (const tile of t.tiles) {
      expect(["grass", "forest", "stone", "iron", "water"]).toContain(tile);
    }
  });

  it("keeps the central spawn zone clear of resources and water", () => {
    const size = 32;
    const t = generateTerrain(99, size);
    const c = Math.floor((size - 1) / 2);
    expect(terrainAt(t, c, c)).toBe("grass");
  });
});

describe("footprintTiles", () => {
  it("covers a building's full footprint", () => {
    // town_hall is 3x3
    const tiles = footprintTiles("town_hall", 5, 5);
    expect(tiles.length).toBe(9);
    expect(tiles).toContainEqual({ x: 5, y: 5 });
    expect(tiles).toContainEqual({ x: 7, y: 7 });
  });
});

describe("hasAdjacentTerrain", () => {
  it("detects terrain in the ring around a footprint", () => {
    const map: TerrainMap = { size: 5, tiles: new Array(25).fill("grass") };
    map.tiles[0 * 5 + 2] = "forest"; // (2,0)
    // 1x1 building at (2,1) is adjacent to the forest at (2,0).
    expect(hasAdjacentTerrain(map, 2, 1, 1, 1, "forest")).toBe(true);
    // A building far away is not.
    expect(hasAdjacentTerrain(map, 0, 4, 1, 1, "forest")).toBe(false);
  });
});

describe("validatePlacement", () => {
  const grass = (size = 10): TerrainMap => ({
    size,
    tiles: new Array(size * size).fill("grass"),
  });

  it("rejects out-of-bounds footprints", () => {
    // house is 1x1
    expect(validatePlacement("house", -1, 0, grass())).toBe("out_of_bounds");
    // town_hall 3x3 at edge
    expect(validatePlacement("town_hall", 8, 8, grass(10))).toBe("out_of_bounds");
  });

  it("rejects building on water", () => {
    const map = grass();
    map.tiles[2 * 10 + 2] = "water";
    expect(validatePlacement("house", 2, 2, map)).toBe("blocked_terrain");
  });

  it("requires forest adjacency for a woodcutter", () => {
    const map = grass();
    // No forest anywhere → missing adjacency.
    expect(validatePlacement("woodcutter", 5, 5, map)).toBe("missing_adjacency");
    // Add forest next to it → valid.
    map.tiles[4 * 10 + 5] = "forest";
    expect(validatePlacement("woodcutter", 5, 5, map)).toBeNull();
  });

  it("respects the occupancy callback", () => {
    const map = grass();
    const occupied = (x: number, y: number) => x === 5 && y === 5;
    expect(validatePlacement("house", 5, 5, map, occupied)).toBe("occupied");
    expect(validatePlacement("house", 1, 1, map, occupied)).toBeNull();
  });

  it("allows a valid house on open grass", () => {
    expect(validatePlacement("house", 3, 3, grass())).toBeNull();
  });
});
