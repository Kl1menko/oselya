import { Container, Graphics } from "pixi.js";
import type { WireBuilding } from "@oselya/shared";
import { tileToScene } from "./iso.js";
import { CLIENT_BUILDINGS } from "./buildingCatalog.js";

/**
 * Chimney smoke particles (AGENT.md §5: "живі" деталі — smoke from chimneys). A cheap pooled
 * particle system: each smoking building emits rising, expanding, fading puffs. Presentation-only.
 * Winter emits more (heating), summer less.
 */

// Buildings with a hearth/chimney that should smoke when operational.
const SMOKING_TYPES = new Set(["house", "town_hall", "smithy", "sawmill", "weavery"]);

interface Puff {
  x: number;
  y: number;
  age: number;
  life: number;
  vy: number;
  size: number;
}

export class SmokeLayer {
  readonly graphics = new Graphics();
  readonly container = new Container();
  private emitters: { x: number; y: number }[] = [];
  private puffs: Puff[] = [];
  private emitAccumulator = 0;
  private emitPerSec = 6;

  constructor() {
    this.container.addChild(this.graphics);
    this.container.zIndex = 90000;
  }

  /** Recompute chimney positions from operational smoking buildings. */
  setBuildings(buildings: WireBuilding[], serverTime: number): void {
    this.emitters = [];
    for (const b of buildings) {
      if (!SMOKING_TYPES.has(b.type)) continue;
      if (b.constructionEndsAt > serverTime) continue; // no smoke while building
      const def = CLIENT_BUILDINGS[b.type];
      if (!def) continue;
      // Chimney near the building's back-top corner.
      const p = tileToScene(b.x + (def.w - 1) / 2, b.y + (def.h - 1) / 2);
      const roofH = 24 + (def.w + def.h) * 4;
      this.emitters.push({ x: p.x + 6, y: p.y - roofH });
    }
  }

  setSeason(season: string): void {
    // More heating smoke in winter, gentle wisps in summer.
    this.emitPerSec = season === "winter" ? 12 : season === "summer" ? 3 : 6;
  }

  update(dtSec: number): void {
    // Emit.
    this.emitAccumulator += dtSec * this.emitPerSec;
    while (this.emitAccumulator >= 1 && this.emitters.length > 0) {
      this.emitAccumulator -= 1;
      const e = this.emitters[Math.floor(Math.random() * this.emitters.length)]!;
      this.puffs.push({
        x: e.x + (Math.random() - 0.5) * 3,
        y: e.y,
        age: 0,
        life: 1.6 + Math.random() * 0.8,
        vy: 14 + Math.random() * 8,
        size: 2 + Math.random() * 2,
      });
    }

    // Advance + cull.
    const g = this.graphics;
    g.clear();
    const next: Puff[] = [];
    for (const p of this.puffs) {
      p.age += dtSec;
      if (p.age >= p.life) continue;
      const t = p.age / p.life;
      const py = p.y - p.vy * p.age;
      const px = p.x + Math.sin(p.age * 3 + p.x) * 3;
      const radius = p.size + t * 5;
      const alpha = (1 - t) * 0.35;
      g.circle(px, py, radius).fill({ color: 0xcfc8bd, alpha });
      next.push(p);
    }
    this.puffs = next;
  }
}
