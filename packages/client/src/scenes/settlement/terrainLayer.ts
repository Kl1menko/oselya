import { Graphics } from "pixi.js";
import type { WireTerrain } from "@oselya/shared";
import { TILE_W, TILE_H, tileToScene } from "./iso.js";
import { seasonTerrainStyle, type TerrainCode, type Season } from "./palette.js";

/**
 * Static terrain layer: all 64×64 tiles drawn into a single Graphics (one object, cheap to
 * render). Redrawn only when the terrain or the season palette changes, never per frame.
 */
export class TerrainLayer {
  readonly graphics = new Graphics();
  private terrain: WireTerrain | null = null;
  private season: Season = "spring";

  render(terrain: WireTerrain, season: Season): void {
    // Skip redraw if nothing that affects the visuals changed.
    if (this.terrain === terrain && this.season === season) return;
    this.terrain = terrain;
    this.season = season;

    const g = this.graphics;
    g.clear();
    const { size, tiles } = terrain;

    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        const code = tiles[ty * size + tx] as TerrainCode;
        const style = seasonTerrainStyle(code, season);
        const p = tileToScene(tx, ty);
        this.drawTile(g, p.x, p.y, style.top, style.side);
      }
    }
  }

  private drawTile(g: Graphics, cx: number, cy: number, top: number, side: number): void {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const depth = 6; // faux thickness

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

    g.moveTo(cx, cy - hh)
      .lineTo(cx + hw, cy)
      .lineTo(cx, cy + hh)
      .lineTo(cx - hw, cy)
      .closePath()
      .fill({ color: top });
  }
}
