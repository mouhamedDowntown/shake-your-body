// Exercise library. Each exercise has two body poses (A and B) that the
// stick figure animates between, so the user can see the movement.
// Coordinates live in a 200x200 viewBox, side view, facing right.

export type Point = [number, number];

export interface Pose {
  head: Point;
  neck: Point;
  elbow: Point;
  hand: Point;
  hip: Point;
  knee: Point;
  foot: Point;
  // Second arm / leg. Defaults to the first one when omitted.
  elbow2?: Point;
  hand2?: Point;
  knee2?: Point;
  foot2?: Point;
}

export type Prop = "desk" | "wall" | "eyes";

export interface Exercise {
  id: string;
  name: string;
  kind: "reps" | "timed";
  /** reps count, or seconds for timed exercises */
  amount: number;
  /** seconds per rep, used for animation speed */
  tempo: number;
  tips: string[];
  targets: string;
  poses: [Pose, Pose];
  prop?: Prop;
}

const standing: Pose = {
  head: [100, 40],
  neck: [100, 58],
  elbow: [100, 84],
  hand: [100, 108],
  hip: [100, 110],
  knee: [100, 145],
  foot: [100, 180],
};

const pose = (over: Partial<Pose>): Pose => ({ ...standing, ...over });

export const EXERCISES: Record<string, Exercise> = {
  squat: {
    id: "squat",
    name: "Squats",
    kind: "reps",
    amount: 12,
    tempo: 2.4,
    targets: "Legs and glutes — the muscles sitting switches off",
    tips: [
      "Feet shoulder-width apart, toes slightly out",
      "Push your hips back like sitting on a chair",
      "Knees follow your toes, back stays straight",
    ],
    poses: [
      pose({ elbow: [118, 66], hand: [140, 66] }),
      pose({
        head: [110, 72],
        neck: [102, 88],
        elbow: [126, 92],
        hand: [150, 92],
        hip: [74, 136],
        knee: [112, 140],
        foot: [104, 180],
      }),
    ],
  },
  pushup: {
    id: "pushup",
    name: "Desk push-ups",
    kind: "reps",
    amount: 10,
    tempo: 2.2,
    prop: "desk",
    targets: "Chest, shoulders, arms",
    tips: [
      "Hands on the edge of a stable desk, shoulder-width",
      "Body in one straight line from head to heels",
      "Elbows at about 45°, not flared out",
    ],
    poses: [
      {
        head: [134, 80],
        neck: [124, 94],
        elbow: [146, 104],
        hand: [166, 120],
        hip: [84, 134],
        knee: [62, 157],
        foot: [40, 180],
      },
      {
        head: [146, 96],
        neck: [136, 108],
        elbow: [140, 128],
        hand: [166, 120],
        hip: [92, 142],
        knee: [66, 161],
        foot: [40, 180],
      },
    ],
  },
  calf: {
    id: "calf",
    name: "Calf raises",
    kind: "reps",
    amount: 15,
    tempo: 1.6,
    targets: "Calves and circulation in the legs",
    tips: ["Rise slowly onto your toes", "Pause one second at the top", "Hold the desk for balance if needed"],
    poses: [
      standing,
      pose({
        head: [100, 30],
        neck: [100, 48],
        elbow: [100, 74],
        hand: [100, 98],
        hip: [100, 100],
        knee: [100, 135],
        foot: [104, 172],
      }),
    ],
  },
  hipFlexorL: {
    id: "hipFlexorL",
    name: "Hip flexor stretch — left",
    kind: "timed",
    amount: 30,
    tempo: 4,
    targets: "Front of the hip, tightened by sitting",
    tips: ["Long lunge, back knee low", "Squeeze the glute of the back leg", "Keep your chest up — gentle push forward"],
    poses: [
      {
        head: [100, 70],
        neck: [100, 88],
        elbow: [116, 114],
        hand: [103, 136],
        hip: [100, 140],
        knee: [140, 146],
        foot: [140, 180],
        knee2: [66, 172],
        foot2: [34, 178],
      },
      {
        head: [106, 76],
        neck: [106, 94],
        elbow: [122, 119],
        hand: [109, 141],
        hip: [106, 146],
        knee: [144, 150],
        foot: [140, 180],
        knee2: [70, 174],
        foot2: [34, 178],
      },
    ],
  },
  chest: {
    id: "chest",
    name: "Chest opener",
    kind: "timed",
    amount: 30,
    tempo: 4,
    targets: "Chest and shoulders — undoes the keyboard hunch",
    tips: ["Clasp hands behind your back", "Squeeze shoulder blades together", "Lift your chest, chin level"],
    poses: [
      pose({ elbow: [88, 82], hand: [80, 104] }),
      pose({ head: [103, 40], neck: [102, 58], elbow: [80, 78], hand: [66, 96] }),
    ],
  },
  neck: {
    id: "neck",
    name: "Neck rolls",
    kind: "timed",
    amount: 20,
    tempo: 3,
    targets: "Neck tension from looking at the screen",
    tips: ["Slow circles, never force it", "Shoulders stay down and relaxed", "Switch direction halfway"],
    poses: [pose({ head: [92, 44] }), pose({ head: [109, 44] })],
  },
  shoulders: {
    id: "shoulders",
    name: "Shoulder rolls",
    kind: "timed",
    amount: 20,
    tempo: 2,
    targets: "Upper back and trapezius",
    tips: ["Lift shoulders to your ears", "Roll them back and down", "Breathe out on the way down"],
    poses: [pose({}), pose({ neck: [98, 52], elbow: [96, 76], hand: [98, 100] })],
  },
  wrist: {
    id: "wrist",
    name: "Wrist stretch",
    kind: "timed",
    amount: 20,
    tempo: 3,
    targets: "Wrists and forearms — for people who type all day",
    tips: ["Arm straight in front, palm up", "Gently pull fingers down with the other hand", "Switch hands halfway"],
    poses: [
      pose({ elbow: [124, 64], hand: [150, 62], elbow2: [118, 78], hand2: [146, 66] }),
      pose({ elbow: [124, 64], hand: [148, 72], elbow2: [118, 82], hand2: [146, 76] }),
    ],
  },
};

export interface Routine {
  id: string;
  name: string;
  blurb: string;
  steps: string[];
}

export const ROUTINES: Routine[] = [
  {
    id: "quick",
    name: "Quick break",
    blurb: "About 2 minutes. One strength move, two stretches.",
    steps: ["squat", "chest", "neck"],
  },
  {
    id: "reset",
    name: "Full reset",
    blurb: "About 3–4 minutes. Wakes up the whole body.",
    steps: ["squat", "pushup", "hipFlexorL", "chest", "wrist", "calf"],
  },
  {
    id: "quiet",
    name: "Quiet stretch",
    blurb: "No sweating — fine before a meeting.",
    steps: ["neck", "shoulders", "wrist", "chest"],
  },
];

export function estimateSeconds(r: Routine): number {
  return r.steps.reduce((sum, id) => {
    const e = EXERCISES[id];
    return sum + (e.kind === "timed" ? e.amount : e.amount * e.tempo) + 5;
  }, 0);
}

/** Rotate through routines so breaks don't get boring. */
export function suggestRoutine(breakCountToday: number): Routine {
  const order = ["quick", "quiet", "reset"];
  const id = order[breakCountToday % order.length];
  return ROUTINES.find((r) => r.id === id)!;
}
