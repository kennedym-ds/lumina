// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let port = lumina_lib::find_free_port(8089, 5)
                .expect("Could not find a free port for the backend");
            let token = lumina_lib::generate_token();

            println!("[lumina] Backend port: {port}");
            println!("[lumina] Auth token generated (length={})", token.len());

            // Store port and token in app state for the frontend to read
            app.manage(BackendConfig {
                port,
                token: token.clone(),
            });

            // Inject port and token into the webview via JavaScript
            let window = app
                .get_webview_window("main")
                .expect("main window not found");
            let js = format!(
                "window.__LUMINA_API_PORT__ = {}; window.__LUMINA_API_TOKEN__ = \"{}\";",
                port, token
            );
            window.eval(&js)?;

            // Spawn the sidecar backend process
            #[cfg(not(debug_assertions))]
            {
                use tauri_plugin_shell::ShellExt;
                let shell = app.shell();
                match shell.sidecar("lumina-backend").and_then(|cmd| {
                    cmd.args(["--port", &port.to_string(), "--token", &token])
                        .spawn()
                }) {
                    Ok(sidecar_child) => {
                        // Keep the child handle alive in app state so the sidecar
                        // is only killed when the app exits, not when setup() returns.
                        app.manage(Mutex::new(Some(sidecar_child)));
                        println!("[lumina] Sidecar spawned on port {port}");
                    }
                    Err(e) => {
                        eprintln!("[lumina] Failed to spawn sidecar: {e}");
                        return Err(e.into());
                    }
                }
            }

            // In development, the backend is started separately
            #[cfg(debug_assertions)]
            {
                println!("[lumina] Dev mode: start backend manually with:");
                println!(
                    "  python -m uvicorn app.main:app --host 127.0.0.1 --port {} --reload",
                    port
                );
                println!("  (or use: npm run backend)");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Clone)]
struct BackendConfig {
    port: u16,
    token: String,
}
