import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex,
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

export type User = typeof users.$inferSelect;
export type World = typeof worlds.$inferSelect;
export type Player = typeof players.$inferSelect;
