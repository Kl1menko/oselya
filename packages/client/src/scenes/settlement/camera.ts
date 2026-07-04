import type { Container } from "pixi.js";

/**
 * Pan / zoom / inertia camera over a Pixi container (AGENT.md §7 Phase 1). Pan by dragging;
 * zoom with the wheel toward the cursor; release with velocity to glide (inertia with friction).
 */

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.1;
const FRICTION = 0.9; // per frame velocity decay
const MIN_VELOCITY = 0.02;

export class Camera {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private vx = 0;
  private vy = 0;

  constructor(
    private readonly world: Container,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.attach();
  }

  /** Center the view on a scene-local point (e.g. the town hall). */
  centerOn(sceneX: number, sceneY: number): void {
    this.world.position.set(
      this.canvas.clientWidth / 2 - sceneX * this.world.scale.x,
      this.canvas.clientHeight / 2 - sceneY * this.world.scale.y,
    );
  }

  private attach(): void {
    this.canvas.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.vx = 0;
      this.vy = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.world.position.x += dx;
      this.world.position.y += dy;
      this.vx = dx;
      this.vy = dy;
    });

    window.addEventListener("pointerup", () => {
      this.dragging = false;
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        this.zoomAt(e.clientX, e.clientY, factor);
      },
      { passive: false },
    );
  }

  private zoomAt(clientX: number, clientY: number, factor: number): void {
    const next = clamp(this.world.scale.x * factor, MIN_ZOOM, MAX_ZOOM);
    const applied = next / this.world.scale.x;
    // Keep the point under the cursor fixed while scaling.
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    this.world.position.x = px - (px - this.world.position.x) * applied;
    this.world.position.y = py - (py - this.world.position.y) * applied;
    this.world.scale.set(next);
  }

  /** Call each frame to apply inertia after a drag release. */
  update(): void {
    if (this.dragging) return;
    if (Math.abs(this.vx) < MIN_VELOCITY && Math.abs(this.vy) < MIN_VELOCITY) return;
    this.world.position.x += this.vx;
    this.world.position.y += this.vy;
    this.vx *= FRICTION;
    this.vy *= FRICTION;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
