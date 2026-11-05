//! Bouge in the COSMIC panel: shows the countdown as text (like the clock)
//! and opens a popup with the break actions when clicked.
//!
//! The Bouge desktop app owns the timers; this applet reads them once a
//! second over D-Bus (app.bouge.Desktop, see src-tauri/src/dbus.rs) and sends
//! button presses back. Breaks play right in the popup: "Let's go" runs the
//! routine here, with the animated figure, instead of opening a window.

mod figure;

use std::time::{Duration, Instant};

use figure::{Exercise, Figure};

use cosmic::app::{Core, Task};
use cosmic::iced::window::Id;
use cosmic::iced::{Alignment, Length, Rectangle, Subscription};
use cosmic::surface::action::{app_popup, destroy_popup};
use cosmic::widget::{self, button, text, Column, Row};
use cosmic::Element;
use serde::Deserialize;

const APP_ID: &str = "app.bouge.CosmicApplet";

/// Mirrors `publishState` in src/lib/desktop.ts
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BougeState {
    title: String,
    /// seconds, -1 when the break is due
    move_remaining: i64,
    eye_remaining: Option<i64>,
    /// seconds left in a running eye break
    eye_left: Option<i64>,
    paused: bool,
    /// "idle" | "move" | "eye" | "routine" | "done"
    mode: String,
    suggested: Suggested,
    routine: Option<RoutineStep>,
    done_minutes: Option<u32>,
    breaks_today: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct RoutineStep {
    name: String,
    index: usize,
    total: usize,
    /// seconds left on a timed exercise
    left: i64,
    exercise: Exercise,
}

#[derive(Debug, Clone, Deserialize)]
struct Suggested {
    name: String,
    minutes: u32,
}

#[derive(Default)]
struct Applet {
    core: Core,
    popup: Option<Id>,
    conn: Option<zbus::Connection>,
    state: Option<BougeState>,
    /// animation clock, restarted for each exercise
    anim: Option<(usize, Instant)>,
}

#[derive(Debug, Clone)]
enum Message {
    Connected(Option<zbus::Connection>),
    Tick,
    /// redraw the figure (~30 fps while a routine is on screen)
    Frame,
    State(Option<BougeState>),
    Act(&'static str),
    /// Launch the Bouge app when it isn't running
    Start,
    PopupClosed(Id),
    Surface(cosmic::surface::Action<Message>),
}

fn mmss(secs: i64) -> String {
    if secs < 0 {
        return "now".into();
    }
    format!("{}:{:02}", secs / 60, secs % 60)
}

async fn call(conn: zbus::Connection, method: &str, arg: Option<&str>) -> zbus::Result<zbus::Message> {
    let dest = Some("app.bouge.Desktop");
    let iface = Some("app.bouge.Desktop1");
    match arg {
        Some(a) => conn.call_method(dest, "/app/bouge", iface, method, &(a,)).await,
        None => conn.call_method(dest, "/app/bouge", iface, method, &()).await,
    }
}

async fn fetch_state(conn: zbus::Connection) -> Option<BougeState> {
    let reply = call(conn, "GetState", None).await.ok()?;
    let json: String = reply.body().deserialize().ok()?;
    serde_json::from_str(&json).ok()
}

impl cosmic::Application for Applet {
    type Executor = cosmic::executor::Default;
    type Flags = ();
    type Message = Message;
    const APP_ID: &'static str = APP_ID;

    fn core(&self) -> &Core {
        &self.core
    }

    fn core_mut(&mut self) -> &mut Core {
        &mut self.core
    }

    fn init(core: Core, _flags: ()) -> (Self, Task<Message>) {
        let applet = Applet { core, ..Default::default() };
        let connect = cosmic::task::future(async { Message::Connected(zbus::Connection::session().await.ok()) });
        (applet, connect)
    }

    fn on_close_requested(&self, id: Id) -> Option<Message> {
        Some(Message::PopupClosed(id))
    }

    fn subscription(&self) -> Subscription<Message> {
        let poll = cosmic::iced::time::every(Duration::from_secs(1)).map(|_| Message::Tick);
        let playing = self.popup.is_some() && self.state.as_ref().is_some_and(|s| s.routine.is_some());
        if playing {
            Subscription::batch([poll, cosmic::iced::time::every(Duration::from_millis(33)).map(|_| Message::Frame)])
        } else {
            poll
        }
    }

    fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::Connected(conn) => {
                self.conn = conn;
                return cosmic::task::message(Message::Tick);
            }
            Message::Tick => {
                if let Some(conn) = self.conn.clone() {
                    return cosmic::task::future(async move { Message::State(fetch_state(conn).await) });
                }
            }
            Message::State(state) => {
                let step = state.as_ref().and_then(|s| s.routine.as_ref()).map(|r| r.index);
                match (step, self.anim) {
                    (Some(i), Some((j, _))) if i == j => {}
                    (Some(i), _) => self.anim = Some((i, Instant::now())),
                    (None, _) => self.anim = None,
                }
                self.state = state;
            }
            Message::Frame => {} // re-renders the view
            Message::Act(name) => {
                // these change what the popup shows, so keep it open
                let keep_open = matches!(name, "go" | "next" | "break-now");
                let close = if keep_open { None } else { self.popup.take() }
                    .map(|id| cosmic::task::message(cosmic::Action::Surface(destroy_popup(id))));
                if let Some(conn) = self.conn.clone() {
                    let send = cosmic::task::future(async move {
                        let _ = call(conn, "Action", Some(name)).await;
                        Message::Tick
                    });
                    return match close {
                        Some(close) => Task::batch([close, send]),
                        None => send,
                    };
                }
                return close.unwrap_or_else(Task::none);
            }
            Message::Start => {
                // installed by `devenv shell -- install-desktop`; override with BOUGE_CMD
                let cmd = std::env::var("BOUGE_CMD").unwrap_or_else(|_| {
                    format!("{}/.local/bin/bouge", std::env::var("HOME").unwrap_or_default())
                });
                match std::process::Command::new(&cmd).spawn() {
                    // reap it when it quits, so no zombie process is left behind
                    Ok(mut child) => drop(std::thread::spawn(move || child.wait())),
                    Err(e) => eprintln!("bouge applet: couldn't start {cmd}: {e}"),
                }
                if let Some(id) = self.popup.take() {
                    return cosmic::task::message(cosmic::Action::Surface(destroy_popup(id)));
                }
            }
            Message::PopupClosed(id) => {
                if self.popup == Some(id) {
                    self.popup = None;
                }
            }
            Message::Surface(a) => return cosmic::task::message(cosmic::Action::Surface(a)),
        }
        Task::none()
    }

    fn view(&self) -> Element<'_, Message> {
        let label = match &self.state {
            Some(s) => s.title.clone(),
            None => "🏃 Bouge".into(),
        };

        let have_popup = self.popup;
        // Same layout as libcosmic's applet text_button (the clock uses it), but
        // with on_press_with_rectangle so the popup anchors under the button
        let suggested = self.core.applet.suggested_size(true);
        let (major, minor) = self.core.applet.suggested_padding(true);
        let (h_pad, v_pad) = if self.core.applet.is_horizontal() { (major, minor) } else { (minor, major) };
        let content = widget::layer_container(self.core.applet.text(label).height(Length::Fill).align_y(Alignment::Center))
            .center_y(Length::Fixed(f32::from(suggested.1 + 2 * v_pad)));
        let btn = button::custom(content)
            .padding([0, h_pad])
            .class(cosmic::theme::Button::AppletIcon)
            .on_press_with_rectangle(move |offset, bounds| {
                if let Some(id) = have_popup {
                    return Message::Surface(destroy_popup(id));
                }
                Message::Surface(app_popup::<Applet>(
                    |_| Default::default(),
                    move |state: &mut Applet| {
                        let new_id = Id::unique();
                        state.popup = Some(new_id);
                        let mut settings =
                            state.core.applet.get_popup_settings(state.core.main_window_id().unwrap(), new_id, None, None, None);
                        settings.positioner.anchor_rect = Rectangle {
                            x: (bounds.x - offset.x) as i32,
                            y: (bounds.y - offset.y) as i32,
                            width: bounds.width as i32,
                            height: bounds.height as i32,
                        };
                        settings
                    },
                    Some(Box::new(|state: &Applet| Element::from(state.core.applet.popup_container(state.popup_view())).map(cosmic::Action::App))),
                ))
            });

        self.core.applet.autosize_window(btn).into()
    }

    fn view_window(&self, _id: Id) -> Element<'_, Message> {
        "".into()
    }

    fn style(&self) -> Option<cosmic::iced::theme::Style> {
        Some(cosmic::applet::style())
    }
}

impl Applet {
    fn popup_view(&self) -> Element<'_, Message> {
        let Some(s) = &self.state else {
            return widget::container(
                Column::new()
                    .push(text::title4("Bouge isn't running"))
                    .push(button::suggested("▶ Start Bouge").on_press(Message::Start).width(Length::Fill))
                    .spacing(12),
            )
            .padding(16)
            .width(Length::Fixed(320.0))
            .into();
        };

        let wide = |label: String, msg: Message| button::suggested(label).on_press(msg).width(Length::Fill);
        let plain = |label: &'static str, msg: Message| button::text(label).on_press(msg);

        let content: Element<Message> = match s.mode.as_str() {
            "move" => Column::new()
                .push(text::title3("🏃 Time to move!"))
                .push(text::body(format!("Suggested: {} (~{} min)", s.suggested.name, s.suggested.minutes)))
                .push(wide("Let's go".into(), Message::Act("go")))
                .push(Row::new().push(plain("Snooze 5 min", Message::Act("snooze"))).push(plain("Skip", Message::Act("skip"))).spacing(8))
                .spacing(12)
                .align_x(Alignment::Center)
                .into(),
            "eye" => Column::new()
                .push(text::title3(format!("👀 Eye break · {}s", s.eye_left.unwrap_or(0))))
                .push(text::body("Look at something at least 6 meters away."))
                .push(plain("Skip", Message::Act("eye-skip")))
                .spacing(12)
                .align_x(Alignment::Center)
                .into(),
            "routine" => match &s.routine {
                Some(r) => self.routine_view(r),
                None => text::body("…").into(),
            },
            "done" => Column::new()
                .push(text::title3("🎉 Nice work!"))
                .push(text::body(format!(
                    "{} min of movement. That's break #{} today.",
                    s.done_minutes.unwrap_or(1),
                    s.breaks_today
                )))
                .push(wide("Back to work".into(), Message::Act("done-close")))
                .spacing(12)
                .align_x(Alignment::Center)
                .into(),
            _ => {
                let mut c = Column::new().spacing(12);
                c = c.push(text::title3(if s.paused {
                    "⏸ Paused".to_string()
                } else {
                    format!("🏃 Next break in {}", mmss(s.move_remaining))
                }));
                if let (Some(eye), false) = (s.eye_remaining, s.paused) {
                    c = c.push(text::body(format!("👀 Eye break in {}", mmss(eye))));
                }
                c.push(wide("Break now".into(), Message::Act("break-now")))
                    .push(
                        Row::new()
                            .push(if s.paused { plain("▶ Resume", Message::Act("resume")) } else { plain("⏸ Pause", Message::Act("pause")) })
                            .push(widget::Space::new().width(Length::Fill))
                            .push(plain("Settings & stats", Message::Act("open")))
                            .spacing(8),
                    )
                    .into()
            }
        };

        let footer = Row::new()
            .push(widget::Space::new().width(Length::Fill))
            .push(button::destructive("Quit Bouge").on_press(Message::Act("quit")));
        widget::container(Column::new().push(content).push(widget::divider::horizontal::default()).push(footer).spacing(12))
            .padding(16)
            .width(Length::Fill)
            .into()
    }

    /// One step of a routine: progress, figure, name, count, tips, buttons.
    fn routine_view<'a>(&'a self, r: &'a RoutineStep) -> Element<'a, Message> {
        let ex = &r.exercise;
        let elapsed = self.anim.map(|(_, at)| at.elapsed().as_secs_f32()).unwrap_or(0.0);
        let timed = ex.kind == "timed";
        let timed_running = timed && r.left > 0;
        let is_last = r.index + 1 >= r.total;

        let mut progress = Row::new().spacing(4);
        for i in 0..r.total {
            let filled = i <= r.index;
            progress = progress.push(
                widget::container(widget::Space::new().height(Length::Fixed(5.0)))
                    .width(Length::Fill)
                    .class(cosmic::theme::Container::custom(move |theme| {
                        let c = theme.cosmic();
                        let color = if filled { c.accent_color() } else { c.palette.neutral_4 };
                        cosmic::widget::container::Style {
                            background: Some(cosmic::iced::Background::Color(color.into())),
                            border: cosmic::iced::Border { radius: 3.0.into(), ..Default::default() },
                            ..Default::default()
                        }
                    })),
            );
        }

        let mut tips = Column::new().spacing(4);
        for tip in &ex.tips {
            tips = tips.push(text::caption(format!("✓ {tip}")));
        }

        let count = if timed { format!("{}s", r.left.max(0)) } else { format!("× {}", ex.amount) };
        let next_label = if timed_running { "Skip" } else if is_last { "Finish 🎉" } else { "Done — next" };
        let next_btn = if timed_running { button::standard(next_label) } else { button::suggested(next_label) }
            .on_press(Message::Act("next"))
            .width(Length::Fill);

        Column::new()
            .push(Row::new().push(text::caption(r.name.clone())).push(widget::Space::new().width(Length::Fill)).push(text::caption(format!("{} / {}", r.index + 1, r.total))))
            .push(progress)
            .push(
                cosmic::iced::widget::canvas(Figure { exercise: ex, t: figure::phase(elapsed, ex.tempo) })
                    .width(Length::Fill)
                    .height(Length::Fixed(150.0)),
            )
            .push(text::title3(ex.name.clone()))
            .push(text::caption(ex.targets.clone()))
            .push(text::title1(count))
            .push(tips)
            .push(Row::new().push(button::text("Stop").on_press(Message::Act("stop"))).push(next_btn).spacing(8))
            .spacing(10)
            .align_x(Alignment::Center)
            .into()
    }
}

fn main() -> cosmic::iced::Result {
    cosmic::applet::run::<Applet>(())
}
