import { z } from "zod";

/**
 * Every WebSocket message is a JSON envelope: { t, seq, d }.
 *   t   — message type (see ClientMessageType / ServerMessageType)
 *   seq — monotonically increasing per connection; server echoes it in cmd.rejected etc.
 *   d   — type-specific payload
 *
 * MVP is JSON; a binary protocol may replace this later (see AGENT.md §4.4).
 */
export const envelopeSchema = z.object({
  t: z.string().min(1),
  seq: z.number().int().nonnegative(),
  d: z.unknown(),
});

export type Envelope<T extends string = string, D = unknown> = {
  t: T;
  seq: number;
  d: D;
};

export function makeEnvelope<T extends string, D>(t: T, seq: number, d: D): Envelope<T, D> {
  return { t, seq, d };
}
