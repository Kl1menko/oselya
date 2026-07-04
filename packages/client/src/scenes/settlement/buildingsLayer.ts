import { Container, Graphics } from "pixi.js";
import type { WireBuilding } from "@oselya/shared";
import { TILE_W, TILE_H, tileToScene, depthOf } from "./iso.js";
import { buildingColor } from "./palette.js";

// Footprint sizes must match the sim catalog (client can't import @oselya/sim). Kept in sync
// with packages/sim/src/buildings.ts; validated server-side anyway.
const FOOTPRINT: Record<string, { w: number; h: number }> = {
  town_hall: { w: 3, h: 3 },
  house: { w: 1, h: 1 },
  woodcutter: { w: 1, h: 1 },
  sawmill: { w: 2, h: 1 },
  quarry: { w: 2, h: 2 },
  farm: { w: 2, h: 2 },
  fishing_hut: { w: 1, h: 1 },
  mine: { w: 2, h: 2 },
  smithy: { w: 2, h: 1 },
  market: { w: 2, h: 2 },
  weavery: { w: 2, h: 1 },
  pasture: { w: 3, h: 3 },
  warehouse: { w: 2, h: 2 },
  barracks: { w: 2, h: 2 },
};

function footprint(type: string): { w: number; h: number } {
  return FOOTPRINT[type] ?? { w: 1, h: 1 };
}

/**
 * Buildings layer with depth (y-)sorting: sortableChildren + per-building zIndex = tx+ty so
 * nearer buildings occlude farther ones (AGENT.md §5). Construction shows a translucent shell.
 */
export class BuildingsLayer {
  readonly container = new Container();
  private readonly sprites = new Map<string, Container>();

  constructor() {
    this.container.sortableChildren = true;
  }

  /** Reconcile the current building set with the previous render (add/update/remove). */
  render(buildings: WireBuilding[], serverTime: number): void {
    const seen = new Set<string>();

    for (const b of buildings) {
      seen.add(b.id);
      let sprite = this.sprites.get(b.id);
      if (!sprite) {
        sprite = this.buildSprite(b);
        this.sprites.set(b.id, sprite);
        this.container.addChild(sprite);
      }
      this.updateSprite(sprite, b, serverTime);
    }

    // Remove demolished / gone buildings.
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.container.removeChild(sprite);
        sprite.destroy({ children: true });
        this.sprites.delete(id);
      }
    }
  }

  private buildSprite(b: WireBuilding): Container {
    const c = new Container();
    const { w, h } = footprint(b.type);
    // Anchor at the footprint's far corner so the box sits on its tiles.
    const p = tileToScene(b.x + (w - 1) / 2, b.y + (h - 1) / 2);
    c.position.set(p.x, p.y);
    c.zIndex = depthOf(b.x + w - 1, b.y + h - 1);

    const { body, roof } = buildingColor(b.type);
    const g = new Graphics();
    drawIsoBox(g, w, h, body, roof);
    c.addChild(g);
    return c;
  }

  private updateSprite(sprite: Container, b: WireBuilding, serverTime: number): void {
    const underConstruction = b.constructionEndsAt > serverTime;
    sprite.alpha = underConstruction ? 0.45 : 1;
  }
}

/** Draw a simple iso building box: base footprint diamond, walls, and a roof prism. */
function drawIsoBox(g: Graphics, w: number, h: number, body: number, roof: number): void {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  // Footprint half-extents in scene space.
  const ex = ((w + h) / 2) * hw;
  const ey = ((w + h) / 2) * hh;
  const wallH = 22 + (w + h) * 4;

  // Base diamond (top of ground footprint), centered at origin.
  const topY = -ey;
  const botY = ey;

  // Left wall.
  g.moveTo(-ex, 0)
    .lineTo(0, botY)
    .lineTo(0, botY - wallH)
    .lineTo(-ex, -wallH)
    .closePath()
    .fill({ color: shade(body, 0.82) });
  // Right wall.
  g.moveTo(ex, 0)
    .lineTo(0, botY)
    .lineTo(0, botY - wallH)
    .lineTo(ex, -wallH)
    .closePath()
    .fill({ color: shade(body, 0.68) });

  // Roof diamond (top of walls).
  g.moveTo(0, topY - wallH)
    .lineTo(ex, -wallH)
    .lineTo(0, botY - wallH)
    .lineTo(-ex, -wallH)
    .closePath()
    .fill({ color: roof });
  // Roof ridge highlight.
  g.moveTo(0, topY - wallH)
    .lineTo(ex, -wallH)
    .lineTo(0, -wallH - 2)
    .closePath()
    .fill({ color: shade(roof, 1.15) });
}

/** Multiply an RGB hex color by a factor (clamped) for cheap shading. */
function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}
