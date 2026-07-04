import { logger } from "../logger.js";

/**
 * Async snapshot writer (AGENT.md §4.1): dirty entities are flushed to Postgres every ~30s,
 * plus important events immediately. Phase 0 has no mutable world state yet, so this is a stub
 * that establishes the lifecycle (start / flush-on-shutdown) for later phases.
 */
export class SnapshotWriter {
  private timer: NodeJS.Timeout | null = null;
  private static readonly INTERVAL_MS = 30_000;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), SnapshotWriter.INTERVAL_MS);
    logger.info({ intervalMs: SnapshotWriter.INTERVAL_MS }, "snapshot writer started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Persist all dirty entities. No-op in Phase 0. */
  async flush(): Promise<void> {
    // Phase 1+: write dirty settlements/buildings/resources here.
  }
}
