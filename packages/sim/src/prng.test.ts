import { describe, it, expect } from "vitest";
import { mulberry32, deriveSeed } from "./prng.js";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("produces floats in [0, 1)", () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() stays within [min, max)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(8);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("int() with degenerate range returns min", () => {
    const rng = mulberry32(7);
    expect(rng.int(5, 5)).toBe(5);
    expect(rng.int(5, 4)).toBe(5);
  });

  it("state() lets a stream be resumed deterministically", () => {
    const a = mulberry32(42);
    a.next();
    a.next();
    const resumed = mulberry32(a.state());
    const b = mulberry32(42);
    b.next();
    b.next();
    expect(resumed.next()).toEqual(b.next());
  });
});

describe("deriveSeed", () => {
  it("is stable for the same inputs", () => {
    expect(deriveSeed(100, "player:1")).toEqual(deriveSeed(100, "player:1"));
  });

  it("differs by key and by base", () => {
    expect(deriveSeed(100, "player:1")).not.toEqual(deriveSeed(100, "player:2"));
    expect(deriveSeed(100, "player:1")).not.toEqual(deriveSeed(101, "player:1"));
  });
});
