import { Container } from "pixi.js";
import type { Application } from "pixi.js";
import type { GameStore } from "../../net/store.js";
import type { WsClient } from "../../net/wsClient.js";
import { TerrainLayer } from "./terrainLayer.js";
import { BuildingsLayer } from "./buildingsLayer.js";
import { ProgressLayer } from "./progressLayer.js";
import { Camera } from "./camera.js";
import { PlacementController } from "./placementController.js";
import { tileToScene, sceneToTile } from "./iso.js";
import { CLIENT_BUILDINGS } from "./buildingCatalog.js";

/**
 * The settlement scene: a world container (moved by the camera) holding the static terrain layer,
 * the y-sorted buildings layer, construction progress bars, and the placement ghost. Re-renders
 * from the store on change; runs the camera + progress each frame.
 */
export class SettlementScene {
  readonly world = new Container();
  private readonly terrainLayer = new TerrainLayer();
  private readonly buildingsLayer = new BuildingsLayer();
  private readonly progressLayer = new ProgressLayer();
  private readonly camera: Camera;
  readonly placement: PlacementController;
  private terrainRendered = false;

  /** Called when a building is clicked (not in build mode); null when clicking empty ground. */
  onBuildingClick: (buildingId: string | null) => void = () => {};

  constructor(
    private readonly app: Application,
    private readonly store: GameStore,
    client: WsClient,
  ) {
    this.world.addChild(this.terrainLayer.graphics);
    this.world.addChild(this.buildingsLayer.container);
    this.world.addChild(this.progressLayer.container);
    this.app.stage.addChild(this.world);

    this.camera = new Camera(this.world, this.app.canvas);
    this.placement = new PlacementController(this.app, this.world, this.store, client);

    this.store.subscribe(() => this.syncFromStore());
    this.app.ticker.add(() => {
      this.camera.update();
      this.progressLayer.update();
    });
    this.attachPicking();
  }

  /** Click-to-select a building (skipped while placing, so a place-click isn't also a select). */
  private attachPicking(): void {
    let downX = 0;
    let downY = 0;
    this.app.canvas.addEventListener("pointerdown", (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    this.app.canvas.addEventListener("pointerup", (e) => {
      if (this.placement.isActive()) return;
      // Ignore drags (camera pan): only treat near-stationary clicks as picks.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const tile = this.cursorToTile(e.clientX, e.clientY);
      this.onBuildingClick(this.buildingAtTile(tile.x, tile.y));
    });
  }

  private cursorToTile(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left - this.world.position.x) / this.world.scale.x;
    const sy = (clientY - rect.top - this.world.position.y) / this.world.scale.y;
    const t = sceneToTile(sx, sy);
    return { x: Math.round(t.x), y: Math.round(t.y) };
  }

  private buildingAtTile(tx: number, ty: number): string | null {
    const s = this.store.settlement;
    if (!s) return null;
    for (const b of s.buildings) {
      const def = CLIENT_BUILDINGS[b.type];
      if (!def) continue;
      if (tx >= b.x && tx < b.x + def.w && ty >= b.y && ty < b.y + def.h) return b.id;
    }
    return null;
  }

  private syncFromStore(): void {
    const { terrain, settlement, serverTime } = this.store;
    if (terrain && !this.terrainRendered) {
      this.terrainLayer.render(terrain);
      this.terrainRendered = true;
      const mid = tileToScene(terrain.size / 2, terrain.size / 2);
      this.camera.centerOn(mid.x, mid.y);
    }
    if (settlement) {
      this.buildingsLayer.render(settlement.buildings, serverTime);
      this.progressLayer.setBuildings(settlement.buildings);
    }
  }
}
