// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Wayland doesn't let apps place their own windows or keep them on top,
    // so on Linux run through XWayland, where the pill can sit at the top of
    // the screen above everything. Set GDK_BACKEND yourself to override.
    #[cfg(target_os = "linux")]
    if std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
    bouge_lib::run()
}
