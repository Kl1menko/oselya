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
} from "@oselya/shared";
import { authenticate } from "../auth/auth.js";
import { logger } from "../logger.js";
import type { Connection } from "./connection.js";

/** Parse + route one raw ws message. All validation happens here (server is authoritative). */
export async function handleMessage(conn: Connection, raw: string): Promise<void> {
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

  // Rate limit everything except the initial auth handshake.
  if (t !== ClientMessageType.Auth && !conn.allowCommand(Date.now())) {
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
      if (requireAuth(conn, seq)) handleSub(conn, seq, d);
      return;
    default:
      // Declared-but-unimplemented commands (build.*, army.*, trade.*, chat.*) land in later phases.
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

function handleSub(conn: Connection, seq: number, d: unknown): void {
  const payload = clientPayloadSchemas[ClientMessageType.Sub].safeParse(d);
  if (!payload.success) {
    reject(conn, seq, "invalid_sub_payload");
    return;
  }
  const scope: SubScope = payload.data.scope;
  conn.subscriptions.add(scope);
  // Phase 0 snapshot is a stub; Phase 1 fills settlement state, Phase 2 world state.
  conn.send<SnapshotPayload>(ServerMessageType.Snapshot, seq, {
    scope,
    serverTime: Date.now(),
    state: {},
  });
}

function reject(conn: Connection, seq: number, reason: string): void {
  conn.send<CmdRejectedPayload>(ServerMessageType.CmdRejected, seq, { seq, reason });
}
