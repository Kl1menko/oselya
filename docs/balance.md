# Balance

Mirror of `packages/sim/src/constants.ts`. **Every** numeric game constant lives in that file and is
documented here with its reasoning. No magic numbers anywhere else (AGENT.md §6).

## Timing (Phase 0)

| Constant           | Value    | Meaning                                                      |
| ------------------ | -------- | ------------------------------------------------------------ |
| `TICK_INTERVAL_MS` | 5 000 ms | Global sim tick: economy, army movement, construction.       |
| `DAY_CYCLE_MS`     | 20 min   | In-game day (villagers home→work→home). Presentation timing. |
| `SEASON_CYCLE_MS`  | 7 days   | Full spring→summer→autumn→winter cycle.                      |
| `NEWBIE_SHIELD_MS` | 72 h     | New-player full immunity on spawn.                           |

### Seasons

`SEASONS = [spring, summer, autumn, winter]`. `seasonAt(elapsedMs)` maps world-time to the current
season (each season = ¼ of `SEASON_CYCLE_MS`). Season 0 begins at `spring`.

## Resources & settlement (Phase 1)

The 8 MVP resources (`RESOURCES`): `wood, planks, stone, food, tools, iron, gold, cloth`.

| Constant              | Value     | Meaning                                            |
| --------------------- | --------- | -------------------------------------------------- |
| `GRID_SIZE`           | 64        | Settlement is a 64×64 isometric tile grid.         |
| `BASE_STORAGE`        | 300       | Per-resource cap before warehouse/town-hall bonus. |
| `UNCAPPED_RESOURCES`  | `[gold]`  | Soft currencies exempt from the storage cap.       |
| `STARTING_POPULATION` | 4         | Free population before any houses.                 |
| `MS_PER_HOUR`         | 3 600 000 | Catalog rates are per hour; tick pro-rates them.   |

### Winter mechanics

| Constant                            | Value | Meaning                                           |
| ----------------------------------- | ----- | ------------------------------------------------- |
| `WINTER.farmFoodMultiplier`         | 0     | Farms produce no food in winter (fishing works).  |
| `WINTER.heatingWoodPerHousePerHour` | 5     | Extra wood burned per house per hour for heating. |

## Buildings (Phase 1)

14 MVP buildings (`BUILDINGS` in `packages/sim/src/buildings.ts`). Rates are **per hour at full
staffing** (all `workSlots` filled); the tick applies a pro-rated fraction based on assigned workers.
Tuning target: the `wood → planks → level-2 house` chain is completable in ~20 min of active play.

| Building    | Size | Cost                         | Build | Slots | Inputs/h | Outputs/h | Requires | Notes            |
| ----------- | ---- | ---------------------------- | ----- | ----- | -------- | --------- | -------- | ---------------- |
| town_hall   | 3×3  | —                            | 0     | 0     | —        | —         | none     | 1 only, +200 stg |
| house       | 1×1  | wood 20                      | 2m    | 0     | —        | —         | none     | +4 population    |
| woodcutter  | 1×1  | wood 10                      | 2m    | 3     | —        | wood 60   | forest   |                  |
| sawmill     | 2×1  | wood 40                      | 5m    | 3     | wood 40  | planks 30 | none     |                  |
| quarry      | 2×2  | wood 30                      | 6m    | 4     | —        | stone 40  | stone    |                  |
| farm        | 2×2  | wood 30                      | 5m    | 4     | —        | food 80   | none     | 0 in winter      |
| fishing_hut | 1×1  | wood 20, planks 10           | 4m    | 2     | —        | food 40   | water    | works in winter  |
| mine        | 2×2  | wood 40, planks 20           | 8m    | 4     | —        | iron 30   | iron     |                  |
| smithy      | 2×1  | wood 30, planks 20, stone 20 | 8m    | 3     | iron 30  | tools 15  | none     |                  |
| market      | 2×2  | wood 40, planks 30           | 10m   | 2     | —        | —         | none     | trading (Ph. 2)  |
| weavery     | 2×1  | wood 30, planks 20           | 7m    | 3     | food 20  | cloth 20  | none     | food → cloth     |
| pasture     | 3×3  | wood 30                      | 6m    | 2     | food 10  | cloth 10  | none     | sheep/wool fold  |
| warehouse   | 2×2  | wood 50, planks 30, stone 20 | 10m   | 0     | —        | —         | none     | +500 storage     |
| barracks    | 2×2  | wood 60, planks 40, stone 30 | 15m   | 0     | —        | —         | none     | army (Phase 3)   |

Wool is not one of the 8 tracked resources, so the sheep→wool step is folded into the food→cloth
chain (pasture + weavery consume food, produce cloth).

## Combat

Added in Phase 3: deterministic `(attacker, defender, terrain, seed) → report` with a
spear > sword > bow counter-triangle. All randomness via the seeded `mulberry32` PRNG — never
`Math.random()`.
