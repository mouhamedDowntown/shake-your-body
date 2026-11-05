//! The tray popup (Windows, macOS, and Linux desktops without the COSMIC
//! applet): a small borderless window that drops down from the tray icon,
//! like the system's Wi-Fi or volume flyouts. It shows the countdown and
//! plays breaks, and opens by itself when a break is due.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, Rect, WebviewWindow};

pub const LABEL: &str = "popup";
const WIDTH: f64 = 360.0;
const GAP: i32 = 6;

/// Where the tray icon is, in physical pixels (x, y, w, h). Known once the
/// user has clicked it; until then the popup goes in the usual tray corner.
static TRAY_RECT: Mutex<Option<(i32, i32, i32, i32)>> = Mutex::new(None);
/// When the popup last hid because it lost focus — clicking the tray icon
/// while it's open hides it first, and that click mustn't reopen it.
static HIDDEN_AT: AtomicU64 = AtomicU64::new(0);

pub fn remember_tray(rect: &Rect, scale: f64) {
    let p = rect.position.to_physical::<i32>(scale);
    let s = rect.size.to_physical::<u32>(scale);
    *TRAY_RECT.lock().unwrap() = Some((p.x, p.y, s.width as i32, s.height as i32));
}

fn window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(LABEL)
}

/// Put the popup next to the tray icon: below it when the icon is at the top
/// of the screen (macOS menu bar), above it when at the bottom (Windows
/// taskbar). Kept inside the screen's work area.
fn place(w: &WebviewWindow) {
    let Ok(size) = w.outer_size() else { return };
    let (pw, ph) = (size.width as i32, size.height as i32);
    let monitor = w.current_monitor().ok().flatten().or_else(|| w.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else { return };
    let work = monitor.work_area();
    let (wx, wy, ww, wh) = (work.position.x, work.position.y, work.size.width as i32, work.size.height as i32);

    let (mut x, mut y) = match *TRAY_RECT.lock().unwrap() {
        Some((tx, ty, tw, th)) => {
            let x = tx + tw / 2 - pw / 2;
            let at_top = ty < wy + wh / 2;
            (x, if at_top { ty + th + GAP } else { ty - ph - GAP })
        }
        // not clicked yet: top-right under the menu bar on macOS,
        // bottom-right above the taskbar elsewhere
        None if cfg!(target_os = "macos") => (wx + ww - pw - 12, wy + GAP),
        None => (wx + ww - pw - 12, wy + wh - ph - 12),
    };
    x = x.clamp(wx + GAP, (wx + ww - pw - GAP).max(wx));
    y = y.clamp(wy + GAP, (wy + wh - ph - GAP).max(wy));
    let _ = w.set_position(PhysicalPosition::new(x, y));
}

pub fn show(app: &AppHandle) {
    if let Some(w) = window(app) {
        place(&w);
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn hide(app: &AppHandle) {
    if let Some(w) = window(app) {
        let _ = w.hide();
    }
}

pub fn toggle(app: &AppHandle) {
    let Some(w) = window(app) else { return };
    if w.is_visible().unwrap_or(false) {
        let _ = w.hide();
    } else if crate::now_ms().saturating_sub(HIDDEN_AT.load(Ordering::Relaxed)) > 300 {
        show(app);
    }
}

/// Lost focus → hide, like other tray flyouts.
pub fn on_blur(w: &tauri::Window) {
    HIDDEN_AT.store(crate::now_ms(), Ordering::Relaxed);
    let _ = w.hide();
}

/// The popup page reports its content height; fit the window to it.
#[tauri::command]
pub fn fit_popup(app: AppHandle, height: f64) {
    if let Some(w) = window(&app) {
        let _ = w.set_size(LogicalSize::new(WIDTH, height.clamp(120.0, 900.0)));
        if w.is_visible().unwrap_or(false) {
            place(&w);
        }
    }
}

#[tauri::command]
pub fn show_popup(app: AppHandle) {
    show(&app);
}

#[tauri::command]
pub fn hide_popup(app: AppHandle) {
    hide(&app);
}
