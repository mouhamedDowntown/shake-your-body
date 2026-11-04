import { useEffect, useState } from "react";

/** 20-20-20 rule: look 6 m (20 ft) away for 20 seconds. */
export function EyeBreak({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [left, setLeft] = useState(20);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, onDone]);

  const progress = (20 - left) / 20;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-stone-200 dark:stroke-stone-800" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-sky-500 transition-all duration-1000 ease-linear"
            strokeDasharray={2 * Math.PI * 44}
            strokeDashoffset={2 * Math.PI * 44 * (1 - progress)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold tabular-nums">{left}</div>
      </div>
      <div>
        <h2 className="text-2xl font-semibold">👀 Eye break</h2>
        <p className="mt-2 text-stone-500">
          Look at something at least <strong>6 meters</strong> away — a window, the far wall.
          <br />
          Blink slowly a few times.
        </p>
      </div>
      <button onClick={onSkip} className="text-sm text-stone-500 underline-offset-4 hover:underline">
        Skip this one
      </button>
    </div>
  );
}
