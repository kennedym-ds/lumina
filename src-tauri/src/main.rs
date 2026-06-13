// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

/// Managed handle to the spawned backend process, so we can terminate it on exit.
type BackendProcess = Mutex<Option<std::process::Child>>;

/// Exposes the resolved backend port and session token to the frontend via IPC.
/// Called by the React bootstrap before mounting — race-condition-free alternative
/// to window.eval() which fires before the page context is stable in Tauri 2.
#[tauri::command]
fn get_backend_config(state: tauri::State<BackendConfig>) -> BackendConfig {
    state.inner().clone()
}

fn main() {
    let app = tauri::Builder::default()
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

            // Spawn the bundled --onedir backend directly. It lives under the Tauri
            // resource directory as lumina-backend/lumina-backend.exe (+ _internal/).
            // Spawning natively (not via the shell plugin) avoids re-extraction and
            // keeps the execution surface off the IPC ACL.
            #[cfg(not(debug_assertions))]
            {
                let resource_dir = app.path().resource_dir()?;
                let backend_exe = resource_dir
                    .join("lumina-backend")
                    .join("lumina-backend.exe");

                let mut command = std::process::Command::new(&backend_exe);
                command.args(["--port", &port.to_string(), "--token", &token]);

                // Suppress the console window the console-subsystem backend would
                // otherwise flash on Windows.
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                    command.creation_flags(CREATE_NO_WINDOW);
                }

                match command.spawn() {
                    Ok(child) => {
                        app.manage::<BackendProcess>(Mutex::new(Some(child)));
                        println!("[lumina] Backend spawned on port {port}");
                    }
                    Err(e) => {
                        eprintln!(
                            "[lumina] Failed to spawn backend at {}: {e}",
                            backend_exe.display()
                        );
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // Terminate the backend child when the app exits so it isn't orphaned.
        if let tauri::RunEvent::ExitRequested { .. } = event {
            if let Some(state) = app_handle.try_state::<BackendProcess>() {
                if let Ok(mut guard) = state.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}

#[derive(Clone, serde::Serialize)]
struct BackendConfig {
    port: u16,
    token: String,
}
