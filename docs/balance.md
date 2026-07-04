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

## Resources

The 8 MVP resources (`RESOURCES`): `wood, planks, stone, food, tools, iron, gold, cloth`.
Production chains, storage limits and costs are added in Phase 1 (this table will grow).

## Combat

Added in Phase 3: deterministic `(attacker, defender, terrain, seed) → report` with a
spear > sword > bow counter-triangle. All randomness via the seeded `mulberry32` PRNG — never
`Math.random()`.
