import { Graphics } from "pixi.js";
import type { WireTerrain } from "@oselya/shared";
import { TILE_W, TILE_H, tileToScene } from "./iso.js";
import { TERRAIN_STYLE, type TerrainCode } from "./palette.js";

/**
 * Static terrain layer: all 64×64 tiles drawn into a single Graphics (one object, cheap to
 * render). Redrawn only when the terrain or season palette changes, never per frame.
 */
export class TerrainLayer {
  readonly graphics = new Graphics();

  render(terrain: WireTerrain): void {
    const g = this.graphics;
    g.clear();
    const { size, tiles } = terrain;

    // Draw back-to-front (row-major already gives increasing depth tx+ty).
    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const code = tiles[ty * size + tx] as TerrainCode;
        const style = TERRAIN_STYLE[code] ?? TERRAIN_STYLE.g;
        const p = tileToScene(tx, ty);
        this.drawTile(g, p.x, p.y, style.top, style.side);
      }
    }
  }

  private drawTile(g: Graphics, cx: number, cy: number, top: number, side: number): void {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const depth = 6; // faux thickness

    // Left & right side faces (subtle 3D lip) drawn first, then the top diamond.
    g.moveTo(cx - hw, cy)
      .lineTo(cx, cy + hh)
      .lineTo(cx, cy + hh + depth)
      .lineTo(cx - hw, cy + depth)
      .closePath()
      .fill({ color: side });
    g.moveTo(cx + hw, cy)
      .lineTo(cx, cy + hh)
      .lineTo(cx, cy + hh + depth)
      .lineTo(cx + hw, cy + depth)
      .closePath()
      .fill({ color: side });

    // Top diamond.
    g.moveTo(cx, cy - hh)
      .lineTo(cx + hw, cy)
      .lineTo(cx, cy + hh)
      .lineTo(cx - hw, cy)
      .closePath()
      .fill({ color: top });
  }
}
