/**
 * Terrain/building colors. Natural, warm, muted (AGENT.md §5 — Manor Lords / Anno / Northgard
 * references, NOT cartoon). Terrain is re-tinted per season (§3.2: seasonal palette is mandatory),
 * so winter reads clearly differently from summer.
 */

export type TerrainCode = "g" | "f" | "s" | "i" | "w";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface TerrainStyle {
  top: number;
  /** Slightly darker side for the tile's faux-thickness edge. */
  side: number;
}

/** Base (summer-ish) palette; other seasons transform it — see seasonTerrainStyle. */
export const TERRAIN_STYLE: Record<TerrainCode, TerrainStyle> = {
  g: { top: 0x6b8e4e, side: 0x557040 }, // grass
  f: { top: 0x3f5f37, side: 0x30482a }, // forest floor
  s: { top: 0x8a8072, side: 0x6d6459 }, // stone
  i: { top: 0x7d7468, side: 0x5c5449 }, // iron-rich rock
  w: { top: 0x3d6b82, side: 0x2f5566 }, // water
};

/** Per-season, per-terrain color overrides. Absent entries fall back to the base palette. */
const SEASON_TERRAIN: Partial<Record<Season, Partial<Record<TerrainCode, TerrainStyle>>>> = {
  spring: {
    g: { top: 0x779a52, side: 0x5f7d42 },
    f: { top: 0x466a3a, side: 0x35502c },
  },
  autumn: {
    g: { top: 0x8a8a44, side: 0x6f6f38 }, // golden grass
    f: { top: 0x7a5a2e, side: 0x5e4423 }, // turning leaves
  },
  winter: {
    g: { top: 0xd7dde2, side: 0xb4bcc4 }, // snow
    f: { top: 0x9fb0ad, side: 0x7f908d }, // frosted forest
    s: { top: 0xa6a29a, side: 0x847f77 },
    i: { top: 0x999288, side: 0x726c62 },
    w: { top: 0x8fb2c4, side: 0x6f93a6 }, // icy water
  },
};

/** Terrain style for a tile in a given season (winter snow, autumn gold, etc.). */
export function seasonTerrainStyle(code: TerrainCode, season: Season): TerrainStyle {
  return SEASON_TERRAIN[season]?.[code] ?? TERRAIN_STYLE[code] ?? TERRAIN_STYLE.g;
}

/** Building body / roof colors by type (placeholder procedural sprites). */
export const BUILDING_COLOR: Record<string, { body: number; roof: number }> = {
  town_hall: { body: 0xcaa46a, roof: 0x8a3b2e },
  house: { body: 0xc9a878, roof: 0x9c5a3c },
  woodcutter: { body: 0xa9895f, roof: 0x6f4a2f },
  sawmill: { body: 0xa9895f, roof: 0x7a5233 },
  quarry: { body: 0x9b9182, roof: 0x6d6459 },
  farm: { body: 0xc2b280, roof: 0x8f7a3e },
  fishing_hut: { body: 0xb09a6a, roof: 0x5b7a86 },
  mine: { body: 0x8a8175, roof: 0x4d463c },
  smithy: { body: 0x8f8478, roof: 0x55483c },
  market: { body: 0xcaa46a, roof: 0xa8683a },
  weavery: { body: 0xc4a986, roof: 0x8d5b7a },
  pasture: { body: 0x8fa96a, roof: 0x6f8a4c },
  warehouse: { body: 0xb59a70, roof: 0x6f5a3c },
  barracks: { body: 0x9a8b74, roof: 0x5a4a3a },
};

export function buildingColor(type: string): { body: number; roof: number } {
  return BUILDING_COLOR[type] ?? { body: 0xb0a080, roof: 0x70604a };
}
