import { TICK_INTERVAL_MS, ratesPerHour, applyRates } from "@oselya/sim";
import type { DeltaPayload } from "@oselya/shared";
import { ServerMessageType } from "@oselya/shared";
import { logger } from "../logger.js";
import type { ServerContext } from "./context.js";
import type { Connection } from "./connection.js";
import type { SettlementState } from "./settlementState.js";

/**
 * Global simulation tick (AGENT.md §4.2): every 5s advance each settlement's economy by the
 * elapsed wall-clock time and broadcast deltas to subscribed connections. Construction progress
 * is implicit (buildings become operational once `constructionEndsAt <= now`).
 */
export class TickLoop {
  private timer: NodeJS.Timeout | null = null;
  private tickCount = 0;
  /** Last time each settlement's economy was advanced, keyed by settlement id. */
  private readonly lastTickAt = new Map<string, number>();

  constructor(
    private readonly ctx: ServerContext,
    private readonly connections: Map<string, Connection>,
  ) {}

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
    const now = Date.now();

    for (const settlement of this.ctx.settlements.all()) {
      this.advanceSettlement(settlement, now);
    }

    const durationMs = performance.now() - started;
    logger.debug({ tick: this.tickCount, durationMs }, "tick");
  }

  /** Advance one settlement's resources by elapsed time and broadcast a delta to its subscribers. */
  private advanceSettlement(settlement: SettlementState, now: number): void {
    const last = this.lastTickAt.get(settlement.id) ?? now - TICK_INTERVAL_MS;
    const elapsed = now - last;
    this.lastTickAt.set(settlement.id, now);
    if (elapsed <= 0) return;

    const season = settlement.season(now, this.ctx.seasonEpoch);
    const sim = settlement.toSim();
    const rates = ratesPerHour(sim, season, now);
    settlement.resources = applyRates(sim, rates, elapsed, now);

    this.broadcastDelta(settlement, now, season);
  }

  private broadcastDelta(settlement: SettlementState, now: number, season: string): void {
    const delta: DeltaPayload = {
      serverTime: now,
      season,
      settlement: settlement.toWire(now),
    };
    for (const conn of this.connections.values()) {
      if (
        conn.authed &&
        conn.identity!.playerId === settlement.playerId &&
        conn.subscriptions.has("settlement")
      ) {
        conn.send(ServerMessageType.Delta, -1, delta);
      }
    }
  }
}
