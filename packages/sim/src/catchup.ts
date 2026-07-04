import { SEASON_CYCLE_MS, SEASONS, seasonAt, type Season } from "./constants.js";
import { ratesPerHour, applyRates, type SimSettlement } from "./economy.js";

/**
 * Offline catch-up simulation (AGENT.md §4.2): everything that happened while the player was
 * offline is computed by formula, NOT by replaying ticks. We advance resources segment by
 * segment, re-evaluating rates at each boundary where they change:
 *
 *   1. season boundaries (winter stops farms, adds heating);
 *   2. construction completions (a finished building starts producing).
 *
 * `worldSeasonEpoch` is the absolute time (ms) at which season 0 (spring) began, so that
 * `seasonAt(t - worldSeasonEpoch)` gives the season at any absolute time t.
 *
 * Pure & deterministic: same inputs → same output resources. Does not mutate the settlement.
 */
export interface CatchupResult {
  settlement: SimSettlement;
  /** Buildings that finished construction during the catch-up window (ids). */
  completedBuildings: string[];
}

function nextSeasonBoundary(absTime: number, epoch: number): number {
  const elapsed = absTime - epoch;
  const quarter = SEASON_CYCLE_MS / SEASONS.length;
  // Time until the next quarter tick.
  const intoQuarter = ((elapsed % quarter) + quarter) % quarter;
  return absTime + (quarter - intoQuarter);
}

export function catchUp(
  settlement: SimSettlement,
  fromTime: number,
  toTime: number,
  worldSeasonEpoch: number,
): CatchupResult {
  if (toTime <= fromTime) {
    return { settlement, completedBuildings: [] };
  }

  let resources = { ...settlement.resources };
  const completed: string[] = [];
  let cursor = fromTime;

  // Guard against pathological loops (e.g. many buildings). Each iteration consumes at least
  // one boundary; boundaries are finite, but cap to be safe.
  let guard = 0;
  const MAX_SEGMENTS = 100_000;

  while (cursor < toTime && guard++ < MAX_SEGMENTS) {
    const season: Season = seasonAt(cursor - worldSeasonEpoch);

    // Snapshot with current resources so rates/caps reflect what's operational at `cursor`.
    const view: SimSettlement = { buildings: settlement.buildings, resources };

    // Next event: season boundary, or the earliest construction completion strictly after cursor.
    let nextEvent = Math.min(nextSeasonBoundary(cursor, worldSeasonEpoch), toTime);
    for (const b of settlement.buildings) {
      if (b.constructionEndsAt > cursor && b.constructionEndsAt < nextEvent) {
        nextEvent = b.constructionEndsAt;
      }
    }

    const rates = ratesPerHour(view, season, cursor);
    resources = applyRates(view, rates, nextEvent - cursor, cursor);

    // Record any building that becomes operational exactly at nextEvent.
    for (const b of settlement.buildings) {
      if (b.constructionEndsAt === nextEvent) completed.push(b.id);
    }

    cursor = nextEvent;
  }

  return {
    settlement: { buildings: settlement.buildings, resources },
    completedBuildings: completed,
  };
}
