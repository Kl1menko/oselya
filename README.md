# Oselya

Persistent browser MMO strategy: a beautiful isometric **settlement layer** (Manor Lords–inspired)
on top of a shared hex **world map** (Travian / HOI4–inspired). The server is the single source of
truth; the client only renders state and sends commands.

Full design spec: [`AGENT.md`](./AGENT.md).

## Stack

TypeScript · Vite + PixiJS v8 (client) · Node 22 + `ws` (server) · PostgreSQL 16 + Drizzle · Redis 7 ·
Vitest. Monorepo via pnpm workspaces.

## Layout

```
packages/
  shared/   protocol types, message envelope, enums (client + server)
  sim/      pure simulation functions: economy, combat, formulas + seeded PRNG (server + tests)
  server/   ws game server, auth, tick loop, Drizzle schema & migrations
  client/   Vite + PixiJS app, ws client with reconnect/resync
docs/
  protocol.md   WebSocket protocol reference (keep in sync with packages/shared)
  balance.md    all numeric economy/combat constants (mirror of packages/sim/constants.ts)
```

## Quick start (Phase 0)

Prereqs: Node ≥ 22, pnpm 9, Docker (for the full `docker compose up` path).

```bash
pnpm install

# Option A — everything in Docker (postgres + redis + server + client)
docker compose up --build

# Option B — infra in Docker, app on host
docker compose up -d postgres redis
cp .env.example .env
pnpm db:migrate
pnpm dev:server   # ws on :8080
pnpm dev:client   # vite on :5173
```

Client dev server: http://localhost:5173 — it auto-connects to the ws server, auto-logs in
(dev autologin), and shows connection status. Closing/reopening the tab triggers reconnect + snapshot
resync.

## Scripts

| Command            | What it does                            |
| ------------------ | --------------------------------------- |
| `pnpm typecheck`   | Project-wide `tsc --noEmit`             |
| `pnpm lint`        | ESLint (flat config, v9)                |
| `pnpm format`      | Prettier write                          |
| `pnpm test`        | Vitest (sim + server logic)             |
| `pnpm db:generate` | Drizzle: generate migration from schema |
| `pnpm db:migrate`  | Drizzle: apply migrations               |

## Conventions (enforced across phases)

- **All game constants** live only in `packages/sim/src/constants.ts`, mirrored in `docs/balance.md`.
  No magic numbers elsewhere.
- **All protocol types** live only in `packages/shared`; both sides import them. Every server command
  is validated with a Zod schema.
- **No `Math.random()`** in simulation — only the seeded `mulberry32` PRNG from `packages/sim`.
- Each phase = its own branch + PR describing what was done.
