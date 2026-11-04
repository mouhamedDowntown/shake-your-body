import Dexie, { type EntityTable } from "dexie";

export interface BreakRecord {
  id?: number;
  type: "move" | "eye";
  routineId?: string;
  at: number; // epoch ms
  seconds: number;
}

class BougeDB extends Dexie {
  breaks!: EntityTable<BreakRecord, "id">;
  constructor() {
    super("bouge");
    this.version(1).stores({ breaks: "++id, type, at" });
  }
}

export const db = new BougeDB();

export async function logBreak(rec: Omit<BreakRecord, "id">) {
  try {
    await db.breaks.add(rec);
  } catch (err) {
    // Private mode or blocked storage: the app still works, stats just aren't kept.
    console.warn("Could not save break", err);
  }
}
