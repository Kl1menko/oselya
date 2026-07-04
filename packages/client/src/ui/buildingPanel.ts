import { ClientMessageType, type WireBuilding } from "@oselya/shared";
import type { WsClient } from "../net/wsClient.js";
import type { GameStore } from "../net/store.js";
import { CLIENT_BUILDINGS } from "../scenes/settlement/buildingCatalog.js";

/**
 * Inspect panel for a selected building: shows type/level and, for buildings with worker slots, a
 * slider that sends work.assign. A demolish button removes it. Hidden when nothing is selected.
 */
export class BuildingPanel {
  private readonly el: HTMLDivElement;
  private selectedId: string | null = null;

  constructor(
    private readonly store: GameStore,
    private readonly client: WsClient,
  ) {
    this.el = document.createElement("div");
    this.el.id = "building-panel";
    this.el.style.display = "none";
    document.body.appendChild(this.el);
    // Keep worker count in sync when deltas arrive.
    this.store.subscribe(() => {
      if (this.selectedId) this.render();
    });
  }

  select(buildingId: string | null): void {
    this.selectedId = buildingId;
    this.render();
  }

  private current(): WireBuilding | undefined {
    return this.store.settlement?.buildings.find((b) => b.id === this.selectedId);
  }

  private render(): void {
    const b = this.current();
    if (!b) {
      this.el.style.display = "none";
      this.selectedId = null;
      return;
    }
    const def = CLIENT_BUILDINGS[b.type];
    const label = def?.label ?? b.type;
    const slots = def?.workSlots ?? 0;
    const now = this.store.serverTime;
    const building = b.constructionEndsAt > now;

    this.el.style.display = "block";
    this.el.innerHTML = `
      <h3>${label}</h3>
      <div class="row"><span>Рівень</span><span>${b.level}</span></div>
      ${building ? `<div class="row"><span>Статус</span><span>Будується…</span></div>` : ""}
      ${
        slots > 0
          ? `<div class="row"><span>Робітники</span><span id="wk-val">${b.workers}/${slots}</span></div>
             <input type="range" id="wk" min="0" max="${slots}" value="${b.workers}" />`
          : `<div class="row"><span>Робочих місць</span><span>—</span></div>`
      }
      <div class="actions">
        <button class="demolish" id="demolish">Знести</button>
      </div>`;

    const slider = this.el.querySelector<HTMLInputElement>("#wk");
    if (slider) {
      const valEl = this.el.querySelector<HTMLSpanElement>("#wk-val")!;
      slider.addEventListener("input", () => {
        valEl.textContent = `${slider.value}/${slots}`;
      });
      slider.addEventListener("change", () => {
        this.client.command(ClientMessageType.WorkAssign, {
          buildingId: b.id,
          workers: Number(slider.value),
        });
      });
    }
    this.el.querySelector<HTMLButtonElement>("#demolish")?.addEventListener("click", () => {
      this.client.command(ClientMessageType.BuildDemolish, { buildingId: b.id });
      this.select(null);
    });
  }
}
