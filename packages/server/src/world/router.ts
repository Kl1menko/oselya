import {
  envelopeSchema,
  clientPayloadSchemas,
  ClientMessageType,
  ServerMessageType,
  type AuthedPayload,
  type PongPayload,
  type SnapshotPayload,
  type CmdRejectedPayload,
  type SubScope,
  type SettlementSnapshotState,
} from "@oselya/shared";
import { authenticate } from "../auth/auth.js";
import { logger } from "../logger.js";
import type { Connection } from "./connection.js";
import type { ServerContext } from "./context.js";
import { handleBuildPlace, handleBuildDemolish } from "../commands/build.js";
import { handleWorkAssign } from "../commands/work.js";

/** Parse + route one raw ws message. All validation happens here (server is authoritative). */
export async function handleMessage(
  conn: Connection,
  raw: string,
  ctx: ServerContext,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    reject(conn, -1, "malformed_json");
    return;
  }

  const env = envelopeSchema.safeParse(parsed);
  if (!env.success) {
    reject(conn, -1, "invalid_envelope");
    return;
  }
  const { t, seq, d } = env.data;
  const now = Date.now();

  // Rate limit everything except the initial auth handshake.
  if (t !== ClientMessageType.Auth && !conn.allowCommand(now)) {
    reject(conn, seq, "rate_limited");
    return;
  }

  switch (t) {
    case ClientMessageType.Auth:
      await handleAuth(conn, seq, d);
      return;
    case ClientMessageType.Ping:
      handlePing(conn, seq, d);
      return;
    case ClientMessageType.Sub:
      if (requireAuth(conn, seq)) handleSub(conn, seq, d, ctx, now);
      return;
    case ClientMessageType.BuildPlace: {
      if (!requireAuth(conn, seq)) return;
      const p = clientPayloadSchemas[ClientMessageType.BuildPlace].safeParse(d);
      if (!p.success) return reject(conn, seq, "invalid_payload");
      handleBuildPlace(conn, seq, p.data, ctx, now);
      return;
    }
    case ClientMessageType.BuildDemolish: {
      if (!requireAuth(conn, seq)) return;
      const p = clientPayloadSchemas[ClientMessageType.BuildDemolish].safeParse(d);
      if (!p.success) return reject(conn, seq, "invalid_payload");
      handleBuildDemolish(conn, seq, p.data, ctx, now);
      return;
    }
    case ClientMessageType.WorkAssign: {
      if (!requireAuth(conn, seq)) return;
      const p = clientPayloadSchemas[ClientMessageType.WorkAssign].safeParse(d);
      if (!p.success) return reject(conn, seq, "invalid_payload");
      handleWorkAssign(conn, seq, p.data, ctx, now);
      return;
    }
    default:
      // Declared-but-unimplemented commands (army.*, trade.*, chat.*) land in later phases.
      reject(conn, seq, `unimplemented:${t}`);
      return;
  }
}

function requireAuth(conn: Connection, seq: number): boolean {
  if (!conn.authed) {
    reject(conn, seq, "not_authenticated");
    return false;
  }
  return true;
}

async function handleAuth(conn: Connection, seq: number, d: unknown): Promise<void> {
  const payload = clientPayloadSchemas[ClientMessageType.Auth].safeParse(d);
  if (!payload.success) {
    reject(conn, seq, "invalid_auth_payload");
    return;
  }
  const identity = await authenticate(payload.data.token);
  if (!identity) {
    reject(conn, seq, "auth_failed");
    return;
  }
  conn.identity = identity;
  logger.info({ connId: conn.id, playerId: identity.playerId }, "authed");
  conn.send<AuthedPayload>(ServerMessageType.Authed, seq, identity);
}

function handlePing(conn: Connection, seq: number, d: unknown): void {
  const payload = clientPayloadSchemas[ClientMessageType.Ping].safeParse(d);
  const clientTs = payload.success ? payload.data.ts : 0;
  conn.send<PongPayload>(ServerMessageType.Pong, seq, { ts: clientTs, serverTs: Date.now() });
}

function handleSub(
  conn: Connection,
  seq: number,
  d: unknown,
  ctx: ServerContext,
  now: number,
): void {
  const payload = clientPayloadSchemas[ClientMessageType.Sub].safeParse(d);
  if (!payload.success) {
    reject(conn, seq, "invalid_sub_payload");
    return;
  }
  const scope: SubScope = payload.data.scope;
  conn.subscriptions.add(scope);

  if (scope === "settlement") {
    const settlement = ctx.settlements.getOrCreate(conn.identity!.playerId);
    const state: SettlementSnapshotState = {
      settlement: settlement.toWire(now),
      terrain: settlement.toWireTerrain(),
      season: settlement.season(now, ctx.seasonEpoch),
      seasonEpoch: ctx.seasonEpoch,
    };
    conn.send<SnapshotPayload>(ServerMessageType.Snapshot, seq, {
      scope,
      serverTime: now,
      state,
    });
    return;
  }

  // World scope: real state lands in Phase 2.
  conn.send<SnapshotPayload>(ServerMessageType.Snapshot, seq, {
    scope,
    serverTime: now,
    state: {},
  });
}

function reject(conn: Connection, seq: number, reason: string): void {
  conn.send<CmdRejectedPayload>(ServerMessageType.CmdRejected, seq, { seq, reason });
}
