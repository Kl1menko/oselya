# WebSocket protocol

Keep this in sync with `packages/shared` — types there are the source of truth; this doc explains
them. JSON transport in MVP; binary may replace it later (AGENT.md §4.4).

## Envelope

Every message is `{ "t": <type>, "seq": <number>, "d": <payload> }`.

- `t` — message type string.
- `seq` — per-connection counter (client-assigned, monotonically increasing). The server echoes it
  in `cmd.rejected` so the client can correlate a rejection with the command that caused it.
- `d` — type-specific payload.

`PROTOCOL_VERSION = 1`.

## Client → server

| type                | payload                                     | status     |
| ------------------- | ------------------------------------------- | ---------- |
| `auth`              | `{ token }`                                 | ✅ Phase 0 |
| `sub`               | `{ scope: "settlement" \| "world", area? }` | ✅ Phase 0 |
| `ping`              | `{ ts }`                                    | ✅ Phase 0 |
| `build.place`       | `{ buildingType, x, y }`                    | ✅ Phase 1 |
| `build.demolish`    | `{ buildingId }`                            | ✅ Phase 1 |
| `work.assign`       | `{ buildingId, workers }`                   | ✅ Phase 1 |
| `army.recruit`      | `{ unitType, count }`                       | ⏳ Phase 3 |
| `army.move`         | `{ armyId, targetHex }`                     | ⏳ Phase 3 |
| `trade.createOffer` | `{ give, want }`                            | ⏳ Phase 2 |
| `trade.accept`      | `{ offerId }`                               | ⏳ Phase 2 |
| `chat.send`         | `{ channel, text }`                         | ⏳ Phase 2 |

Unimplemented types are rejected with `cmd.rejected { reason: "unimplemented:<type>" }`.

Every command is validated server-side (Zod schemas in `packages/shared/src/messages.ts`).
Rate limit: **20 commands / 10 s** per connection (`auth` is exempt).

## Server → client

| type            | payload                                | status                        |
| --------------- | -------------------------------------- | ----------------------------- |
| `authed`        | `{ playerId, userId, worldId }`        | ✅ Phase 0                    |
| `snapshot`      | `{ scope, serverTime, state }`         | ✅ settlement state (Phase 1) |
| `pong`          | `{ ts, serverTs }`                     | ✅ Phase 0                    |
| `cmd.rejected`  | `{ seq, reason }`                      | ✅ Phase 0                    |
| `delta`         | `{ serverTime, season?, settlement? }` | ✅ Phase 1 (whole-settlement) |
| `notify`        | `{ level, text }`                      | ⏳ Phase 1                    |
| `battle.report` | battle breakdown                       | ⏳ Phase 3                    |
| `chat.msg`      | chat message                           | ⏳ Phase 2                    |

## Handshake & resync

1. Client opens socket → sends `auth { token }`. In dev (`AUTH_DEV_AUTOLOGIN=true`) any token maps
   to a seeded dev user/player/world.
2. Server replies `authed`.
3. Client sends `sub` for each desired scope → server replies `snapshot` per scope.
4. Client pings every 10 s; server replies `pong` (RTT = `now - ts`).
5. Server also runs a 30 s liveness heartbeat (ws-level ping/pong); dead sockets are terminated.
6. On disconnect the client reconnects with exponential backoff (max 15 s) and re-runs steps 1–3,
   which re-delivers fresh snapshots — that is the resync.
