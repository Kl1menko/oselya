import { Container, Graphics } from "pixi.js";
import type { WireBuilding } from "@oselya/shared";
import { tileToScene } from "./iso.js";
import { CLIENT_BUILDINGS } from "./buildingCatalog.js";

/**
 * Construction progress bars floating above buildings still being built (AGENT.md §7 Phase 1).
 * Redrawn each frame because progress is time-based; cheap (few in-progress buildings at once).
 * `constructionEndsAt` is absolute server ms; client clock ≈ server clock so we estimate locally.
 */
export class ProgressLayer {
  readonly container = new Container();
  private readonly gfx = new Graphics();
  private buildings: WireBuilding[] = [];
  /** Build start times are unknown from the wire, so we track first-seen time per building. */
  private readonly firstSeen = new Map<string, number>();

  constructor() {
    this.container.addChild(this.gfx);
    this.container.zIndex = 100000; // always on top of buildings
  }

  setBuildings(buildings: WireBuilding[]): void {
    this.buildings = buildings;
    const now = Date.now();
    for (const b of buildings) {
      if (b.constructionEndsAt > now && !this.firstSeen.has(b.id)) {
        this.firstSeen.set(b.id, now);
      }
    }
  }

  /** Called each frame. */
  update(): void {
    const now = Date.now();
    const g = this.gfx;
    g.clear();

    for (const b of this.buildings) {
      if (b.constructionEndsAt <= now) continue;
      const def = CLIENT_BUILDINGS[b.type];
      if (!def) continue;

      const start = this.firstSeen.get(b.id) ?? now;
      const total = b.constructionEndsAt - start;
      const progress = total > 0 ? Math.min(1, (now - start) / total) : 0;

      const center = tileToScene(b.x + (def.w - 1) / 2, b.y + (def.h - 1) / 2);
      const barW = 40;
      const barH = 6;
      const bx = center.x - barW / 2;
      const by = center.y - 46 - (def.w + def.h) * 4;

      g.roundRect(bx - 1, by - 1, barW + 2, barH + 2, 3).fill({ color: 0x1a1712, alpha: 0.8 });
      g.roundRect(bx, by, barW, barH, 2).fill({ color: 0x3a352c });
      g.roundRect(bx, by, barW * progress, barH, 2).fill({ color: 0xd0a84a });
    }
  }
}
