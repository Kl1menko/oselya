import type { BuildPlacePayload, BuildDemolishPayload } from "@oselya/shared";
import type { Connection } from "../world/connection.js";
import type { ServerContext } from "../world/context.js";
import { logger } from "../logger.js";
import { sendSettlementDelta, rejectCmd } from "./helpers.js";

/** build.place — validate ownership/type/geometry/adjacency/cost, then create the building. */
export function handleBuildPlace(
  conn: Connection,
  seq: number,
  payload: BuildPlacePayload,
  ctx: ServerContext,
  now: number,
): void {
  const playerId = conn.identity!.playerId;
  const settlement = ctx.settlements.getOrCreate(playerId);

  const result = settlement.placeBuilding(payload.buildingType, payload.x, payload.y, now);
  if ("error" in result) {
    rejectCmd(conn, seq, result.error);
    return;
  }

  logger.debug(
    { playerId, buildingId: result.building.id, type: payload.buildingType },
    "building placed",
  );
  sendSettlementDelta(conn, ctx, settlement, now);
}

/** build.demolish — remove a building the player owns. */
export function handleBuildDemolish(
  conn: Connection,
  seq: number,
  payload: BuildDemolishPayload,
  ctx: ServerContext,
  now: number,
): void {
  const playerId = conn.identity!.playerId;
  const settlement = ctx.settlements.getOrCreate(playerId);

  const result = settlement.demolishBuilding(payload.buildingId);
  if ("error" in result) {
    rejectCmd(conn, seq, result.error);
    return;
  }
  sendSettlementDelta(conn, ctx, settlement, now);
}
