# Pose detection (version 2)

This folder is where webcam rep counting and posture checks will live.

Plan:

1. `npm i @mediapipe/tasks-vision`
2. Create a `PoseLandmarker` (runs fully in the browser — no video leaves the device).
3. Implement the `RepCounter` interface below for each exercise, e.g. a squat
   counts one rep when the hip–knee–ankle angle drops below ~100° and comes back above ~160°.
4. In `RoutinePlayer`, when the camera is on, call `onRep` to auto-advance instead of the "Done" button.

```ts
export interface RepCounter {
  /** landmarks from PoseLandmarker for one video frame */
  update(landmarks: { x: number; y: number; z: number }[]): void;
  reps: number;
  /** optional live form feedback, e.g. "go lower", "keep your back straight" */
  feedback?: string;
}
```

Keep the camera **opt-in**, show a clear "camera on" indicator, and never upload frames.
