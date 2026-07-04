import type { WorkAssignPayload } from "@oselya/shared";
import type { Connection } from "../world/connection.js";
import type { ServerContext } from "../world/context.js";
import { sendSettlementDelta, rejectCmd } from "./helpers.js";

/** work.assign — set the worker count on one of the player's buildings (clamped to its slots). */
export function handleWorkAssign(
  conn: Connection,
  seq: number,
  payload: WorkAssignPayload,
  ctx: ServerContext,
  now: number,
): void {
  const playerId = conn.identity!.playerId;
  const settlement = ctx.settlements.getOrCreate(playerId);

  const result = settlement.assignWorkers(payload.buildingId, payload.workers);
  if ("error" in result) {
    rejectCmd(conn, seq, result.error);
    return;
  }
  sendSettlementDelta(conn, ctx, settlement, now);
}
