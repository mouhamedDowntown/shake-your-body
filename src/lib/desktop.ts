// Bridge between the main window and the floating pill in the desktop app
// (Tauri). The main window owns the timers and sends its state to the pill
// every second; the pill sends back what the user clicked.

import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";

export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface PillState {
  moveRemaining: number; // ms, Infinity when the break is due
  eyeRemaining: number | null; // null when eye breaks are off
  paused: boolean;
  /** what the pill should show right now */
  mode: "idle" | "move" | "eye" | "routine";
  suggested: { name: string; minutes: number };
}

export type PillAction = "go" | "snooze" | "skip" | "eye-done" | "eye-skip" | "open";

const STATE = "bouge:state";
const ACTION = "bouge:action";

export function sendPillState(state: PillState) {
  // Infinity doesn't survive JSON
  emitTo("pill", STATE, { ...state, moveRemaining: isFinite(state.moveRemaining) ? state.moveRemaining : -1 }).catch(() => {});
}

export function onPillState(cb: (s: PillState) => void) {
  return listen<PillState>(STATE, (e) => cb({ ...e.payload, moveRemaining: e.payload.moveRemaining < 0 ? Infinity : e.payload.moveRemaining }));
}

export function sendPillAction(action: PillAction) {
  emitTo("main", ACTION, action).catch(() => {});
}

export function onPillAction(cb: (a: PillAction) => void) {
  return listen<PillAction>(ACTION, (e) => cb(e.payload));
}

export async function showMainWindow() {
  const { Window } = await import("@tauri-apps/api/window");
  const main = await Window.getByLabel("main");
  await main?.show();
  await main?.unminimize();
  await main?.setFocus();
}

let lastTitle = "";
/** Label next to the tray icon in the top bar, e.g. "🏃 12:34". */
export function setTrayTitle(title: string, tooltip: string) {
  if (title === lastTitle) return;
  lastTitle = title;
  invoke("set_tray_title", { title, tooltip }).catch(() => {});
}
