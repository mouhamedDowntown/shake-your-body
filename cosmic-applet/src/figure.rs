//! The animated stick figure, drawn natively. Same poses and drawing as
//! src/components/Figure.tsx: it blends between two poses with a smooth
//! back-and-forth at the exercise's tempo.

use cosmic::iced::mouse;
use cosmic::iced::widget::canvas::{self, Frame, Geometry, LineCap, LineJoin, Path, Stroke};
use cosmic::iced::{Color, Point, Rectangle, Size};
use serde::Deserialize;

type P = [f32; 2];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pose {
    head: P,
    neck: P,
    elbow: P,
    hand: P,
    hip: P,
    knee: P,
    foot: P,
    elbow2: Option<P>,
    hand2: Option<P>,
    knee2: Option<P>,
    foot2: Option<P>,
}

/// Mirrors `Exercise` in src/lib/exercises.ts
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Exercise {
    pub name: String,
    /// "reps" | "timed"
    pub kind: String,
    pub amount: u32,
    /// seconds per rep (animation speed)
    pub tempo: f32,
    pub tips: Vec<String>,
    pub targets: String,
    pub poses: [Pose; 2],
    pub prop: Option<String>,
}

fn lerp(a: P, b: P, t: f32) -> P {
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/// Seconds since the exercise started → blend factor 0 → 1 → 0
pub fn phase(elapsed: f32, tempo: f32) -> f32 {
    (1.0 - (elapsed / tempo.max(0.1) * std::f32::consts::TAU).cos()) / 2.0
}

pub struct Figure<'a> {
    pub exercise: &'a Exercise,
    pub t: f32,
}

const BRAND: Color = Color::from_rgb(0.078, 0.722, 0.651); // #14b8a6
const GROUND: Color = Color::from_rgba(0.6, 0.6, 0.6, 0.5);

impl<Message> canvas::Program<Message, cosmic::Theme, cosmic::Renderer> for Figure<'_> {
    type State = ();

    fn draw(
        &self,
        _state: &(),
        renderer: &cosmic::Renderer,
        _theme: &cosmic::Theme,
        bounds: Rectangle,
        _cursor: mouse::Cursor,
    ) -> Vec<Geometry<cosmic::Renderer>> {
        let mut frame = Frame::new(renderer, bounds.size());
        // 200×200 viewBox, centred
        let s = bounds.width.min(bounds.height) / 200.0;
        let ox = (bounds.width - 200.0 * s) / 2.0;
        let pt = |p: P| Point::new(ox + p[0] * s, p[1] * s);
        let line = |color: Color, width: f32| {
            Stroke::default()
                .with_color(color)
                .with_width(width * s)
                .with_line_cap(LineCap::Round)
                .with_line_join(LineJoin::Round)
        };
        let poly = |pts: &[P]| {
            Path::new(|b| {
                b.move_to(pt(pts[0]));
                for p in &pts[1..] {
                    b.line_to(pt(*p));
                }
            })
        };

        let [a, b] = &self.exercise.poses;
        let t = self.t;
        let m = |x: P, y: P| lerp(x, y, t);
        let head = m(a.head, b.head);
        let neck = m(a.neck, b.neck);
        let elbow = m(a.elbow, b.elbow);
        let hand = m(a.hand, b.hand);
        let hip = m(a.hip, b.hip);
        let knee = m(a.knee, b.knee);
        let foot = m(a.foot, b.foot);
        let elbow2 = m(a.elbow2.unwrap_or(a.elbow), b.elbow2.unwrap_or(b.elbow));
        let hand2 = m(a.hand2.unwrap_or(a.hand), b.hand2.unwrap_or(b.hand));
        let knee2 = m(a.knee2.unwrap_or(a.knee), b.knee2.unwrap_or(b.knee));
        let foot2 = m(a.foot2.unwrap_or(a.foot), b.foot2.unwrap_or(b.foot));

        frame.stroke(&poly(&[[10.0, 184.0], [190.0, 184.0]]), line(GROUND, 3.0));
        if self.exercise.prop.as_deref() == Some("desk") {
            frame.fill(&Path::rectangle(pt([162.0, 120.0]), Size::new(34.0 * s, 6.0 * s)), GROUND);
            frame.stroke(&poly(&[[190.0, 126.0], [190.0, 184.0]]), line(GROUND, 2.0));
        }

        // far limbs lighter, then torso + near limbs
        let far = Color { a: 0.45, ..BRAND };
        frame.stroke(&poly(&[hip, knee2, foot2]), line(far, 7.0));
        frame.stroke(&poly(&[neck, elbow2, hand2]), line(far, 7.0));
        frame.stroke(&poly(&[neck, hip]), line(BRAND, 7.0));
        frame.stroke(&poly(&[hip, knee, foot]), line(BRAND, 7.0));
        frame.stroke(&poly(&[neck, elbow, hand]), line(BRAND, 7.0));
        frame.fill(&Path::circle(pt(head), 12.0 * s), BRAND);

        vec![frame.into_geometry()]
    }
}
