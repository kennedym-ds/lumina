// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

/// Exposes the resolved backend port and session token to the frontend via IPC.
/// Called by the React bootstrap before mounting — race-condition-free alternative
/// to window.eval() which fires before the page context is stable in Tauri 2.
#[tauri::command]
fn get_backend_config(state: tauri::State<BackendConfig>) -> BackendConfig {
    state.inner().clone()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_backend_config])
        .setup(|app| {
            let port = lumina_lib::find_free_port(8089, 5);
            let token = lumina_lib::generate_token();

            println!("[lumina] Backend port: {port}");
            println!("[lumina] Auth token generated (length={})", token.len());

            app.manage(BackendConfig {
                port,
                token: token.clone(),
            });

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
                        // Keep the child handle alive so the sidecar isn't killed
                        // when setup() returns — it must outlive this scope.
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

#[derive(Clone, serde::Serialize)]
struct BackendConfig {
    port: u16,
    token: String,
}
