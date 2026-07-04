import { Container } from "pixi.js";
import type { Application } from "pixi.js";
import type { GameStore } from "../../net/store.js";
import { TerrainLayer } from "./terrainLayer.js";
import { BuildingsLayer } from "./buildingsLayer.js";
import { Camera } from "./camera.js";
import { tileToScene } from "./iso.js";

/**
 * The settlement scene: a world container (moved by the camera) holding the static terrain layer
 * and the y-sorted buildings layer. Re-renders from the store on change; runs the camera each
 * frame for inertia.
 */
export class SettlementScene {
  readonly world = new Container();
  private readonly terrainLayer = new TerrainLayer();
  private readonly buildingsLayer = new BuildingsLayer();
  private readonly camera: Camera;
  private terrainRendered = false;

  constructor(
    private readonly app: Application,
    private readonly store: GameStore,
  ) {
    this.world.addChild(this.terrainLayer.graphics);
    this.world.addChild(this.buildingsLayer.container);
    this.app.stage.addChild(this.world);

    this.camera = new Camera(this.world, this.app.canvas);

    this.store.subscribe(() => this.syncFromStore());
    this.app.ticker.add(() => this.camera.update());
  }

  private syncFromStore(): void {
    const { terrain, settlement, serverTime } = this.store;
    if (terrain && !this.terrainRendered) {
      this.terrainLayer.render(terrain);
      this.terrainRendered = true;
      // Center on the middle of the map once terrain is known.
      const mid = tileToScene(terrain.size / 2, terrain.size / 2);
      this.camera.centerOn(mid.x, mid.y);
    }
    if (settlement) {
      this.buildingsLayer.render(settlement.buildings, serverTime);
    }
  }
}
