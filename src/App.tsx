import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, logBreak } from "./lib/db";
import { computeStats } from "./lib/stats";
import { estimateSeconds, ROUTINES, suggestRoutine, type Routine } from "./lib/exercises";
import { loadSettings, saveSettings, type Settings } from "./lib/settings";
import { chime, notificationPermission, notify, requestNotifications } from "./lib/notify";
import { formatMs, useScheduler } from "./lib/useScheduler";
import { RoutinePlayer } from "./components/RoutinePlayer";
import { EyeBreak } from "./components/EyeBreak";
import { openPip, pipSupported } from "./lib/pip";

type Overlay = { kind: "bubble" } | { kind: "player"; routine: Routine } | { kind: "eye" } | { kind: "done"; seconds: number } | null;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [perm, setPerm] = useState(notificationPermission());
  const [showSettings, setShowSettings] = useState(false);

  const records = useLiveQuery(() => db.breaks.toArray().catch(() => []), [], []);
  const stats = computeStats(records);
  const suggested = suggestRoutine(stats.moveToday);

  useEffect(() => saveSettings(settings), [settings]);

  // Always-on-top floating window, so reminders show over other apps
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const unloading = useRef(false);
  useEffect(() => {
    const h = () => (unloading.current = true);
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, []);

  const openFloat = useCallback(async () => {
    try {
      const w = await openPip();
      if (!w) return;
      w.addEventListener(
        "pagehide",
        () => {
          setPipWin(null);
          // closed by the user (not by reloading the app) → stop auto-reopening
          if (!unloading.current) setSettings((s) => ({ ...s, floatOn: false }));
        },
        { once: true },
      );
      setPipWin(w);
      setSettings((s) => ({ ...s, floatOn: true }));
    } catch {
      /* needs a user gesture, or the browser refused */
    }
  }, []);

  const toggleFloat = () => (pipWin ? pipWin.close() : openFloat());

  // The browser only opens the window on a user gesture: after a reload,
  // reopen it on the first click anywhere in the page.
  useEffect(() => {
    if (!settings.floatOn || pipWin || !pipSupported()) return;
    const h = () => openFloat();
    document.addEventListener("pointerdown", h, { once: true });
    return () => document.removeEventListener("pointerdown", h);
  }, [settings.floatOn, pipWin, openFloat]);

  const onDue = useCallback(
    (kind: "move" | "eye") => {
      if (settings.soundOn) chime();
      if (kind === "move") {
        notify("Time to move 🏃", `${suggested.name} — ${Math.round(estimateSeconds(suggested) / 60)} min. Your body will thank you.`, () =>
          setOverlay({ kind: "bubble" }),
          true,
        );
        setOverlay((o) => (o?.kind === "player" ? o : { kind: "bubble" }));
      } else {
        notify("Eye break 👀", "Look 6 meters away for 20 seconds.", () => setOverlay({ kind: "eye" }));
        if (document.visibilityState === "visible" || pipWin) setOverlay((o) => o ?? { kind: "eye" });
      }
    },
    [settings.soundOn, suggested, pipWin],
  );

  const sched = useScheduler(settings, onDue);

  const startRoutine = (routine: Routine) => setOverlay({ kind: "player", routine });

  const finishRoutine = async (routine: Routine, seconds: number) => {
    await logBreak({ type: "move", routineId: routine.id, at: Date.now(), seconds });
    sched.restartMove();
    sched.restartEye(); // you just looked away from the screen too
    setOverlay({ kind: "done", seconds });
  };

  const eyeDone = useCallback(() => {
    logBreak({ type: "eye", at: Date.now(), seconds: 20 });
    setOverlay(null);
  }, []);

  const closeOverlay = () => {
    if (overlay?.kind === "bubble" || overlay?.kind === "player") sched.restartMove();
    setOverlay(null);
  };

  const moveTotal = settings.moveEveryMin * 60_000;
  const moveProgress = isFinite(sched.moveRemaining) ? 1 - sched.moveRemaining / moveTotal : 1;
  const maxBar = Math.max(4, ...stats.last7.map((d) => d.moves));

  // Grow the floating window for the routine player, shrink it back after
  useEffect(() => {
    if (!pipWin) return;
    const big = overlay?.kind === "player";
    try {
      pipWin.resizeTo(big ? 440 : 340, big ? 720 : 460);
    } catch {
      /* resizing needs a recent user gesture */
    }
  }, [pipWin, overlay?.kind]);

  const overlayBody = overlay && (
    <>
            {overlay.kind === "bubble" && (
              <div className="flex flex-col gap-4 text-center">
                <div className="text-5xl">🏃</div>
                <h2 className="text-2xl font-semibold">Time to move!</h2>
                <p className="text-stone-500">
                  You've been sitting for a while. Suggested: <strong>{suggested.name}</strong> (~{Math.round(estimateSeconds(suggested) / 60)} min).
                </p>
                <button onClick={() => startRoutine(suggested)} className="rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">
                  Let's go
                </button>
                <div className="flex gap-2">
                  {ROUTINES.filter((r) => r.id !== suggested.id).map((r) => (
                    <button key={r.id} onClick={() => startRoutine(r)} className="flex-1 rounded-xl py-2 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
                      {r.name}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center gap-4 text-sm text-stone-500">
                  <button onClick={() => { sched.restartMove(5); setOverlay(null); }} className="hover:underline">Snooze 5 min</button>
                  <button onClick={closeOverlay} className="hover:underline">Skip</button>
                </div>
              </div>
            )}
            {overlay.kind === "player" && (
              <RoutinePlayer routine={overlay.routine} onFinish={(s) => finishRoutine(overlay.routine, s)} onQuit={closeOverlay} />
            )}
            {overlay.kind === "eye" && <EyeBreak onDone={eyeDone} onSkip={() => setOverlay(null)} />}
            {overlay.kind === "done" && (
              <div className="flex flex-col gap-4 text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="text-2xl font-semibold">Nice work!</h2>
                <p className="text-stone-500">
                  {Math.max(1, Math.round(overlay.seconds / 60))} min of movement. That's break #{stats.moveToday} today.
                </p>
                <button onClick={() => setOverlay(null)} className="rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">
                  Back to work
                </button>
              </div>
            )}
    </>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bouge</h1>
            <p className="text-sm text-stone-500">Move more, sit less, rest your eyes.</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          ⚙️ Settings
        </button>
      </header>

      {perm !== "granted" && perm !== "unsupported" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span>Turn on notifications so Bouge can remind you even when this tab is in the background.</span>
          <button
            onClick={async () => setPerm(await requestNotifications())}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 font-medium text-white hover:bg-amber-600"
          >
            Enable
          </button>
        </div>
      )}

      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} />}

      {/* Timer card */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
        <div className="flex items-center gap-6">
          <Ring progress={moveProgress}>
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums">{formatMs(sched.moveRemaining)}</div>
              <div className="text-xs text-stone-500">{sched.paused ? "paused" : "until next break"}</div>
            </div>
          </Ring>
          <div className="flex flex-1 flex-col gap-3">
            {settings.eyeBreaksOn && (
              <div className="text-sm text-stone-500">
                👀 Eye break in <span className="font-semibold tabular-nums text-stone-800 dark:text-stone-200">{formatMs(sched.eyeRemaining)}</span>
              </div>
            )}
            {sched.pausedUntil && (
              <div className="text-sm text-stone-500">
                Meeting mode until {new Date(sched.pausedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setOverlay({ kind: "bubble" })} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Break now
              </button>
              {sched.paused ? (
                <button onClick={sched.resume} className="rounded-lg px-4 py-2 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
                  ▶ Resume
                </button>
              ) : (
                <>
                  <button onClick={() => sched.pause()} className="rounded-lg px-4 py-2 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
                    ⏸ Pause
                  </button>
                  <button onClick={() => sched.pause(60)} className="rounded-lg px-4 py-2 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
                    📅 In a meeting (1h)
                  </button>
                </>
              )}
              {pipSupported() && (
                <button
                  onClick={toggleFloat}
                  title="A small always-on-top window, so the reminder shows even when you're in another app"
                  className="rounded-lg px-4 py-2 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800"
                >
                  {pipWin ? "✕ Close floating timer" : "📌 Float on top"}
                </button>
              )}
            </div>
            {pipWin && overlay && <div className="text-sm text-stone-500">Your break is open in the floating window.</div>}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Breaks today" value={stats.moveToday} />
        <Stat label="Day streak" value={`${stats.streakDays}🔥`} />
        <Stat label="Eye breaks" value={stats.eyeToday} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
        <h3 className="mb-3 text-sm font-medium text-stone-500">Move breaks — last 7 days</h3>
        <div className="flex h-24 items-end gap-2">
          {stats.last7.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-brand-500" style={{ height: `${(d.moves / maxBar) * 72}px`, minHeight: d.moves ? 4 : 2, opacity: d.moves ? 1 : 0.25 }} title={`${d.moves} breaks`} />
              <span className="text-[10px] text-stone-500">{new Date(d.day + "T12:00").toLocaleDateString([], { weekday: "short" })}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Routines */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-stone-500">Routines</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {ROUTINES.map((r) => (
            <button
              key={r.id}
              onClick={() => startRoutine(r)}
              className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 transition hover:ring-brand-500 dark:bg-stone-900 dark:ring-stone-800"
            >
              <div className="font-semibold">{r.name}</div>
              <div className="mt-1 text-xs text-stone-500">{r.blurb}</div>
              <div className="mt-3 text-xs font-medium text-brand-700 dark:text-brand-500">
                ~{Math.round(estimateSeconds(r) / 60)} min · {r.steps.length} moves
              </div>
            </button>
          ))}
        </div>
      </section>

      {overlay && !pipWin && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-stone-900">
            {overlayBody}
          </div>
        </div>
      )}

      {pipWin &&
        createPortal(
          overlay ? (
            <div className="flex min-h-screen items-center p-4">
              <div className="w-full">{overlayBody}</div>
            </div>
          ) : (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
              <Ring progress={moveProgress}>
                <div className="text-center">
                  <div className="text-3xl font-bold tabular-nums">{formatMs(sched.moveRemaining)}</div>
                  <div className="text-xs text-stone-500">{sched.paused ? "paused" : "until next break"}</div>
                </div>
              </Ring>
              {settings.eyeBreaksOn && (
                <div className="text-sm text-stone-500">
                  👀 Eye break in <span className="font-semibold tabular-nums">{formatMs(sched.eyeRemaining)}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setOverlay({ kind: "bubble" })} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Break now
                </button>
                <button onClick={sched.paused ? sched.resume : () => sched.pause()} className="rounded-lg px-4 py-2 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800">
                  {sched.paused ? "▶ Resume" : "⏸ Pause"}
                </button>
              </div>
            </div>
          ),
          pipWin.document.body,
        )}
    </div>
  );
}

function Ring({ progress, children }: { progress: number; children: ReactNode }) {
  const c = 2 * Math.PI * 44;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" className="stroke-stone-200 dark:stroke-stone-800" />
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-brand-600 transition-all duration-1000 ease-linear" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  return (
    <section className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:grid-cols-2 dark:bg-stone-900 dark:ring-stone-800">
      <label className="flex flex-col gap-1 text-sm">
        Move break every
        <select value={settings.moveEveryMin} onChange={(e) => set("moveEveryMin", Number(e.target.value))} className="rounded-lg border border-stone-300 bg-transparent p-2 dark:border-stone-700">
          {[1, 20, 30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>{m} min{m === 1 ? " (testing)" : ""}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Eye break every
        <select value={settings.eyeEveryMin} onChange={(e) => set("eyeEveryMin", Number(e.target.value))} className="rounded-lg border border-stone-300 bg-transparent p-2 dark:border-stone-700">
          {[1, 20, 30].map((m) => (
            <option key={m} value={m}>{m} min{m === 1 ? " (testing)" : ""}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.eyeBreaksOn} onChange={(e) => set("eyeBreaksOn", e.target.checked)} className="accent-brand-600" />
        Eye breaks (20-20-20 rule)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.soundOn} onChange={(e) => set("soundOn", e.target.checked)} className="accent-brand-600" />
        Sound chime
      </label>
    </section>
  );
}
