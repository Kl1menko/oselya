import type { GameStore } from "../net/store.js";
import { RESOURCE_LABELS, SEASON_LABELS } from "../scenes/settlement/buildingCatalog.js";

const RESOURCE_ORDER = ["wood", "planks", "stone", "food", "iron", "tools", "cloth", "gold"];

/**
 * Top resource HUD (AGENT.md §5: dark translucent panel of resources at the top). Shows the 8
 * resources, population, and the current season. Re-rendered from the store on change.
 */
export class ResourceBar {
  private readonly el: HTMLDivElement;

  constructor(private readonly store: GameStore) {
    this.el = document.createElement("div");
    this.el.id = "resource-bar";
    document.body.appendChild(this.el);
    this.store.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    const s = this.store.settlement;
    if (!s) {
      this.el.innerHTML = "";
      return;
    }
    const chips = RESOURCE_ORDER.map((r) => {
      const amount = Math.floor(s.resources[r] ?? 0);
      return `<span class="chip"><b>${RESOURCE_LABELS[r]}</b> ${amount}</span>`;
    }).join("");
    const season = SEASON_LABELS[this.store.season] ?? this.store.season;
    this.el.innerHTML =
      chips +
      `<span class="chip pop"><b>Населення</b> ${s.population}/${s.populationCap}</span>` +
      `<span class="chip season">${season}</span>`;
  }
}
