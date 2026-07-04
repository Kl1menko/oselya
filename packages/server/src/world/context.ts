import type { SettlementRegistry } from "./settlementRegistry.js";

/** Shared server context passed to command handlers and the tick loop. */
export interface ServerContext {
  settlements: SettlementRegistry;
  /** Absolute ms at which season 0 (spring) began for this world. */
  seasonEpoch: number;
}
