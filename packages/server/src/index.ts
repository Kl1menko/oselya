import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { Connection } from "./world/connection.js";
import { handleMessage } from "./world/router.js";
import { TickLoop } from "./world/tickLoop.js";
import { SnapshotWriter } from "./persistence/snapshotWriter.js";
import { client as dbClient } from "./persistence/db.js";
import { SettlementRegistry } from "./world/settlementRegistry.js";
import type { ServerContext } from "./world/context.js";
import { getOrCreateDevWorld } from "./auth/auth.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

async function main(): Promise<void> {
  // Load the world so the sim context has its seed + season epoch (AGENT.md §4.2).
  const world = await getOrCreateDevWorld();
  const ctx: ServerContext = {
    settlements: new SettlementRegistry(world.seed, world.seasonStartedAt),
    seasonEpoch: world.seasonStartedAt,
  };

  const wss = new WebSocketServer({ port: config.serverPort });
  const connections = new Map<string, Connection>();

  const tickLoop = new TickLoop(ctx, connections);
  const snapshotWriter = new SnapshotWriter(ctx);

  wss.on("connection", (ws) => {
    const conn = new Connection(randomUUID(), ws);
    connections.set(conn.id, conn);
    logger.info({ connId: conn.id, total: connections.size }, "connection opened");

    ws.on("message", (data) => {
      void handleMessage(conn, data.toString(), ctx).catch((err) => {
        logger.error({ err, connId: conn.id }, "message handler error");
      });
    });

    // Server-driven liveness: mark dead if no pong between heartbeats.
    ws.on("pong", () => {
      conn.isAlive = true;
    });

    ws.on("close", () => {
      connections.delete(conn.id);
      logger.info({ connId: conn.id, total: connections.size }, "connection closed");
    });

    ws.on("error", (err) => {
      logger.warn({ err, connId: conn.id }, "connection error");
    });
  });

  // Heartbeat sweep: terminate connections that missed a pong, ping the rest.
  const heartbeat = setInterval(() => {
    for (const conn of connections.values()) {
      if (!conn.isAlive) {
        logger.info({ connId: conn.id }, "terminating dead connection");
        conn.ws.terminate();
        continue;
      }
      conn.isAlive = false;
      conn.ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  tickLoop.start();
  snapshotWriter.start();

  logger.info(
    { port: config.serverPort, env: config.nodeEnv, devAutologin: config.authDevAutologin },
    "oselya server listening",
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down");
    clearInterval(heartbeat);
    tickLoop.stop();
    snapshotWriter.stop();
    await snapshotWriter.flush(); // final flush (AGENT.md §8: graceful shutdown)
    for (const conn of connections.values()) conn.ws.close(1001, "server shutting down");
    wss.close();
    await dbClient.end({ timeout: 5 });
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error(err, "fatal startup error");
  process.exit(1);
});
