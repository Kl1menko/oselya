/**
 * Client-side building metadata for the build panel and placement preview. Mirrors
 * packages/sim/src/buildings.ts (the client can't import @oselya/sim). The server re-validates
 * every placement, so this is presentation-only; a mismatch just shows a wrong preview color,
 * never an exploit. Keep in sync with the sim catalog / docs/balance.md.
 */

export type Adjacency = "forest" | "stone" | "iron" | "water" | "none";

export interface ClientBuildingDef {
  label: string; // Ukrainian UI label
  w: number;
  h: number;
  requires: Adjacency;
  cost: Record<string, number>;
  workSlots: number;
}

export const CLIENT_BUILDINGS: Record<string, ClientBuildingDef> = {
  town_hall: { label: "Ратуша", w: 3, h: 3, requires: "none", cost: {}, workSlots: 0 },
  house: { label: "Хата", w: 1, h: 1, requires: "none", cost: { wood: 20 }, workSlots: 0 },
  woodcutter: {
    label: "Лісорубка",
    w: 1,
    h: 1,
    requires: "forest",
    cost: { wood: 10 },
    workSlots: 3,
  },
  sawmill: { label: "Лісопилка", w: 2, h: 1, requires: "none", cost: { wood: 40 }, workSlots: 3 },
  quarry: { label: "Каменоломня", w: 2, h: 2, requires: "stone", cost: { wood: 30 }, workSlots: 4 },
  farm: { label: "Ферма", w: 2, h: 2, requires: "none", cost: { wood: 30 }, workSlots: 4 },
  fishing_hut: {
    label: "Рибальська хатина",
    w: 1,
    h: 1,
    requires: "water",
    cost: { wood: 20, planks: 10 },
    workSlots: 2,
  },
  mine: {
    label: "Шахта",
    w: 2,
    h: 2,
    requires: "iron",
    cost: { wood: 40, planks: 20 },
    workSlots: 4,
  },
  smithy: {
    label: "Кузня",
    w: 2,
    h: 1,
    requires: "none",
    cost: { wood: 30, planks: 20, stone: 20 },
    workSlots: 3,
  },
  market: {
    label: "Ринок",
    w: 2,
    h: 2,
    requires: "none",
    cost: { wood: 40, planks: 30 },
    workSlots: 2,
  },
  weavery: {
    label: "Ткацька майстерня",
    w: 2,
    h: 1,
    requires: "none",
    cost: { wood: 30, planks: 20 },
    workSlots: 3,
  },
  pasture: { label: "Пасовище", w: 3, h: 3, requires: "none", cost: { wood: 30 }, workSlots: 2 },
  warehouse: {
    label: "Склад",
    w: 2,
    h: 2,
    requires: "none",
    cost: { wood: 50, planks: 30, stone: 20 },
    workSlots: 0,
  },
  barracks: {
    label: "Казарма",
    w: 2,
    h: 2,
    requires: "none",
    cost: { wood: 60, planks: 40, stone: 30 },
    workSlots: 0,
  },
};

/** Buildings offered in the build panel, in a sensible build order. */
export const BUILD_MENU_ORDER: string[] = [
  "house",
  "woodcutter",
  "sawmill",
  "quarry",
  "farm",
  "fishing_hut",
  "mine",
  "smithy",
  "weavery",
  "pasture",
  "market",
  "warehouse",
  "barracks",
  "town_hall",
];

export const RESOURCE_LABELS: Record<string, string> = {
  wood: "Дерево",
  planks: "Дошки",
  stone: "Камінь",
  food: "Їжа",
  tools: "Інструменти",
  iron: "Залізо",
  gold: "Золото",
  cloth: "Тканина",
};

export const SEASON_LABELS: Record<string, string> = {
  spring: "Весна",
  summer: "Літо",
  autumn: "Осінь",
  winter: "Зима",
};
