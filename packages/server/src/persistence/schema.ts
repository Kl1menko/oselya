import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  doublePrecision,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Phase 0 schema: users / worlds / players (AGENT.md §4.5). Later phases add settlements,
 * buildings, resources, world_hexes, armies, battles, trade, alliances, chat, event_log —
 * each in its own migration so phase boundaries stay clean.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const worlds = pgTable("worlds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** World generation seed — feeds the seeded PRNG (see @oselya/sim). */
  seed: bigint("seed", { mode: "number" }).notNull(),
  seasonStartedAt: timestamp("season_started_at", { withTimezone: true }).notNull().defaultNow(),
  /** "lobby" | "running" | "ended" */
  status: text("status").notNull().default("running"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    /** Home hex "q,r" on the world map; nullable until spawned (Phase 2). */
    homeHex: text("home_hex"),
    shieldUntil: timestamp("shield_until", { withTimezone: true }),
    gold: integer("gold").notNull().default(0),
    score: integer("score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** A user has at most one player per world. */
    userWorldUnique: uniqueIndex("players_user_world_uniq").on(t.userId, t.worldId),
    worldIdx: index("players_world_idx").on(t.worldId),
  }),
);

/**
 * Phase 1 schema: settlements / buildings / resources (AGENT.md §4.5). `last_simulated_at` on the
 * settlement is the anchor for offline catch-up: on load we advance from it to now by formula.
 */
export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" })
    .unique(),
  gridSeed: bigint("grid_seed", { mode: "number" }).notNull(),
  townHallLevel: integer("town_hall_level").notNull().default(1),
  population: integer("population").notNull().default(4),
  happiness: integer("happiness").notNull().default(100),
  /** Anchor for offline catch-up: last time the economy was simulated for this settlement. */
  lastSimulatedAt: timestamp("last_simulated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const buildings = pgTable(
  "buildings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => settlements.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    level: integer("level").notNull().default(1),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    workers: integer("workers").notNull().default(0),
    constructionEndsAt: timestamp("construction_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    settlementIdx: index("buildings_settlement_idx").on(t.settlementId),
  }),
);

export const resources = pgTable(
  "resources",
  {
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => settlements.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    amount: doublePrecision("amount").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.settlementId, t.resourceType] }),
  }),
);

export type User = typeof users.$inferSelect;
export type World = typeof worlds.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Building = typeof buildings.$inferSelect;
export type ResourceRow = typeof resources.$inferSelect;
