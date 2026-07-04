import type {
  SettlementSnapshotState,
  WireSettlement,
  WireTerrain,
  DeltaPayload,
} from "@oselya/shared";

/**
 * Client-side mirror of authoritative state (AGENT.md §2: the client only renders state and sends
 * commands). Holds the latest settlement + terrain + season; renderers subscribe for changes.
 */
export class GameStore {
  settlement: WireSettlement | null = null;
  terrain: WireTerrain | null = null;
  season = "spring";
  seasonEpoch = 0;
  /** Server clock at last update; used to decide construction completion locally. */
  serverTime = 0;

  private readonly listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  applySnapshot(state: SettlementSnapshotState, serverTime: number): void {
    this.settlement = state.settlement;
    this.terrain = state.terrain;
    this.season = state.season;
    this.seasonEpoch = state.seasonEpoch;
    this.serverTime = serverTime;
    this.emit();
  }

  applyDelta(delta: DeltaPayload): void {
    if (delta.settlement) this.settlement = delta.settlement;
    if (delta.season) this.season = delta.season;
    this.serverTime = delta.serverTime;
    this.emit();
  }
}
