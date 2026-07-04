import { eq, and } from "drizzle-orm";
import { db, schema } from "../persistence/db.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { deriveSeed } from "@oselya/sim";

export interface AuthedIdentity {
  userId: string;
  playerId: string;
  worldId: string;
}

const DEV_EMAIL = "dev@oselya.local";
const DEV_WORLD_NAME = "Dev World";

/**
 * Resolve a session token to an identity.
 *
 * MVP auth is a session + magic link by email (AGENT.md §2). In dev, `AUTH_DEV_AUTOLOGIN`
 * short-circuits the whole flow: any token (the client sends "dev") maps to a single seeded
 * dev user/player/world, created on first use. Real token verification lands with email delivery.
 */
export async function authenticate(token: string): Promise<AuthedIdentity | null> {
  if (config.authDevAutologin) {
    return getOrCreateDevIdentity();
  }

  // Real path (not yet implemented): verify token → session → user, look up player in world.
  logger.warn({ tokenLen: token.length }, "non-dev auth attempted but not implemented");
  return null;
}

export interface DevWorld {
  id: string;
  seed: number;
  /** Absolute ms at which season 0 (spring) began. */
  seasonStartedAt: number;
}

/** Ensure the singleton dev world exists, returning its id, seed and season epoch. */
export async function getOrCreateDevWorld(): Promise<DevWorld> {
  const existing = await db
    .select({
      id: schema.worlds.id,
      seed: schema.worlds.seed,
      seasonStartedAt: schema.worlds.seasonStartedAt,
    })
    .from(schema.worlds)
    .where(eq(schema.worlds.name, DEV_WORLD_NAME))
    .limit(1);
  if (existing[0]) {
    return {
      id: existing[0].id,
      seed: existing[0].seed,
      seasonStartedAt: existing[0].seasonStartedAt.getTime(),
    };
  }

  const seed = deriveSeed(1, DEV_WORLD_NAME);
  const [world] = await db
    .insert(schema.worlds)
    .values({ name: DEV_WORLD_NAME, seed, status: "running" })
    .returning({
      id: schema.worlds.id,
      seasonStartedAt: schema.worlds.seasonStartedAt,
    });
  logger.info({ worldId: world!.id, seed }, "created dev world");
  return { id: world!.id, seed, seasonStartedAt: world!.seasonStartedAt.getTime() };
}

async function getOrCreateDevIdentity(): Promise<AuthedIdentity> {
  const world = await getOrCreateDevWorld();

  const existingUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEV_EMAIL))
    .limit(1);

  let userId = existingUser[0]?.id;
  if (!userId) {
    const [user] = await db
      .insert(schema.users)
      .values({ email: DEV_EMAIL, name: "Dev Player" })
      .returning({ id: schema.users.id });
    userId = user!.id;
    logger.info({ userId }, "created dev user");
  }

  const existingPlayer = await db
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(and(eq(schema.players.userId, userId), eq(schema.players.worldId, world.id)))
    .limit(1);

  let playerId = existingPlayer[0]?.id;
  if (!playerId) {
    const [player] = await db
      .insert(schema.players)
      .values({ userId, worldId: world.id })
      .returning({ id: schema.players.id });
    playerId = player!.id;
    logger.info({ playerId }, "created dev player");
  }

  return { userId, playerId, worldId: world.id };
}
