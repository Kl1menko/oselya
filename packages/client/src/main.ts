import { Application, Container, Graphics, Text } from "pixi.js";
import { WsClient } from "./net/wsClient.js";
import { StatusBar } from "./ui/statusBar.js";

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
  document.getElementById("app")!.appendChild(app.canvas);

  // Phase 0 placeholder scene: a single isometric-styled tile + title, to prove PixiJS renders.
  // Phase 1 replaces this with the real 64×64 settlement scene.
  const scene = new Container();
  scene.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(scene);

  const tile = new Graphics()
    .moveTo(0, -32)
    .lineTo(64, 0)
    .lineTo(0, 32)
    .lineTo(-64, 0)
    .closePath()
    .fill({ color: 0x5a7a3a })
    .stroke({ color: 0x3c5226, width: 2 });
  scene.addChild(tile);

  const title = new Text({
    text: "Оселя",
    style: { fill: 0xe8e0d0, fontSize: 28, fontFamily: "system-ui", letterSpacing: 2 },
  });
  title.anchor.set(0.5);
  title.position.set(0, -90);
  scene.addChild(title);

  app.renderer.on("resize", () => {
    scene.position.set(app.screen.width / 2, app.screen.height / 2);
  });

  const status = new StatusBar();
  const client = new WsClient(WS_URL, "dev", {
    onState: (s) => status.setState(s),
    onPong: (rtt) => status.setRtt(rtt),
    onAuthed: (id) => console.info("authed", id),
    onSnapshot: (snap) => console.info("snapshot", snap.scope, snap),
  });

  client.subscribe("settlement");
  client.connect();

  // Reconnect on tab regaining focus after a drop (belt-and-suspenders with auto-reconnect).
  window.addEventListener("online", () => client.connect());
}

void boot();
