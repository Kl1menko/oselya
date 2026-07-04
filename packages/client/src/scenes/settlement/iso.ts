/**
 * Isometric 2:1 projection (AGENT.md §5): tile 64×32 px. Tile (tx,ty) maps to a screen point at
 * the tile's TOP corner of its diamond. The scene container is centered on screen and moved by the
 * camera, so these are scene-local coordinates.
 */

export const TILE_W = 64;
export const TILE_H = 32;

export interface Point {
  x: number;
  y: number;
}

/** Tile grid coords → scene pixel coords (center of the tile diamond). */
export function tileToScene(tx: number, ty: number): Point {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2),
  };
}

/** Scene pixel coords → fractional tile coords (inverse of tileToScene). */
export function sceneToTile(sx: number, sy: number): Point {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return {
    x: (a + b) / 2,
    y: (b - a) / 2,
  };
}

/** Depth key for y-sorting: larger = drawn later (in front). */
export function depthOf(tx: number, ty: number): number {
  return tx + ty;
}
