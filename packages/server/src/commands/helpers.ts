import { ServerMessageType, type DeltaPayload } from "@oselya/shared";
import type { Connection } from "../world/connection.js";
import type { ServerContext } from "../world/context.js";
import type { SettlementState } from "../world/settlementState.js";

/** Send the full settlement as a delta after a mutating command (Phase 1: whole-settlement diff). */
export function sendSettlementDelta(
  conn: Connection,
  ctx: ServerContext,
  settlement: SettlementState,
  now: number,
): void {
  const delta: DeltaPayload = {
    serverTime: now,
    season: settlement.season(now, ctx.seasonEpoch),
    settlement: settlement.toWire(now),
  };
  conn.send(ServerMessageType.Delta, -1, delta);
}

export function rejectCmd(conn: Connection, seq: number, reason: string): void {
  conn.send(ServerMessageType.CmdRejected, seq, { seq, reason });
}
