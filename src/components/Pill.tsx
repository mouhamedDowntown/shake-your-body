import { useEffect, useState } from "react";
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import { onPillState, sendPillAction, showMainWindow, type PillAction, type PillState } from "../lib/desktop";
import { formatMs } from "../lib/useScheduler";

// Window size for each mode, in logical pixels. The window is resized to fit
// the pill exactly, so it never blocks clicks on the apps underneath.
const SIZES: Record<PillState["mode"], [number, number]> = {
  idle: [230, 44],
  routine: [230, 44],
  move: [380, 184],
  eye: [340, 116],
};

/** Always-on-top pill at the top centre of the screen (desktop app only). */
export function Pill() {
  const [state, setState] = useState<PillState | null>(null);
  const mode = state?.mode ?? "idle";

  useEffect(() => {
    const un = onPillState(setState);
    return () => void un.then((f) => f());
  }, []);

  // Grow / shrink and stay centred at the top of the screen
  useEffect(() => {
    const [w, h] = SIZES[mode];
    (async () => {
      const win = getCurrentWindow();
      await win.setSize(new LogicalSize(w, h));
      const mon = await currentMonitor();
      if (!mon) return;
      const x = mon.position.x + Math.round((mon.size.width - w * mon.scaleFactor) / 2);
      const y = mon.position.y + Math.round(8 * mon.scaleFactor);
      await win.setPosition(new PhysicalPosition(x, y));
    })().catch(() => {});
  }, [mode]);

  const act = (a: PillAction) => {
    if (a === "go" || a === "open") showMainWindow().catch(() => {});
    sendPillAction(a);
  };

  return (
    <div className="h-screen w-screen select-none overflow-hidden rounded-[22px] bg-black text-white">
      {mode === "move" && state ? (
        <div className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏃</span>
            <div>
              <div className="font-semibold">Time to move!</div>
              <div className="text-sm text-stone-400">
                {state.suggested.name} · ~{state.suggested.minutes} min
              </div>
            </div>
          </div>
          <button onClick={() => act("go")} className="rounded-xl bg-brand-600 py-2 font-semibold hover:bg-brand-500">
            Let's go
          </button>
          <div className="flex justify-center gap-5 text-sm text-stone-400">
            <button onClick={() => act("snooze")} className="hover:text-white">Snooze 5 min</button>
            <button onClick={() => act("skip")} className="hover:text-white">Skip</button>
          </div>
        </div>
      ) : mode === "eye" ? (
        <EyeCountdown onDone={() => act("eye-done")} onSkip={() => act("eye-skip")} />
      ) : (
        <button onClick={() => act("open")} className="flex h-full w-full items-center justify-center gap-3 text-sm tabular-nums">
          {!state ? (
            <span>Bouge</span>
          ) : mode === "routine" ? (
            <span>🏃 Break in progress…</span>
          ) : (
            <>
              <span>
                🏃 <span className="font-semibold">{state.paused ? "paused" : formatMs(state.moveRemaining)}</span>
              </span>
              {state.eyeRemaining !== null && !state.paused && (
                <span className="text-stone-400">👀 {formatMs(state.eyeRemaining)}</span>
              )}
            </>
          )}
        </button>
      )}
    </div>
  );
}

function EyeCountdown({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [left, setLeft] = useState(20);
  useEffect(() => {
    if (left <= 0) return onDone();
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  return (
    <div className="flex h-full items-center gap-4 px-5">
      <div className="text-4xl font-bold tabular-nums text-sky-400">{left}</div>
      <div className="flex-1">
        <div className="font-semibold">👀 Eye break</div>
        <div className="text-sm text-stone-400">Look at something 6 m away.</div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-stone-800">
          <div className="h-full bg-sky-400 transition-all duration-1000 ease-linear" style={{ width: `${((20 - left) / 20) * 100}%` }} />
        </div>
      </div>
      <button onClick={onSkip} className="text-sm text-stone-400 hover:text-white">Skip</button>
    </div>
  );
}
