// Desktop app (Tauri) bridge. The main window owns the timers and publishes
// their state every second: as the tray label (text in the macOS menu bar)
// and over D-Bus for the COSMIC panel applet, which sends button presses back.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Exercise } from "./exercises";

export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface DesktopState {
  moveRemaining: number; // ms, Infinity when the break is due
  eyeRemaining: number | null; // ms, null when eye breaks are off
  /** seconds left in a running eye break */
  eyeLeft: number | null;
  paused: boolean;
  mode: "idle" | "move" | "eye" | "routine" | "done";
  suggested: { name: string; minutes: number };
  /** the step being played, in "routine" mode */
  routine: { name: string; index: number; total: number; left: number; exercise: Exercise } | null;
  /** minutes moved, in "done" mode */
  doneMinutes: number | null;
  breaksToday: number;
}

/** What the applet (or tray) can ask for. "quit" is handled in Rust. */
export type DesktopAction =
  | "go" | "snooze" | "skip" | "eye-skip" | "open" | "break-now" | "pause" | "resume"
  | "next" | "stop" | "done-close";

export function onDesktopAction(cb: (a: DesktopAction) => void) {
  return listen<DesktopAction>("bouge:action", (e) => cb(e.payload));
}

let last = "";
let applet = false;

/** True while the COSMIC panel applet is showing Bouge (Linux/COSMIC only). */
export const appletActive = () => applet;

/** Bring the window to the front, for break time when there's no applet. */
export function showWindow() {
  invoke("show_window").catch(() => {});
}

export function publishState(title: string, tooltip: string, state: DesktopState) {
  const json = JSON.stringify({
    ...state,
    // seconds; -1 when the move break is due
    moveRemaining: isFinite(state.moveRemaining) ? Math.ceil(state.moveRemaining / 1000) : -1,
    eyeRemaining: state.eyeRemaining === null ? null : Math.ceil(state.eyeRemaining / 1000),
    title,
  });
  if (json === last) return;
  last = json;
  invoke<boolean>("publish_state", { title, tooltip, state: json })
    .then((active) => (applet = active))
    .catch(() => {});
}
