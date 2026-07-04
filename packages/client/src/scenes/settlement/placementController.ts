import { Container, Graphics } from "pixi.js";
import type { Application } from "pixi.js";
import { ClientMessageType } from "@oselya/shared";
import type { WsClient } from "../../net/wsClient.js";
import type { GameStore } from "../../net/store.js";
import { TILE_W, TILE_H, tileToScene, sceneToTile } from "./iso.js";
import { CLIENT_BUILDINGS } from "./buildingCatalog.js";
import { isPlacementValid, occupancySet } from "./placementPreview.js";

const VALID_COLOR = 0x6fae57;
const INVALID_COLOR = 0xc0533f;

/**
 * Build-mode placement: when a building type is selected, a translucent ghost follows the cursor,
 * tinted green/red by client-side validity (server re-checks). Click places; Esc/right-click
 * cancels. Only mirrors state — the actual building appears when the server delta arrives.
 */
export class PlacementController {
  readonly ghost = new Container();
  private readonly gfx = new Graphics();
  private selectedType: string | null = null;
  private hoverTile = { x: 0, y: 0 };

  constructor(
    private readonly app: Application,
    private readonly world: Container,
    private readonly store: GameStore,
    private readonly client: WsClient,
  ) {
    this.ghost.addChild(this.gfx);
    this.ghost.visible = false;
    this.world.addChild(this.ghost);
    this.attach();
  }

  select(type: string | null): void {
    this.selectedType = type;
    this.ghost.visible = type !== null;
    if (type) this.redrawGhost();
  }

  isActive(): boolean {
    return this.selectedType !== null;
  }

  private attach(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener("pointermove", (e) => {
      if (!this.selectedType) return;
      const tile = this.cursorToTile(e.clientX, e.clientY);
      if (tile.x !== this.hoverTile.x || tile.y !== this.hoverTile.y) {
        this.hoverTile = tile;
        this.redrawGhost();
      }
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!this.selectedType || e.button !== 0) return;
      this.tryPlace();
    });

    // Right-click / Esc cancels build mode.
    canvas.addEventListener("contextmenu", (e) => {
      if (this.selectedType) {
        e.preventDefault();
        this.select(null);
      }
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.select(null);
    });
  }

  private cursorToTile(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    // Screen → scene-local (undo camera translation + scale).
    const sx = (clientX - rect.left - this.world.position.x) / this.world.scale.x;
    const sy = (clientY - rect.top - this.world.position.y) / this.world.scale.y;
    const t = sceneToTile(sx, sy);
    return { x: Math.round(t.x), y: Math.round(t.y) };
  }

  private redrawGhost(): void {
    const type = this.selectedType;
    if (!type) return;
    const def = CLIENT_BUILDINGS[type];
    if (!def) return;

    const { terrain, settlement } = this.store;
    const valid =
      terrain != null &&
      settlement != null &&
      isPlacementValid(
        type,
        this.hoverTile.x,
        this.hoverTile.y,
        terrain,
        occupancySet(settlement.buildings),
      );

    const color = valid ? VALID_COLOR : INVALID_COLOR;
    const g = this.gfx;
    g.clear();

    // Paint each footprint tile as a diamond outline.
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        const p = tileToScene(this.hoverTile.x + dx, this.hoverTile.y + dy);
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;
        g.moveTo(p.x, p.y - hh)
          .lineTo(p.x + hw, p.y)
          .lineTo(p.x, p.y + hh)
          .lineTo(p.x - hw, p.y)
          .closePath()
          .fill({ color, alpha: 0.4 })
          .stroke({ color, width: 2, alpha: 0.9 });
      }
    }
  }

  private tryPlace(): void {
    const type = this.selectedType;
    if (!type) return;
    // Fire the command; server validates and replies with a delta (or cmd.rejected).
    this.client.command(ClientMessageType.BuildPlace, {
      buildingType: type,
      x: this.hoverTile.x,
      y: this.hoverTile.y,
    });
    // Stay in build mode for rapid placement; Esc/right-click exits.
  }
}
