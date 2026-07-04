import { TICK_INTERVAL_MS } from "@oselya/sim";
import { logger } from "../logger.js";

/**
 * Global simulation tick (AGENT.md §4.2): every 5s the server advances economy, army movement
 * and construction. Phase 0 is a heartbeat only — the actual simulation lands in Phase 1.
 */
export class TickLoop {
  private timer: NodeJS.Timeout | null = null;
  private tickCount = 0;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    logger.info({ intervalMs: TICK_INTERVAL_MS }, "tick loop started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const started = performance.now();
    this.tickCount++;
    // Phase 1+: run @oselya/sim over dirty entities here.
    const durationMs = performance.now() - started;
    logger.debug({ tick: this.tickCount, durationMs }, "tick");
  }
}
