use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, State, WindowEvent,
};

#[cfg(target_os = "linux")]
mod dbus;

/// Latest timer state as JSON, served to the COSMIC panel applet over D-Bus.
#[derive(Default, Clone)]
pub struct Published(pub Arc<Mutex<String>>);

fn now_ms() -> u64 {
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

/// Bring the window to the front at break time (when there's no applet).
#[tauri::command]
fn show_window(app: AppHandle) {
    show_main(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let published = Published::default();
    tauri::Builder::default()
        .manage(published.clone())
        .invoke_handler(tauri::generate_handler![publish_state, show_window])
        .setup(move |app| {
            let open = MenuItem::with_id(app, "open", "Open Bouge", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Bouge", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Bouge")
                .title("Bouge")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            #[cfg(target_os = "linux")]
            dbus::start(app.handle().clone(), published.0.clone());
            // The window starts hidden; show it unless the COSMIC applet
            // picks Bouge up within a few seconds.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(4));
                if !applet_active() {
                    show_main(&handle);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Closing the window keeps Bouge running in the tray / panel
                // applet (the timers live there). Quit from the applet or tray.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Bouge");
}
