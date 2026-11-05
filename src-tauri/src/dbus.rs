//! D-Bus service the COSMIC panel applet talks to.
//!
//!   bus name  app.bouge.Desktop
//!   object    /app/bouge
//!   interface app.bouge.Desktop1
//!     GetState() -> s        timer state as JSON
//!     Action(s name)         "go", "snooze", "skip", "break-now", "pause", "resume", "eye-skip", "open", "quit",
//                             "next", "stop", "done-close"  (routine played in the applet)

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

struct Bouge {
    state: Arc<Mutex<String>>,
    app: AppHandle,
}

#[zbus::interface(name = "app.bouge.Desktop1")]
impl Bouge {
    fn get_state(&self) -> String {
        crate::applet_polled();
        self.state.lock().unwrap().clone()
    }

    fn action(&self, name: String) {
        if name == "quit" {
            self.app.exit(0);
            return;
        }
        if name == "open" {
            crate::show_main(&self.app);
        }
        let _ = self.app.emit_to("main", "bouge:action", name);
    }
}

async fn serve(app: AppHandle, state: Arc<Mutex<String>>) -> zbus::Result<zbus::Connection> {
    zbus::connection::Builder::session()?
        .name("app.bouge.Desktop")?
        .serve_at("/app/bouge", Bouge { state, app })?
        .build()
        .await
}

pub fn start(app: AppHandle, state: Arc<Mutex<String>>) {
    tauri::async_runtime::spawn(async move {
        match serve(app, state).await {
            // keep the connection alive for the lifetime of the app
            Ok(_conn) => std::future::pending::<()>().await,
            Err(e) => eprintln!("bouge: D-Bus service unavailable ({e}); the COSMIC applet won't connect"),
        }
    });
}
