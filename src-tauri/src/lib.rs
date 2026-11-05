use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WindowEvent,
};

#[cfg(target_os = "linux")]
mod dbus;
mod popup;

/// Latest timer state as JSON, served to the COSMIC panel applet over D-Bus.
#[derive(Default, Clone)]
pub struct Published(pub Arc<Mutex<String>>);

pub(crate) fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// When the COSMIC applet last read the state. The applet polls every second,
/// so if it hasn't for a few seconds there is no applet (Windows, macOS, other
/// Linux desktops) and Bouge uses its window instead.
static LAST_APPLET_POLL: AtomicU64 = AtomicU64::new(0);

pub(crate) fn applet_polled() {
    LAST_APPLET_POLL.store(now_ms(), Ordering::Relaxed);
}

fn applet_active() -> bool {
    // lets you try the tray popup on COSMIC too
    if std::env::var_os("BOUGE_NO_APPLET").is_some() {
        return false;
    }
    now_ms().saturating_sub(LAST_APPLET_POLL.load(Ordering::Relaxed)) < 5_000
}

pub(crate) fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Called by the main window every second: updates the tray label (shown as
/// text in the macOS menu bar) and the state the COSMIC applet reads.
#[tauri::command]
fn publish_state(app: AppHandle, published: State<Published>, title: String, tooltip: String, state: String) -> bool {
    *published.0.lock().unwrap() = state;
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_title(Some(&title));
        let _ = tray.set_tooltip(Some(&tooltip));
    }
    applet_active()
}

/// "Settings & stats": the full window, for intervals and history.
#[tauri::command]
fn open_settings(app: AppHandle) {
    popup::hide(&app);
    show_main(&app);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let published = Published::default();
    tauri::Builder::default()
        .manage(published.clone())
        .invoke_handler(tauri::generate_handler![
            publish_state,
            open_settings,
            quit_app,
            popup::fit_popup,
            popup::show_popup,
            popup::hide_popup
        ])
        .setup(move |app| {
            // Left click opens the popup; right click shows this menu.
            // (Linux trays don't report clicks, so there "Show Bouge" is it.)
            let show = MenuItem::with_id(app, "show", "Show Bouge", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings & stats", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Bouge", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &settings, &sep, &quit])?;
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Bouge")
                .title("Bouge")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => popup::show(app),
                    "settings" => {
                        popup::hide(app);
                        show_main(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { rect, button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        let scale = app.get_webview_window(popup::LABEL).and_then(|w| w.scale_factor().ok()).unwrap_or(1.0);
                        popup::remember_tray(&rect, scale);
                        popup::toggle(app);
                    }
                })
                .build(app)?;
            #[cfg(target_os = "linux")]
            dbus::start(app.handle().clone(), published.0.clone());
            // Nothing is shown at launch on COSMIC (the applet takes over);
            // elsewhere pop up from the tray once so people see it's running.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(4));
                if !applet_active() {
                    let h = handle.clone();
                    let _ = handle.run_on_main_thread(move || popup::show(&h));
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing a window keeps Bouge running in the tray / panel applet
            // (the timers live there). Quit from the popup, applet or tray.
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == popup::LABEL => popup::on_blur(window),
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running Bouge");
}
