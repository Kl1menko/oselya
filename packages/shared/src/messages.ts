import { z } from "zod";

/**
 * Client → server message types (commands). Phase 0 implements `auth`, `sub`, `ping`.
 * The rest are declared here so the protocol surface is defined up front; their handlers
 * arrive in later phases (see AGENT.md §4.4 / §7).
 */
export const ClientMessageType = {
  Auth: "auth",
  Sub: "sub",
  Ping: "ping",
  BuildPlace: "build.place",
  BuildDemolish: "build.demolish",
  WorkAssign: "work.assign",
  ArmyRecruit: "army.recruit",
  ArmyMove: "army.move",
  TradeCreateOffer: "trade.createOffer",
  TradeAccept: "trade.accept",
  ChatSend: "chat.send",
} as const;
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType];

/** Server → client message types (events). */
export const ServerMessageType = {
  Authed: "authed",
  Snapshot: "snapshot",
  Delta: "delta",
  CmdRejected: "cmd.rejected",
  BattleReport: "battle.report",
  Notify: "notify",
  ChatMsg: "chat.msg",
  Pong: "pong",
} as const;
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType];

// ---- Client → server payload schemas (Zod = server-side validation) ----

export const authPayload = z.object({
  /** Session token. In dev autologin mode the client may send "dev". */
  token: z.string().min(1),
});
export type AuthPayload = z.infer<typeof authPayload>;

export const subScope = z.enum(["settlement", "world"]);
export type SubScope = z.infer<typeof subScope>;

export const subPayload = z.object({
  scope: subScope,
  /** Optional world viewport area (hex bounds); unused for `settlement`. */
  area: z
    .object({
      q0: z.number().int(),
      r0: z.number().int(),
      q1: z.number().int(),
      r1: z.number().int(),
    })
    .optional(),
});
export type SubPayload = z.infer<typeof subPayload>;

export const pingPayload = z.object({
  /** Client clock in ms, echoed back in pong for RTT measurement. */
  ts: z.number(),
});
export type PingPayload = z.infer<typeof pingPayload>;

/**
 * Registry of validators for implemented commands. Command handlers look the schema up here
 * rather than importing each individually. Unimplemented types are absent → rejected.
 */
export const clientPayloadSchemas = {
  [ClientMessageType.Auth]: authPayload,
  [ClientMessageType.Sub]: subPayload,
  [ClientMessageType.Ping]: pingPayload,
} as const;

// ---- Server → client payload types ----

export interface AuthedPayload {
  playerId: string;
  userId: string;
  worldId: string;
}

export interface PongPayload {
  /** Echo of client ts. */
  ts: number;
  /** Server clock in ms. */
  serverTs: number;
}

export interface CmdRejectedPayload {
  seq: number;
  reason: string;
}

export interface NotifyPayload {
  level: "info" | "warn" | "error";
  text: string;
}

/** Phase 0 snapshot is intentionally thin — expands in Phase 1. */
export interface SnapshotPayload {
  scope: SubScope;
  serverTime: number;
  /** Filled in with settlement / world state in later phases. */
  state: Record<string, unknown>;
}
