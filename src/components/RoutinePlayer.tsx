import { EXERCISES, type Routine } from "../lib/exercises";
import { Figure } from "./Figure";

interface Props {
  routine: Routine;
  /** current step */
  index: number;
  /** seconds left on a timed exercise */
  left: number;
  onNext: () => void;
  onQuit: () => void;
  /** smaller figure and text, for the tray popup */
  compact?: boolean;
}

/** Shows one step of a routine with a demo figure. The step and countdown are
 *  owned by App, so the COSMIC applet can show (and drive) the same routine. */
export function RoutinePlayer({ routine, index, left, onNext: next, onQuit, compact = false }: Props) {
  const ex = EXERCISES[routine.steps[index]];
  const isLast = index === routine.steps.length - 1;

  const timedDone = ex.kind === "timed" && left <= 0;
  const count = ex.kind === "reps" ? `× ${ex.amount}` : `${Math.max(0, left)}s`;

  return (
    <div className={`flex flex-col items-center text-center ${compact ? "gap-2.5" : "gap-4"}`}>
      <div className="flex w-full items-center justify-between text-sm text-stone-500">
        <span>{routine.name}</span>
        <span>
          {index + 1} / {routine.steps.length}
        </span>
      </div>
      <div className="flex w-full gap-1" aria-hidden>
        {routine.steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-brand-600" : "bg-stone-200 dark:bg-stone-800"}`} />
        ))}
      </div>

      {compact ? (
        // tray popup: figure beside the name and count, two tips
        <>
          <div className="flex w-full items-center gap-3 text-left">
            <div className="shrink-0">
              <Figure exercise={ex} size={110} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">{ex.name}</h2>
              <div className="mt-1 text-4xl font-bold tabular-nums text-brand-700 dark:text-brand-500">{count}</div>
              <p className="mt-1 text-xs leading-snug text-stone-500">{ex.targets}</p>
            </div>
          </div>
          <ul className="w-full space-y-1 text-left text-xs text-stone-600 dark:text-stone-400">
            {ex.tips.slice(0, 2).map((tip) => (
              <li key={tip} className="flex gap-1.5">
                <span className="text-brand-600">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <Figure exercise={ex} size={220} />

          <div>
            <h2 className="text-2xl font-semibold">{ex.name}</h2>
            <p className="mt-1 text-sm text-stone-500">{ex.targets}</p>
          </div>

          <div className="text-5xl font-bold tabular-nums text-brand-700 dark:text-brand-500">{count}</div>

          <ul className="w-full space-y-1.5 rounded-xl bg-stone-100 p-4 text-left text-sm dark:bg-stone-800">
            {ex.tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="text-brand-600">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex w-full gap-3">
        <button onClick={onQuit} className={`rounded-xl px-4 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 ${compact ? "py-2" : "py-3"}`}>
          Stop
        </button>
        <button
          onClick={next}
          className={`flex-1 rounded-xl font-semibold ${compact ? "py-2" : "py-3"} text-white transition ${
            ex.kind === "timed" && !timedDone ? "bg-stone-400 dark:bg-stone-700" : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {ex.kind === "timed" && !timedDone ? "Skip" : isLast ? "Finish 🎉" : "Done — next"}
        </button>
      </div>
    </div>
  );
}
