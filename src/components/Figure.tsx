import { useEffect, useRef, useState } from "react";
import type { Exercise, Point, Pose } from "../lib/exercises";

const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function blend(a: Pose, b: Pose, t: number) {
  return {
    head: lerp(a.head, b.head, t),
    neck: lerp(a.neck, b.neck, t),
    elbow: lerp(a.elbow, b.elbow, t),
    hand: lerp(a.hand, b.hand, t),
    hip: lerp(a.hip, b.hip, t),
    knee: lerp(a.knee, b.knee, t),
    foot: lerp(a.foot, b.foot, t),
    elbow2: lerp(a.elbow2 ?? a.elbow, b.elbow2 ?? b.elbow, t),
    hand2: lerp(a.hand2 ?? a.hand, b.hand2 ?? b.hand, t),
    knee2: lerp(a.knee2 ?? a.knee, b.knee2 ?? b.knee, t),
    foot2: lerp(a.foot2 ?? a.foot, b.foot2 ?? b.foot, t),
  };
}

const path = (...pts: Point[]) => "M" + pts.map((p) => p.join(" ")).join(" L");

/** Animated stick figure showing the body position for an exercise. */
export function Figure({ exercise, playing = true, size = 220 }: { exercise: Exercise; playing?: boolean; size?: number }) {
  const [t, setT] = useState(0);
  const start = useRef(performance.now());
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    start.current = performance.now();
    if (!playing || reduceMotion) {
      setT(0.5);
      return;
    }
    let raf = 0;
    const loop = (now: number) => {
      const phase = ((now - start.current) / 1000 / exercise.tempo) * Math.PI * 2;
      setT((1 - Math.cos(phase)) / 2); // smooth 0 → 1 → 0
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [exercise, playing, reduceMotion]);

  const p = blend(exercise.poses[0], exercise.poses[1], t);

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${exercise.name} demonstration`}>
      <line x1="10" y1="184" x2="190" y2="184" className="stroke-stone-300 dark:stroke-stone-700" strokeWidth="3" strokeLinecap="round" />
      {exercise.prop === "desk" && (
        <g className="fill-stone-200 stroke-stone-400 dark:fill-stone-800 dark:stroke-stone-600" strokeWidth="2">
          <rect x="162" y="120" width="34" height="6" rx="2" />
          <line x1="190" y1="126" x2="190" y2="184" />
        </g>
      )}
      <g fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        {/* far limbs, lighter */}
        <path d={path(p.hip, p.knee2, p.foot2)} className="stroke-brand-500/50" />
        <path d={path(p.neck, p.elbow2, p.hand2)} className="stroke-brand-500/50" />
        {/* torso + near limbs */}
        <path d={path(p.neck, p.hip)} className="stroke-brand-700 dark:stroke-brand-500" />
        <path d={path(p.hip, p.knee, p.foot)} className="stroke-brand-700 dark:stroke-brand-500" />
        <path d={path(p.neck, p.elbow, p.hand)} className="stroke-brand-700 dark:stroke-brand-500" />
      </g>
      <circle cx={p.head[0]} cy={p.head[1]} r="12" className="fill-brand-700 dark:fill-brand-500" />
    </svg>
  );
}
