import { Application } from "pixi.js";
import type { SettlementSnapshotState } from "@oselya/shared";
import { WsClient } from "./net/wsClient.js";
import { GameStore } from "./net/store.js";
import { SettlementScene } from "./scenes/settlement/settlementScene.js";
import { StatusBar } from "./ui/statusBar.js";
import { ResourceBar } from "./ui/resourceBar.js";
import { BuildPanel } from "./ui/buildPanel.js";
import { BuildingPanel } from "./ui/buildingPanel.js";
import { Toasts } from "./ui/toasts.js";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: "#1a1712",
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  const mount = document.getElementById("app")!;
  mount.appendChild(app.canvas);
  app.canvas.style.touchAction = "none";

  const store = new GameStore();
  const toasts = new Toasts();

  const status = new StatusBar();
  const client = new WsClient(WS_URL, "dev", {
    onState: (s) => status.setState(s),
    onPong: (rtt) => status.setRtt(rtt),
    onSnapshot: (snap) => {
      if (snap.scope === "settlement") {
        store.applySnapshot(snap.state as SettlementSnapshotState, snap.serverTime);
      }
    },
    onDelta: (delta) => store.applyDelta(delta),
    onRejected: (r) => console.warn("command rejected:", r.reason),
    onNotify: (n) => toasts.show(n),
  });

  const scene = new SettlementScene(app, store, client);

  // Dev-only debug handle (used by automated tests to verify the villager walk cycle).
  if (import.meta.env.DEV) {
    (window as unknown as { __oselya?: unknown }).__oselya = { app, store, scene };
  }

  // UI overlays.
  new ResourceBar(store);
  const buildingPanel = new BuildingPanel(store, client);
  const buildPanel = new BuildPanel((type) => {
    scene.placement.select(type);
    if (type) buildingPanel.select(null); // entering build mode closes the inspect panel
  });

  // Selecting a building opens its inspect panel; entering build mode clears its highlight.
  scene.onBuildingClick = (id) => buildingPanel.select(id);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") buildPanel.clearSelection();
  });

  client.subscribe("settlement");
  client.connect();

  window.addEventListener("online", () => client.connect());
}

void boot();
