import { describe, it, expect } from "vitest";
import { seasonAt, SEASON_CYCLE_MS, SEASONS } from "./constants.js";

describe("seasonAt", () => {
  const quarter = SEASON_CYCLE_MS / SEASONS.length;

  it("starts at spring", () => {
    expect(seasonAt(0)).toBe("spring");
  });

  it("advances through all four seasons within one cycle", () => {
    expect(seasonAt(quarter * 0.5)).toBe("spring");
    expect(seasonAt(quarter * 1.5)).toBe("summer");
    expect(seasonAt(quarter * 2.5)).toBe("autumn");
    expect(seasonAt(quarter * 3.5)).toBe("winter");
  });

  it("wraps around after a full cycle", () => {
    expect(seasonAt(SEASON_CYCLE_MS)).toBe("spring");
    expect(seasonAt(SEASON_CYCLE_MS + quarter * 1.5)).toBe("summer");
  });
});
