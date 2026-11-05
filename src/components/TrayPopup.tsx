import { useEffect, useRef, useState, type ReactNode } from "react";
import { estimateSeconds, ROUTINES } from "../lib/exercises";
import {
  fitPopup,
  hidePopup,
  onPublishedState,
  openSettings,
  quitApp,
  sendAction,
  type DesktopAction,
  type PublishedState,
} from "../lib/desktop";
import { formatMs } from "../lib/useScheduler";
import { RoutinePlayer } from "./RoutinePlayer";

const secs = (s: number) => (s < 0 ? "now" : formatMs(s * 1000));

/**
 * The tray popup on Windows / macOS (and Linux desktops without the COSMIC
 * applet): drops down from the tray icon, shows the countdown, and plays
 * breaks right here. Same content as the COSMIC applet's popup.
 */
export function TrayPopup() {
  const [s, setS] = useState<PublishedState | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const un = onPublishedState(setS);
    return () => void un.then((f) => f());
  }, []);

  // Keep the window exactly as tall as the content
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitPopup(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** send an action; the ones that end the interaction close the popup */
  const act = (a: DesktopAction, close = false) => {
    sendAction(a);
    if (close) hidePopup();
  };

  return (
    <div ref={root} className="select-none bg-white p-4 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
      {!s ? (
        <p className="py-6 text-center text-sm text-stone-500">Starting Bouge…</p>
      ) : s.mode === "routine" && s.routine ? (
        <RoutineStep s={s} act={act} />
      ) : s.mode === "move" ? (
        <Card>
          <div className="text-4xl">🏃</div>
          <h2 className="text-xl font-semibold">Time to move!</h2>
          <p className="text-sm text-stone-500">
            Suggested: <strong>{s.suggested.name}</strong> (~{s.suggested.minutes} min)
          </p>
          <Primary onClick={() => act("go")}>Let's go</Primary>
          <div className="flex gap-2">
            {ROUTINES.filter((r) => r.name !== s.suggested.name).map((r) => (
              <button key={r.id} onClick={() => act(`go:${r.id}`)} className="flex-1 rounded-lg py-1.5 text-xs ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
                {r.name} · {Math.round(estimateSeconds(r) / 60)} min
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-4 text-sm text-stone-500">
            <button onClick={() => act("snooze", true)} className="hover:underline">Snooze 5 min</button>
            <button onClick={() => act("skip", true)} className="hover:underline">Skip</button>
          </div>
        </Card>
      ) : s.mode === "eye" ? (
        <Card>
          <div className="text-4xl">👀</div>
          <h2 className="text-xl font-semibold">Eye break</h2>
          <div className="text-4xl font-bold tabular-nums text-sky-500">{s.eyeLeft ?? 0}s</div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
            <div className="h-full bg-sky-500 transition-all duration-1000 ease-linear" style={{ width: `${((20 - (s.eyeLeft ?? 0)) / 20) * 100}%` }} />
          </div>
          <p className="text-sm text-stone-500">Look at something at least 6 meters away.</p>
          <button onClick={() => act("eye-skip", true)} className="text-sm text-stone-500 hover:underline">Skip</button>
        </Card>
      ) : s.mode === "done" ? (
        <Card>
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-semibold">Nice work!</h2>
          <p className="text-sm text-stone-500">
            {s.doneMinutes ?? 1} min of movement. That's break #{s.breaksToday} today.
          </p>
          <Primary onClick={() => act("done-close", true)}>Back to work</Primary>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs text-stone-500">{s.paused ? "Paused" : "Next move break"}</div>
              <div className="text-3xl font-bold tabular-nums">{s.paused ? "⏸" : secs(s.moveRemaining)}</div>
            </div>
            {s.eyeRemaining !== null && !s.paused && (
              <div className="text-right text-sm text-stone-500">
                👀 Eye break
                <div className="font-semibold tabular-nums text-stone-800 dark:text-stone-200">{secs(s.eyeRemaining)}</div>
              </div>
            )}
          </div>
          <div className="text-xs text-stone-500">{s.breaksToday} breaks today</div>
          <div className="flex gap-2">
            <Primary onClick={() => act("break-now")}>Break now</Primary>
            <button onClick={() => act(s.paused ? "resume" : "pause")} className="rounded-lg px-3 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
              {s.paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-3 text-sm dark:border-stone-800">
            <button onClick={() => openSettings()} className="text-stone-600 hover:underline dark:text-stone-400">Settings & stats</button>
            <button onClick={() => quitApp()} className="text-red-600 hover:underline">Quit Bouge</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoutineStep({ s, act }: { s: PublishedState; act: (a: DesktopAction, close?: boolean) => void }) {
  const r = s.routine!;
  const routine = ROUTINES.find((x) => x.id === r.id);
  if (!routine) return null;
  return <RoutinePlayer routine={routine} index={r.index} left={r.left} onNext={() => act("next")} onQuit={() => act("stop", true)} compact />;
}

const Card = ({ children }: { children: ReactNode }) => <div className="flex flex-col items-center gap-3 text-center">{children}</div>;

const Primary = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} className="w-full flex-1 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700">
    {children}
  </button>
);
