export * from "./envelope.js";
export * from "./messages.js";

/** Protocol version — bump on any breaking change to the message shapes. */
export const PROTOCOL_VERSION = 1;

/** Rate limit for client commands (AGENT.md §4.4): 20 commands / 10s per connection. */
export const RATE_LIMIT = {
  maxCommands: 20,
  windowMs: 10_000,
} as const;
