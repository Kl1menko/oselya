import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

/** Single shared connection pool for the process. */
const client = postgres(config.databaseUrl, { max: 10 });

export const db = drizzle(client, { schema });
export { client, schema };
