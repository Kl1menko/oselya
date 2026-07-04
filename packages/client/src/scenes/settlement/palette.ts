/**
 * Terrain/building colors. Natural, warm, muted (AGENT.md §5 — Manor Lords / Anno / Northgard
 * references, NOT cartoon). Season tints are applied in Slice 5; for now every season uses the
 * base palette so the structure is ready.
 */

export type TerrainCode = "g" | "f" | "s" | "i" | "w";

export interface TerrainStyle {
  top: number;
  /** Slightly darker side for the tile's faux-thickness edge. */
  side: number;
}

export const TERRAIN_STYLE: Record<TerrainCode, TerrainStyle> = {
  g: { top: 0x6b8e4e, side: 0x557040 }, // grass
  f: { top: 0x3f5f37, side: 0x30482a }, // forest floor
  s: { top: 0x8a8072, side: 0x6d6459 }, // stone
  i: { top: 0x7d7468, side: 0x5c5449 }, // iron-rich rock
  w: { top: 0x3d6b82, side: 0x2f5566 }, // water
};

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
