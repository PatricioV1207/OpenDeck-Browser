use std::{path::PathBuf, sync::Arc};

use services::storage::{AppDataStore, JsonAppDataStorage};
use state::AppState;
use tauri::Manager;

pub mod commands;
pub mod domain;
pub mod error;
pub mod services;
pub mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            app.manage(app_state_for_config_dir(config_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_data::get_app_info,
            commands::app_data::load_app_data,
            commands::app_data::create_workspace,
            commands::app_data::rename_workspace,
            commands::app_data::delete_workspace,
            commands::app_data::set_active_workspace,
            commands::app_data::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn app_state_for_config_dir(config_dir: PathBuf) -> AppState {
    let store: Arc<dyn AppDataStore> = Arc::new(JsonAppDataStorage::new(config_dir));
    AppState::with_system_clock(store)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn constructing_app_state_does_not_create_the_config_directory() {
        let parent = tempdir().expect("temporary parent should be created");
        let config_dir = parent.path().join("missing-config");

        let _state = app_state_for_config_dir(config_dir.clone());

        assert!(!config_dir.exists());
    }
}
