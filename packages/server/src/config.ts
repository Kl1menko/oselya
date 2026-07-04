/** Environment configuration, validated once at startup. */

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const config = {
  nodeEnv: optional("NODE_ENV", "development"),
  isDev: optional("NODE_ENV", "development") !== "production",
  serverPort: Number(optional("SERVER_PORT", "8080")),
  authDevAutologin: optional("AUTH_DEV_AUTOLOGIN", "true") === "true",
  databaseUrl: required("DATABASE_URL"),
  redisUrl: optional("REDIS_URL", "redis://localhost:6379"),
} as const;
