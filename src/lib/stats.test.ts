import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";
import type { BreakRecord } from "./db";

const DAY = 86_400_000;
const now = new Date(2026, 10, 4, 15, 0).getTime();
const move = (at: number): BreakRecord => ({ type: "move", at, seconds: 120 });

describe("computeStats", () => {
  it("counts today's breaks and active minutes", () => {
    const s = computeStats([move(now - 1000), move(now - 2000), { type: "eye", at: now, seconds: 20 }], now);
    expect(s.moveToday).toBe(2);
    expect(s.eyeToday).toBe(1);
    expect(s.activeMinutesToday).toBe(4);
  });

  it("counts a streak of consecutive days", () => {
    const s = computeStats([move(now), move(now - DAY), move(now - 2 * DAY), move(now - 4 * DAY)], now);
    expect(s.streakDays).toBe(3);
  });

  it("keeps yesterday's streak alive before today's first break", () => {
    const s = computeStats([move(now - DAY), move(now - 2 * DAY)], now);
    expect(s.streakDays).toBe(2);
  });

  it("returns zero streak with no breaks", () => {
    expect(computeStats([], now).streakDays).toBe(0);
  });
});
