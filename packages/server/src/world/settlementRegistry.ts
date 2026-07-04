import { deriveSeed } from "@oselya/sim";
import type { SettlementState } from "./settlementState.js";
import { loadOrCreateSettlement, type LoadResult } from "../persistence/settlementRepo.js";

/**
 * In-memory registry of live settlements, keyed by playerId. Settlements are loaded from Postgres
 * on first access (applying offline catch-up) and kept hot in memory; the snapshot writer persists
 * them back periodically. Phase 1 is solo, so one settlement per player.
 */
export class SettlementRegistry {
  private readonly byPlayer = new Map<string, SettlementState>();
  /** In-flight loads so concurrent access for the same player shares one DB read. */
  private readonly loading = new Map<string, Promise<LoadResult>>();

  constructor(
    private readonly worldSeed: number,
    private readonly worldSeasonEpoch: number,
  ) {}

  get(playerId: string): SettlementState | undefined {
    return this.byPlayer.get(playerId);
  }

  /**
   * Load (or create) the player's settlement, applying offline catch-up. Returns the live state
   * plus what happened while offline (for the login notification). Idempotent per player.
   */
  async load(playerId: string, now: number): Promise<LoadResult> {
    const existing = this.byPlayer.get(playerId);
    if (existing) {
      return { settlement: existing, created: false, offlineMs: 0, completedBuildings: [] };
    }
    const inFlight = this.loading.get(playerId);
    if (inFlight) return inFlight;

    const gridSeed = deriveSeed(this.worldSeed, `settlement:${playerId}`);
    const promise = loadOrCreateSettlement(playerId, gridSeed, this.worldSeasonEpoch, now).then(
      (result) => {
        this.byPlayer.set(playerId, result.settlement);
        this.loading.delete(playerId);
        return result;
      },
    );
    this.loading.set(playerId, promise);
    return promise;
  }

  all(): IterableIterator<SettlementState> {
    return this.byPlayer.values();
  }
}
