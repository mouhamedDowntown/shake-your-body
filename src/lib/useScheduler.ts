import { useCallback, useEffect, useRef, useState } from "react";
import type { Settings } from "./settings";

const MIN = 60_000;

export type Due = "move" | "eye" | null;

/**
 * Keeps two timers (move + eye) based on absolute timestamps, so they stay
 * accurate even when the browser throttles background tabs.
 */
export function useScheduler(settings: Settings, onDue: (kind: "move" | "eye") => void) {
  const [now, setNow] = useState(Date.now());
  const [nextMoveAt, setNextMoveAt] = useState(() => Date.now() + settings.moveEveryMin * MIN);
  const [nextEyeAt, setNextEyeAt] = useState(() => Date.now() + settings.eyeEveryMin * MIN);
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState<{ move: number; eye: number } | null>(null);
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue;

  const paused = pausedRemaining !== null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Reset timers when the intervals change in settings
  useEffect(() => {
    if (paused) return;
    setNextMoveAt(Date.now() + settings.moveEveryMin * MIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.moveEveryMin]);
  useEffect(() => {
    if (paused) return;
    setNextEyeAt(Date.now() + settings.eyeEveryMin * MIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.eyeEveryMin]);

  const resume = useCallback(() => {
    if (pausedRemaining) {
      setNextMoveAt(Date.now() + pausedRemaining.move);
      setNextEyeAt(Date.now() + pausedRemaining.eye);
    }
    setPausedRemaining(null);
    setPausedUntil(null);
  }, [pausedRemaining]);

  // Fire due events
  useEffect(() => {
    if (pausedUntil && now >= pausedUntil) {
      resume();
      return;
    }
    if (paused) return;
    if (now >= nextMoveAt) {
      setNextMoveAt(Infinity); // wait until the user handles it
      onDueRef.current("move");
    } else if (settings.eyeBreaksOn && now >= nextEyeAt) {
      setNextEyeAt(now + settings.eyeEveryMin * MIN);
      onDueRef.current("eye");
    }
  }, [now, nextMoveAt, nextEyeAt, paused, pausedUntil, settings.eyeBreaksOn, settings.eyeEveryMin, resume]);

  const pause = useCallback(
    (forMinutes?: number) => {
      setPausedRemaining({ move: Math.max(0, nextMoveAt - Date.now()), eye: Math.max(0, nextEyeAt - Date.now()) });
      setPausedUntil(forMinutes ? Date.now() + forMinutes * MIN : null);
    },
    [nextMoveAt, nextEyeAt],
  );

  const restartMove = useCallback((inMinutes = settings.moveEveryMin) => {
    setNextMoveAt(Date.now() + inMinutes * MIN);
  }, [settings.moveEveryMin]);

  const restartEye = useCallback(() => {
    setNextEyeAt(Date.now() + settings.eyeEveryMin * MIN);
  }, [settings.eyeEveryMin]);

  return {
    now,
    moveRemaining: paused ? pausedRemaining!.move : Math.max(0, nextMoveAt - now),
    eyeRemaining: paused ? pausedRemaining!.eye : Math.max(0, nextEyeAt - now),
    paused,
    pausedUntil,
    pause,
    resume,
    restartMove,
    restartEye,
  };
}

export function formatMs(ms: number) {
  if (!isFinite(ms)) return "now";
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
