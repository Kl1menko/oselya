/**
 * Seeded PRNG. The ENTIRE simulation must use this — never `Math.random()` (AGENT.md §4.6),
 * so that offline catch-up, replays and tests are deterministic given a world seed.
 *
 * mulberry32: fast, good-enough distribution for game logic, 32-bit state.
 */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  /** Current internal state — persist this to resume a stream deterministically. */
  state(): number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(minInclusive: number, maxExclusive: number): number {
      if (maxExclusive <= minInclusive) return minInclusive;
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
    state(): number {
      return a >>> 0;
    },
  };
}

/**
 * Derive a stable sub-seed from a base seed and a string key (e.g. per-player, per-hex).
 * Deterministic: same inputs → same seed, no global state.
 */
export function deriveSeed(baseSeed: number, key: string): number {
  let h = baseSeed >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h >>> 0;
}
