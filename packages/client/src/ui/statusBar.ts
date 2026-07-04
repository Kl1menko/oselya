import type { ConnState } from "../net/wsClient.js";

const LABELS: Record<ConnState, string> = {
  connecting: "З'єднання…",
  connected: "У мережі",
  disconnected: "Немає з'єднання",
};

/** Minimal DOM overlay for connection status + RTT (Phase 0 placeholder for the HUD). */
export class StatusBar {
  private readonly el = document.getElementById("status")!;
  private readonly textEl = document.getElementById("status-text")!;
  private rttMs: number | null = null;
  private state: ConnState = "connecting";

  setState(state: ConnState): void {
    this.state = state;
    this.el.className = state;
    this.render();
  }

  setRtt(rttMs: number): void {
    this.rttMs = rttMs;
    this.render();
  }

  private render(): void {
    const rtt = this.state === "connected" && this.rttMs !== null ? ` · ${this.rttMs} мс` : "";
    this.textEl.textContent = LABELS[this.state] + rtt;
  }
}
