import {
  CLIENT_BUILDINGS,
  BUILD_MENU_ORDER,
  RESOURCE_LABELS,
} from "../scenes/settlement/buildingCatalog.js";

/**
 * Bottom build panel (AGENT.md §5): the 14 buildings as clickable cards showing cost. Selecting a
 * card enters build mode (handled by PlacementController via the onSelect callback). Clicking the
 * active card again, or Esc, exits.
 */
export class BuildPanel {
  private readonly el: HTMLDivElement;
  private selected: string | null = null;

  constructor(private readonly onSelect: (type: string | null) => void) {
    this.el = document.createElement("div");
    this.el.id = "build-panel";
    document.body.appendChild(this.el);
    this.render();
  }

  /** External callers (e.g. Esc handler) can reset the selection highlight. */
  clearSelection(): void {
    this.selected = null;
    this.updateActive();
  }

  private render(): void {
    for (const type of BUILD_MENU_ORDER) {
      const def = CLIENT_BUILDINGS[type];
      if (!def) continue;
      const card = document.createElement("button");
      card.className = "build-card";
      card.dataset.type = type;
      const cost = Object.entries(def.cost)
        .map(([r, n]) => `${RESOURCE_LABELS[r] ?? r} ${n}`)
        .join(", ");
      card.innerHTML = `<span class="name">${def.label}</span><span class="cost">${cost || "—"}</span>`;
      card.addEventListener("click", () => this.toggle(type));
      this.el.appendChild(card);
    }
  }

  private toggle(type: string): void {
    this.selected = this.selected === type ? null : type;
    this.updateActive();
    this.onSelect(this.selected);
  }

  private updateActive(): void {
    for (const card of Array.from(this.el.children) as HTMLElement[]) {
      card.classList.toggle("active", card.dataset.type === this.selected);
    }
  }
}
