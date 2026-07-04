import { logger } from "../logger.js";
import type { ServerContext } from "../world/context.js";
import { saveSettlement } from "./settlementRepo.js";

/**
 * Async snapshot writer (AGENT.md §4.1): all live settlements are flushed to Postgres every ~30s,
 * and once more on graceful shutdown, so a crash never loses more than ~30s of progress. Each save
 * also stamps `last_simulated_at`, which is the anchor offline catch-up reads on next login.
 */
export class SnapshotWriter {
  private timer: NodeJS.Timeout | null = null;
  private static readonly INTERVAL_MS = 30_000;

  constructor(private readonly ctx: ServerContext) {}

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

  /** Persist all live settlements. */
  async flush(): Promise<void> {
    const now = Date.now();
    let count = 0;
    for (const settlement of this.ctx.settlements.all()) {
      try {
        await saveSettlement(settlement, now);
        count++;
      } catch (err) {
        logger.error({ err, settlementId: settlement.id }, "settlement save failed");
      }
    }
    if (count > 0) logger.debug({ count }, "snapshot flush");
  }
}
