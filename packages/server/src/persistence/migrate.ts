import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "../config.js";
import { logger } from "../logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "../../drizzle");

async function main(): Promise<void> {
  logger.info({ migrationsFolder }, "running migrations");
  const client = postgres(config.databaseUrl, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  await client.end();
  logger.info("migrations complete");
}

main().catch((err) => {
  logger.error(err, "migration failed");
  process.exit(1);
});
