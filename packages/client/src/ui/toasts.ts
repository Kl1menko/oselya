import type { NotifyPayload } from "@oselya/shared";

/**
 * Transient toast notifications (AGENT.md §4.4 `notify`): "construction complete", "you were
 * away", "under attack", etc. A simple stacked DOM overlay that auto-dismisses.
 */
export class Toasts {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.id = "toasts";
    document.body.appendChild(this.el);
  }

  show(n: NotifyPayload): void {
    const toast = document.createElement("div");
    toast.className = `toast ${n.level}`;
    toast.textContent = n.text;
    this.el.appendChild(toast);
    // Fade in, then auto-dismiss.
    requestAnimationFrame(() => toast.classList.add("visible"));
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 400);
    }, 6000);
  }
}
