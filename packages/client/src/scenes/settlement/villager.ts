import { Container, Graphics } from "pixi.js";
import { tileToScene } from "./iso.js";
import type { TileXY } from "./pathfinding.js";

/**
 * One villager — purely a presentation entity (AGENT.md §4.2: the server never tracks per-tile
 * villager movement). It walks an A* path tile-by-tile with linear interpolation, faces its
 * movement direction (4-way), and optionally carries a resource dot back to the warehouse.
 */

export type VillagerPhase = "toWork" | "toHome" | "idle";
export type Facing = "ne" | "nw" | "se" | "sw";

const SPEED_TILES_PER_SEC = 1.6;

export class Villager {
  readonly container = new Container();
  private readonly body: Graphics;
  private readonly carry: Graphics;

  phase: VillagerPhase = "idle";
  /** Home tile and (optional) work tile assigned by the manager. */
  homeTile: TileXY;
  workTile: TileXY | null = null;

  private path: TileXY[] = [];
  private segIndex = 0;
  private segT = 0; // 0..1 progress along current segment
  private facing: Facing = "se";
  private carrying = false;
  private readonly tint: number;

  constructor(homeTile: TileXY, tint: number) {
    this.homeTile = homeTile;
    this.tint = tint;

    this.body = new Graphics();
    drawVillager(this.body, tint, "se");
    this.container.addChild(this.body);

    this.carry = new Graphics();
    this.carry.circle(0, -16, 3).fill({ color: 0xcaa46a });
    this.carry.visible = false;
    this.container.addChild(this.carry);

    const p = tileToScene(homeTile.x, homeTile.y);
    this.container.position.set(p.x, p.y);
    this.container.zIndex = homeTile.x + homeTile.y;
  }

  get isMoving(): boolean {
    return this.segIndex < this.path.length - 1;
  }

  currentTile(): TileXY {
    const seg = this.path[this.segIndex];
    return seg ?? this.homeTile;
  }

  /** Give the villager a path to follow; sets carrying state for the return leg. */
  setPath(path: TileXY[], phase: VillagerPhase, carrying: boolean): void {
    this.path = path.length > 0 ? path : [this.currentTile()];
    this.segIndex = 0;
    this.segT = 0;
    this.phase = phase;
    this.carrying = carrying;
    this.carry.visible = carrying;
  }

  /** Advance along the path. Returns true when the destination is reached this frame. */
  update(dtSec: number): boolean {
    if (!this.isMoving) return false;

    this.segT += dtSec * SPEED_TILES_PER_SEC;
    while (this.segT >= 1 && this.isMoving) {
      this.segT -= 1;
      this.segIndex++;
    }

    const from = this.path[Math.min(this.segIndex, this.path.length - 1)]!;
    const to = this.path[Math.min(this.segIndex + 1, this.path.length - 1)]!;
    const t = this.isMoving ? this.segT : 1;

    const fx = from.x + (to.x - from.x) * t;
    const fy = from.y + (to.y - from.y) * t;
    const p = tileToScene(fx, fy);
    this.container.position.set(p.x, p.y);
    this.container.zIndex = Math.round(fx + fy);

    this.updateFacing(to.x - from.x, to.y - from.y);

    return !this.isMoving;
  }

  private updateFacing(dx: number, dy: number): void {
    let f: Facing = this.facing;
    if (dx > 0 && dy === 0) f = "se";
    else if (dx < 0 && dy === 0) f = "nw";
    else if (dy > 0) f = "sw";
    else if (dy < 0) f = "ne";
    if (f !== this.facing) {
      this.facing = f;
      drawVillager(this.body, this.tint, f);
    }
    // Bob while walking (cheap placeholder walk animation; sprite sheets replace this later).
    this.body.y = Math.sin(performance.now() / 90) * 1.2;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

/**
 * A tiny iso-friendly figure: a rounded body with a lighter head, tinted per villager. Facing
 * nudges the head so direction reads; full 4-direction sprite sheets replace this when art lands.
 */
function drawVillager(g: Graphics, tint: number, facing: Facing): void {
  g.clear();
  const headDx = facing === "se" || facing === "sw" ? 0.8 : -0.8;
  // Shadow.
  g.ellipse(0, 2, 6, 3).fill({ color: 0x000000, alpha: 0.25 });
  // Body.
  g.roundRect(-4, -14, 8, 14, 3).fill({ color: tint });
  // Head.
  g.circle(headDx, -16, 3.4).fill({ color: 0xe8cdaa });
}
