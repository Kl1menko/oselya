import { deriveSeed, emptyResources } from "@oselya/sim";
import { SettlementState } from "./settlementState.js";
import { logger } from "../logger.js";

/** Starting resources so a new player can build the first chain immediately. */
function startingResources() {
  return { ...emptyResources(), wood: 120, planks: 40, stone: 40, food: 100 };
}

/**
 * In-memory registry of live settlements, keyed by playerId. Phase 1 is solo, so settlements are
 * created lazily on first access. Persistence (load-on-auth / snapshot) is wired in Slice 1e.
 */
export class SettlementRegistry {
  private readonly byPlayer = new Map<string, SettlementState>();

  constructor(private readonly worldSeed: number) {}

  get(playerId: string): SettlementState | undefined {
    return this.byPlayer.get(playerId);
  }

  /** Get or create the player's settlement. */
  getOrCreate(playerId: string): SettlementState {
    let s = this.byPlayer.get(playerId);
    if (s) return s;
    const gridSeed = deriveSeed(this.worldSeed, `settlement:${playerId}`);
    s = new SettlementState({
      id: crypto.randomUUID(),
      playerId,
      gridSeed,
      resources: startingResources(),
    });
    this.byPlayer.set(playerId, s);
    logger.info({ playerId, settlementId: s.id, gridSeed }, "created settlement");
    return s;
  }

  all(): IterableIterator<SettlementState> {
    return this.byPlayer.values();
  }
}
