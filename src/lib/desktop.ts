// Desktop app (Tauri) bridge. The main window (usually hidden) owns the
// timers and publishes their state every second: as the tray label (text in
// the macOS menu bar), to the tray popup (Windows/macOS), and over D-Bus for
// the COSMIC panel applet. Both send button presses back as actions.

import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
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
  routine: { id: string; name: string; index: number; total: number; left: number; exercise: Exercise } | null;
  /** minutes moved, in "done" mode */
  doneMinutes: number | null;
  breaksToday: number;
}

/** What the applet (or tray) can ask for. "quit" is handled in Rust. */
export type DesktopAction =
  | "go" | `go:${string}` | "snooze" | "skip" | "eye-skip" | "open" | "break-now" | "pause" | "resume"
  | "next" | "stop" | "done-close";

/** The state as the applet / popup receive it (times in seconds). */
export type PublishedState = Omit<DesktopState, "moveRemaining" | "eyeRemaining"> & {
  /** seconds; -1 when the move break is due */
  moveRemaining: number;
  eyeRemaining: number | null;
  title: string;
};

export function onDesktopAction(cb: (a: DesktopAction) => void) {
  return listen<DesktopAction>("bouge:action", (e) => cb(e.payload));
}

let last = "";
let applet = false;

/** True while the COSMIC panel applet is showing Bouge (Linux/COSMIC only). */
export const appletActive = () => applet;

/** Open the tray popup — at break time, when there's no COSMIC applet. */
export function showPopup() {
  invoke("show_popup").catch(() => {});
}

export function publishState(title: string, tooltip: string, state: DesktopState) {
  const published: PublishedState = {
    ...state,
    // seconds; -1 when the move break is due
    moveRemaining: isFinite(state.moveRemaining) ? Math.ceil(state.moveRemaining / 1000) : -1,
    eyeRemaining: state.eyeRemaining === null ? null : Math.ceil(state.eyeRemaining / 1000),
    title,
  };
  const json = JSON.stringify(published);
  if (json === last) return;
  emitTo("popup", "bouge:state", json).catch(() => {});
  last = json;
  invoke<boolean>("publish_state", { title, tooltip, state: json })
    .then((active) => (applet = active))
    .catch(() => {});
}

// ---- used by the tray popup page ----

export function onPublishedState(cb: (s: PublishedState) => void) {
  return listen<string>("bouge:state", (e) => cb(JSON.parse(e.payload)));
}
export const sendAction = (a: DesktopAction) => emitTo("main", "bouge:action", a).catch(() => {});
export const hidePopup = () => invoke("hide_popup").catch(() => {});
export const fitPopup = (height: number) => invoke("fit_popup", { height }).catch(() => {});
export const openSettings = () => invoke("open_settings").catch(() => {});
export const quitApp = () => invoke("quit_app").catch(() => {});
