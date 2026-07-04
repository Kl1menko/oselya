import type { WebSocket } from "ws";
import { makeEnvelope, RATE_LIMIT, type ServerMessageType } from "@oselya/shared";
import type { AuthedIdentity } from "../auth/auth.js";

/** Server-side view of one client connection. */
export class Connection {
  readonly id: string;
  readonly ws: WebSocket;
  identity: AuthedIdentity | null = null;
  /** Scopes this connection is subscribed to (Phase 0: string tags). */
  readonly subscriptions = new Set<string>();

  /** Sliding-window rate limiter timestamps (ms). */
  private readonly cmdTimestamps: number[] = [];
  isAlive = true;

  constructor(id: string, ws: WebSocket) {
    this.id = id;
    this.ws = ws;
  }

  get authed(): boolean {
    return this.identity !== null;
  }

  /** Returns false when the command should be dropped for exceeding the rate limit. */
  allowCommand(now: number): boolean {
    const cutoff = now - RATE_LIMIT.windowMs;
    while (this.cmdTimestamps.length > 0 && this.cmdTimestamps[0]! < cutoff) {
      this.cmdTimestamps.shift();
    }
    if (this.cmdTimestamps.length >= RATE_LIMIT.maxCommands) return false;
    this.cmdTimestamps.push(now);
    return true;
  }

  send<D>(type: ServerMessageType, seq: number, payload: D): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    this.ws.send(JSON.stringify(makeEnvelope(type, seq, payload)));
  }
}
