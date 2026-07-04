import {
  makeEnvelope,
  ClientMessageType,
  ServerMessageType,
  type Envelope,
  type AuthedPayload,
  type PongPayload,
  type SnapshotPayload,
  type SubScope,
} from "@oselya/shared";

export type ConnState = "connecting" | "connected" | "disconnected";

export interface WsClientEvents {
  onState?: (state: ConnState) => void;
  onAuthed?: (identity: AuthedPayload) => void;
  onSnapshot?: (snapshot: SnapshotPayload) => void;
  onPong?: (rttMs: number) => void;
}

/**
 * Authoritative-server ws client. Handles: connect → auth → (re)subscribe → snapshot resync,
 * automatic reconnect with backoff, and ping/pong RTT. The client only sends commands and
 * renders snapshots/deltas; it never simulates (AGENT.md §2).
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private closedByUser = false;

  /** Scopes to (re)subscribe to on every (re)connect, so resync is automatic. */
  private readonly desiredScopes = new Set<SubScope>();

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly events: WsClientEvents = {},
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.openSocket();
  }

  close(): void {
    this.closedByUser = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
  }

  subscribe(scope: SubScope): void {
    this.desiredScopes.add(scope);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSub(scope);
    }
  }

  private openSocket(): void {
    this.events.onState?.("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      // Auth first; subscriptions + pings start once we're authed.
      this.send(ClientMessageType.Auth, { token: this.token });
    });

    ws.addEventListener("message", (ev) => this.onMessage(ev.data as string));

    ws.addEventListener("close", () => {
      this.clearTimers();
      this.events.onState?.("disconnected");
      if (!this.closedByUser) this.scheduleReconnect();
    });

    ws.addEventListener("error", () => ws.close());
  }

  private onMessage(raw: string): void {
    let env: Envelope;
    try {
      env = JSON.parse(raw) as Envelope;
    } catch {
      return;
    }

    switch (env.t) {
      case ServerMessageType.Authed: {
        this.events.onState?.("connected");
        this.events.onAuthed?.(env.d as AuthedPayload);
        // Resubscribe to everything we wanted → server replies with fresh snapshots (resync).
        for (const scope of this.desiredScopes) this.sendSub(scope);
        this.startPings();
        break;
      }
      case ServerMessageType.Snapshot:
        this.events.onSnapshot?.(env.d as SnapshotPayload);
        break;
      case ServerMessageType.Pong: {
        const d = env.d as PongPayload;
        this.events.onPong?.(Date.now() - d.ts);
        break;
      }
      default:
        // delta / notify / chat / cmd.rejected — handled in later phases.
        break;
    }
  }

  private sendSub(scope: SubScope): void {
    this.send(ClientMessageType.Sub, { scope });
  }

  private startPings(): void {
    this.clearPing();
    this.pingTimer = window.setInterval(() => {
      this.send(ClientMessageType.Ping, { ts: Date.now() });
    }, 10_000);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 15_000);
    this.reconnectTimer = window.setTimeout(() => this.openSocket(), delay);
  }

  private send<D>(t: ClientMessageType, d: D): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(makeEnvelope(t, this.seq++, d)));
  }

  private clearTimers(): void {
    this.clearPing();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
