import type { BreakRecord } from "./db";

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface Stats {
  moveToday: number;
  eyeToday: number;
  activeMinutesToday: number;
  streakDays: number;
  last7: { day: string; moves: number }[];
}

/**
 * Streak = consecutive days with at least one move break, ending today
 * (or yesterday, so the streak isn't "lost" first thing in the morning).
 */
export function computeStats(records: BreakRecord[], now = Date.now()): Stats {
  const today = dayKey(now);
  const movesByDay = new Map<string, number>();
  let moveToday = 0;
  let eyeToday = 0;
  let secondsToday = 0;

  for (const r of records) {
    const k = dayKey(r.at);
    if (r.type === "move") movesByDay.set(k, (movesByDay.get(k) ?? 0) + 1);
    if (k === today) {
      if (r.type === "move") {
        moveToday++;
        secondsToday += r.seconds;
      } else eyeToday++;
    }
  }

  const DAY = 86_400_000;
  let streakDays = 0;
  let cursor = movesByDay.has(today) ? now : now - DAY;
  while (movesByDay.has(dayKey(cursor))) {
    streakDays++;
    cursor -= DAY;
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const k = dayKey(now - (6 - i) * DAY);
    return { day: k, moves: movesByDay.get(k) ?? 0 };
  });

  return { moveToday, eyeToday, activeMinutesToday: Math.round(secondsToday / 60), streakDays, last7 };
}
