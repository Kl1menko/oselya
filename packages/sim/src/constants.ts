/**
 * SINGLE SOURCE OF TRUTH for all game numbers (AGENT.md §6). Mirror every change in
 * docs/balance.md. No magic numbers anywhere else in the codebase.
 *
 * Phase 0 only needs the tick cadence and season length; economy/combat tables are
 * added in Phases 1 and 3 as those systems land.
 */

/** Global simulation tick: economy, army movement, construction progress. */
export const TICK_INTERVAL_MS = 5_000;

/** In-game day cycle (villagers leave home → work → return). Presentation-layer timing. */
export const DAY_CYCLE_MS = 20 * 60 * 1_000; // 20 real minutes

/** Season cycle spring→summer→autumn→winter. */
export const SEASON_CYCLE_MS = 7 * 24 * 60 * 60 * 1_000; // 7 real days
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** The 8 MVP resources (AGENT.md §3.2). */
export const RESOURCES = [
  "wood",
  "planks",
  "stone",
  "food",
  "tools",
  "iron",
  "gold",
  "cloth",
] as const;
export type ResourceType = (typeof RESOURCES)[number];

/** New-player shield: full immunity on spawn (AGENT.md §3.3). */
export const NEWBIE_SHIELD_MS = 72 * 60 * 60 * 1_000; // 72h

/**
 * Given absolute world time elapsed since season 0, return the current season.
 * Pure + deterministic — safe for catch-up simulation.
 */
export function seasonAt(elapsedMs: number): Season {
  const phase = Math.floor((elapsedMs % SEASON_CYCLE_MS) / (SEASON_CYCLE_MS / SEASONS.length));
  return SEASONS[phase % SEASONS.length]!;
}
