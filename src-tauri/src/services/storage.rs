use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
};

use serde_json::Value;
use tempfile::NamedTempFile;
use time::{OffsetDateTime, UtcOffset};

use crate::{
    domain::app_data::{AppData, APP_DATA_SCHEMA_VERSION},
    error::{StorageError, StorageNotice},
};

const APP_DATA_FILE_NAME: &str = "app-data.json";
const MAX_APP_DATA_BYTES: usize = 1024 * 1024;

pub trait AppDataStore: Send + Sync {
    fn load(&self, recovery_time: OffsetDateTime) -> Result<LoadOutcome, StorageError>;

    fn save(&self, app_data: &AppData) -> Result<(), StorageError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadOutcome {
    pub app_data: AppData,
    pub notices: Vec<StorageNotice>,
}

impl LoadOutcome {
    fn default_without_notices() -> Self {
        Self {
            app_data: AppData::default(),
            notices: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JsonAppDataStorage {
    config_dir: PathBuf,
}

impl JsonAppDataStorage {
    pub fn new(config_dir: impl Into<PathBuf>) -> Self {
        Self {
            config_dir: config_dir.into(),
        }
    }

    fn app_data_path(&self) -> PathBuf {
        self.config_dir.join(APP_DATA_FILE_NAME)
    }

    fn recover_corrupt_data(
        &self,
        original_bytes: &[u8],
        recovery_time: OffsetDateTime,
    ) -> Result<LoadOutcome, StorageError> {
        self.write_corrupt_backup(original_bytes, recovery_time)?;
        self.save(&AppData::default())?;

        Ok(LoadOutcome {
            app_data: AppData::default(),
            notices: vec![StorageNotice::CorruptDataRecovered],
        })
    }

    fn write_corrupt_backup(
        &self,
        original_bytes: &[u8],
        recovery_time: OffsetDateTime,
    ) -> Result<(), StorageError> {
        let base_name = corrupt_backup_base_name(recovery_time);
        let mut suffix = 0_u64;

        loop {
            let file_name = if suffix == 0 {
                format!("{base_name}.json")
            } else {
                format!("{base_name}-{suffix}.json")
            };
            let backup_path = self.config_dir.join(file_name);
            let mut temporary_file =
                NamedTempFile::new_in(&self.config_dir).map_err(|_| StorageError::BackupFailed)?;

            temporary_file
                .write_all(original_bytes)
                .and_then(|_| temporary_file.flush())
                .map_err(|_| StorageError::BackupFailed)?;
            temporary_file
                .as_file()
                .sync_all()
                .map_err(|_| StorageError::BackupFailed)?;

            match temporary_file.persist_noclobber(&backup_path) {
                Ok(_) => return Ok(()),
                Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                    suffix = suffix.checked_add(1).ok_or(StorageError::BackupFailed)?;
                }
                Err(_) => return Err(StorageError::BackupFailed),
            }
        }
    }

    fn inspect_existing_target(&self) -> Result<TargetState, StorageError> {
        match fs::symlink_metadata(self.app_data_path()) {
            Ok(metadata) if metadata.file_type().is_file() => Ok(TargetState::RegularFile),
            Ok(_) => Err(StorageError::InvalidDataFileType),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(TargetState::Missing),
            Err(_) => Err(StorageError::ReadFailed),
        }
    }

    fn write_serialized(&self, serialized: &[u8]) -> Result<(), StorageError> {
        fs::create_dir_all(&self.config_dir).map_err(|_| StorageError::DirectoryCreationFailed)?;
        self.inspect_existing_target()?;

        let mut temporary_file = NamedTempFile::new_in(&self.config_dir)
            .map_err(|_| StorageError::TemporaryFileCreationFailed)?;
        temporary_file
            .write_all(serialized)
            .and_then(|_| temporary_file.flush())
            .map_err(|_| StorageError::WriteFailed)?;
        temporary_file
            .as_file()
            .sync_all()
            .map_err(|_| StorageError::SyncFailed)?;
        temporary_file
            .persist(self.app_data_path())
            .map_err(|_| StorageError::ReplacementFailed)?;

        Ok(())
    }
}

impl AppDataStore for JsonAppDataStorage {
    fn load(&self, recovery_time: OffsetDateTime) -> Result<LoadOutcome, StorageError> {
        match self.inspect_existing_target()? {
            TargetState::Missing => return Ok(LoadOutcome::default_without_notices()),
            TargetState::RegularFile => {}
        }

        let original_bytes = read_bounded(&self.app_data_path())?;
        let value: Value = match serde_json::from_slice(&original_bytes) {
            Ok(value) => value,
            Err(_) => return self.recover_corrupt_data(&original_bytes, recovery_time),
        };

        match value.get("schemaVersion").and_then(Value::as_u64) {
            Some(version) if version != u64::from(APP_DATA_SCHEMA_VERSION) => {
                return Err(StorageError::UnsupportedSchema);
            }
            Some(_) => {}
            None => return self.recover_corrupt_data(&original_bytes, recovery_time),
        }

        let app_data: AppData = match serde_json::from_slice(&original_bytes) {
            Ok(app_data) => app_data,
            Err(_) => return self.recover_corrupt_data(&original_bytes, recovery_time),
        };

        if app_data.validate().is_err() {
            return self.recover_corrupt_data(&original_bytes, recovery_time);
        }

        Ok(LoadOutcome {
            app_data,
            notices: Vec::new(),
        })
    }

    fn save(&self, app_data: &AppData) -> Result<(), StorageError> {
        app_data
            .validate()
            .map_err(StorageError::ValidationFailed)?;
        let serialized = serialize_app_data(app_data)?;
        self.write_serialized(&serialized)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TargetState {
    Missing,
    RegularFile,
}

fn read_bounded(path: &Path) -> Result<Vec<u8>, StorageError> {
    let file = File::open(path).map_err(|_| StorageError::ReadFailed)?;
    let mut bytes = Vec::new();
    file.take((MAX_APP_DATA_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| StorageError::ReadFailed)?;

    if bytes.len() > MAX_APP_DATA_BYTES {
        return Err(StorageError::DataFileTooLarge);
    }

    Ok(bytes)
}

fn serialize_app_data(app_data: &AppData) -> Result<Vec<u8>, StorageError> {
    let mut serialized =
        serde_json::to_vec_pretty(app_data).map_err(|_| StorageError::SerializationFailed)?;
    serialized.push(b'\n');
    ensure_output_size(serialized.len())?;
    Ok(serialized)
}

fn ensure_output_size(size: usize) -> Result<(), StorageError> {
    if size > MAX_APP_DATA_BYTES {
        return Err(StorageError::DataOutputTooLarge);
    }

    Ok(())
}

fn corrupt_backup_base_name(recovery_time: OffsetDateTime) -> String {
    let recovery_time = recovery_time.to_offset(UtcOffset::UTC);
    format!(
        "app-data.corrupt-{:04}{:02}{:02}T{:02}{:02}{:02}Z",
        recovery_time.year(),
        u8::from(recovery_time.month()),
        recovery_time.day(),
        recovery_time.hour(),
        recovery_time.minute(),
        recovery_time.second(),
    )
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
    };

    use serde_json::{json, Value};
    use tempfile::{tempdir, TempDir};
    use time::format_description::well_known::Rfc3339;

    use super::*;
    use crate::domain::app_data::{ColorMode, DomainError, SettingsPatch};

    const RECOVERY_TIME: &str = "2026-06-12T10:00:00Z";

    fn recovery_time() -> OffsetDateTime {
        OffsetDateTime::parse(RECOVERY_TIME, &Rfc3339).expect("test recovery time should be valid")
    }

    fn app_data_path(directory: &Path) -> PathBuf {
        directory.join(APP_DATA_FILE_NAME)
    }

    fn write_primary(directory: &Path, bytes: &[u8]) {
        fs::create_dir_all(directory).expect("test directory should be created");
        fs::write(app_data_path(directory), bytes).expect("test app data should be written");
    }

    fn storage(directory: &Path) -> JsonAppDataStorage {
        JsonAppDataStorage::new(directory)
    }

    fn assert_recovered(directory: &Path, json: Value) {
        write_primary(
            directory,
            &serde_json::to_vec(&json).expect("test JSON should serialize"),
        );

        let outcome = storage(directory)
            .load(recovery_time())
            .expect("invalid schema-v1 data should recover");

        assert_eq!(outcome.app_data, AppData::default());
        assert_eq!(outcome.notices, vec![StorageNotice::CorruptDataRecovered]);
    }

    fn backup_paths(directory: &Path) -> Vec<PathBuf> {
        let mut paths = fs::read_dir(directory)
            .expect("test directory should be readable")
            .map(|entry| entry.expect("test entry should be readable").path())
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with("app-data.corrupt-"))
            })
            .collect::<Vec<_>>();
        paths.sort();
        paths
    }

    #[test]
    fn missing_directory_returns_defaults_without_creating_it() {
        let parent = tempdir().expect("temporary parent should be created");
        let config_dir = parent.path().join("missing");

        let outcome = storage(&config_dir)
            .load(recovery_time())
            .expect("missing directory should load defaults");

        assert_eq!(outcome, LoadOutcome::default_without_notices());
        assert!(!config_dir.exists());
    }

    #[test]
    fn missing_file_returns_defaults_without_creating_it() {
        let directory = tempdir().expect("temporary directory should be created");

        let outcome = storage(directory.path())
            .load(recovery_time())
            .expect("missing file should load defaults");

        assert_eq!(outcome, LoadOutcome::default_without_notices());
        assert!(!app_data_path(directory.path()).exists());
    }

    #[test]
    fn saves_and_loads_a_valid_round_trip() {
        let directory = tempdir().expect("temporary directory should be created");
        let mut app_data = AppData::default();
        app_data
            .create_workspace("OpenDeck", recovery_time())
            .expect("workspace should be created");
        app_data
            .update_settings(SettingsPatch {
                color_mode: Some(ColorMode::Dark),
                sidebar_collapsed: Some(true),
                status_panel_visible: Some(false),
            })
            .expect("settings should be updated");

        storage(directory.path())
            .save(&app_data)
            .expect("valid data should save");
        let outcome = storage(directory.path())
            .load(recovery_time())
            .expect("saved data should load");

        assert_eq!(outcome.app_data, app_data);
        assert!(outcome.notices.is_empty());
        assert_eq!(outcome.app_data.validate(), Ok(()));
    }

    #[test]
    fn writes_strict_camel_case_pretty_json_with_one_trailing_newline() {
        let directory = tempdir().expect("temporary directory should be created");
        let mut app_data = AppData::default();
        app_data
            .create_workspace("OpenDeck", recovery_time())
            .expect("workspace should be created");
        app_data
            .update_settings(SettingsPatch {
                color_mode: Some(ColorMode::Dark),
                ..SettingsPatch::default()
            })
            .expect("settings should be updated");

        storage(directory.path())
            .save(&app_data)
            .expect("valid data should save");
        let contents = fs::read_to_string(app_data_path(directory.path()))
            .expect("saved data should be readable");

        assert!(contents.ends_with('\n'));
        assert!(!contents.ends_with("\n\n"));
        assert!(contents.contains("\n  \"schemaVersion\": 1,"));
        assert!(contents.contains("\"nextWorkspaceSequence\": 2"));
        assert!(contents.contains("\"colorMode\": \"dark\""));
        assert!(contents.contains("\"sidebarCollapsed\": false"));
        assert!(contents.contains("\"statusPanelVisible\": true"));
        assert!(contents.contains("\"activeWorkspaceId\": \"workspace-1\""));
        assert!(!contents.contains("schema_version"));
        assert!(!contents.contains("created_at"));
    }

    #[test]
    fn rejects_unknown_fields_in_every_persisted_object() {
        let default =
            serde_json::to_value(AppData::default()).expect("default app data should serialize");

        let mut top_level = default.clone();
        top_level
            .as_object_mut()
            .expect("app data should be an object")
            .insert("unexpected".to_owned(), json!(true));

        let mut settings = default.clone();
        settings["settings"]
            .as_object_mut()
            .expect("settings should be an object")
            .insert("unexpected".to_owned(), json!(true));

        let mut workspace = default;
        workspace["nextWorkspaceSequence"] = json!(2);
        workspace["workspaces"] = json!([{
            "id": "workspace-1",
            "name": "OpenDeck",
            "createdAt": RECOVERY_TIME,
            "updatedAt": RECOVERY_TIME,
            "unexpected": true
        }]);

        for invalid_json in [top_level, settings, workspace] {
            let directory = tempdir().expect("temporary directory should be created");
            assert_recovered(directory.path(), invalid_json);
        }
    }

    #[test]
    fn missing_fields_are_invalid() {
        let directory = tempdir().expect("temporary directory should be created");

        assert_recovered(
            directory.path(),
            json!({
                "schemaVersion": 1,
                "nextWorkspaceSequence": 1,
                "settings": {
                    "colorMode": "system",
                    "sidebarCollapsed": false
                },
                "workspaces": [],
                "activeWorkspaceId": null
            }),
        );
    }

    #[test]
    fn duplicate_fields_are_invalid() {
        let directory = tempdir().expect("temporary directory should be created");
        let original = br#"{
            "schemaVersion": 1,
            "nextWorkspaceSequence": 1,
            "nextWorkspaceSequence": 2,
            "settings": {
                "colorMode": "system",
                "sidebarCollapsed": false,
                "statusPanelVisible": true
            },
            "workspaces": [],
            "activeWorkspaceId": null
        }"#;
        write_primary(directory.path(), original);

        let outcome = storage(directory.path())
            .load(recovery_time())
            .expect("duplicate fields should recover as corrupt data");

        assert_eq!(outcome.app_data, AppData::default());
        assert_eq!(outcome.notices, vec![StorageNotice::CorruptDataRecovered]);
        assert_eq!(
            fs::read(
                directory
                    .path()
                    .join("app-data.corrupt-20260612T100000Z.json")
            )
            .expect("duplicate-field backup should be readable"),
            original
        );
    }

    #[test]
    fn invalid_field_values_are_invalid() {
        let directory = tempdir().expect("temporary directory should be created");

        assert_recovered(
            directory.path(),
            json!({
                "schemaVersion": 1,
                "nextWorkspaceSequence": 1,
                "settings": {
                    "colorMode": "sepia",
                    "sidebarCollapsed": false,
                    "statusPanelVisible": true
                },
                "workspaces": [],
                "activeWorkspaceId": null
            }),
        );
    }

    #[test]
    fn domain_invalid_schema_v1_data_recovers() {
        let directory = tempdir().expect("temporary directory should be created");

        assert_recovered(
            directory.path(),
            json!({
                "schemaVersion": 1,
                "nextWorkspaceSequence": 1,
                "settings": {
                    "colorMode": "system",
                    "sidebarCollapsed": false,
                    "statusPanelVisible": true
                },
                "workspaces": [],
                "activeWorkspaceId": "workspace-1"
            }),
        );
    }

    #[test]
    fn invalid_schema_version_shapes_recover_as_corrupt_data() {
        for invalid_version in [json!(-1), json!(1.5), json!("1"), Value::Null] {
            let directory = tempdir().expect("temporary directory should be created");
            assert_recovered(
                directory.path(),
                json!({
                    "schemaVersion": invalid_version,
                    "nextWorkspaceSequence": 1,
                    "settings": {
                        "colorMode": "system",
                        "sidebarCollapsed": false,
                        "statusPanelVisible": true
                    },
                    "workspaces": [],
                    "activeWorkspaceId": null
                }),
            );
        }

        let directory = tempdir().expect("temporary directory should be created");
        assert_recovered(
            directory.path(),
            json!({
                "nextWorkspaceSequence": 1,
                "settings": {
                    "colorMode": "system",
                    "sidebarCollapsed": false,
                    "statusPanelVisible": true
                },
                "workspaces": [],
                "activeWorkspaceId": null
            }),
        );
    }

    #[test]
    fn malformed_data_is_backed_up_exactly_and_replaced_with_defaults() {
        let directory = tempdir().expect("temporary directory should be created");
        let original = b"{\"schemaVersion\":1,\n\xffbroken";
        write_primary(directory.path(), original);

        let outcome = storage(directory.path())
            .load(recovery_time())
            .expect("malformed data should recover");

        assert_eq!(outcome.app_data, AppData::default());
        assert_eq!(outcome.notices, vec![StorageNotice::CorruptDataRecovered]);
        let backups = backup_paths(directory.path());
        assert_eq!(backups.len(), 1);
        assert_eq!(
            backups[0]
                .file_name()
                .and_then(|name| name.to_str())
                .expect("backup name should be UTF-8"),
            "app-data.corrupt-20260612T100000Z.json"
        );
        assert_eq!(
            fs::read(&backups[0]).expect("backup should be readable"),
            original
        );

        let primary = fs::read(app_data_path(directory.path()))
            .expect("recovered primary should be readable");
        assert_eq!(
            primary,
            serialize_app_data(&AppData::default())
                .expect("defaults should serialize for comparison")
        );
    }

    #[test]
    fn backup_name_collisions_use_numeric_suffixes() {
        let directory = tempdir().expect("temporary directory should be created");
        let original = b"malformed";
        let existing_backup = directory
            .path()
            .join("app-data.corrupt-20260612T100000Z.json");
        write_primary(directory.path(), original);
        fs::write(&existing_backup, b"existing backup").expect("existing backup should be written");

        storage(directory.path())
            .load(recovery_time())
            .expect("recovery should choose a suffixed backup");

        assert_eq!(
            fs::read(existing_backup).expect("existing backup should remain readable"),
            b"existing backup"
        );
        assert_eq!(
            fs::read(
                directory
                    .path()
                    .join("app-data.corrupt-20260612T100000Z-1.json")
            )
            .expect("suffixed backup should be readable"),
            original
        );
    }

    #[test]
    fn unsupported_schema_leaves_the_file_untouched() {
        let directory = tempdir().expect("temporary directory should be created");
        let original = b"{\n  \"schemaVersion\": 2,\n  \"future\": true\n}\n";
        write_primary(directory.path(), original);

        let result = storage(directory.path()).load(recovery_time());

        assert_eq!(result, Err(StorageError::UnsupportedSchema));
        assert_eq!(
            fs::read(app_data_path(directory.path()))
                .expect("unsupported file should remain readable"),
            original
        );
        assert!(backup_paths(directory.path()).is_empty());
    }

    #[test]
    fn oversized_input_leaves_the_file_untouched() {
        let directory = tempdir().expect("temporary directory should be created");
        let original = vec![b'x'; MAX_APP_DATA_BYTES + 1];
        write_primary(directory.path(), &original);

        let result = storage(directory.path()).load(recovery_time());

        assert_eq!(result, Err(StorageError::DataFileTooLarge));
        assert_eq!(
            fs::read(app_data_path(directory.path()))
                .expect("oversized file should remain readable"),
            original
        );
        assert!(backup_paths(directory.path()).is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_primary_files() {
        use std::os::unix::fs::symlink;

        let directory = tempdir().expect("temporary directory should be created");
        let target = directory.path().join("target.json");
        fs::write(&target, b"{}").expect("symlink target should be written");
        symlink(&target, app_data_path(directory.path())).expect("symlink should be created");

        assert_eq!(
            storage(directory.path()).load(recovery_time()),
            Err(StorageError::InvalidDataFileType)
        );
        assert_eq!(
            storage(directory.path()).save(&AppData::default()),
            Err(StorageError::InvalidDataFileType)
        );
    }

    #[test]
    fn rejects_non_regular_primary_entries() {
        let directory = tempdir().expect("temporary directory should be created");
        fs::create_dir(app_data_path(directory.path()))
            .expect("directory at primary path should be created");

        assert_eq!(
            storage(directory.path()).load(recovery_time()),
            Err(StorageError::InvalidDataFileType)
        );
        assert_eq!(
            storage(directory.path()).save(&AppData::default()),
            Err(StorageError::InvalidDataFileType)
        );
    }

    #[test]
    fn save_validates_before_creating_the_directory() {
        let parent = tempdir().expect("temporary parent should be created");
        let config_dir = parent.path().join("missing");
        let invalid: AppData = serde_json::from_value(json!({
            "schemaVersion": 1,
            "nextWorkspaceSequence": 1,
            "settings": {
                "colorMode": "system",
                "sidebarCollapsed": false,
                "statusPanelVisible": true
            },
            "workspaces": [],
            "activeWorkspaceId": "workspace-1"
        }))
        .expect("structurally valid test data should deserialize");

        assert_eq!(
            storage(&config_dir).save(&invalid),
            Err(StorageError::ValidationFailed(
                DomainError::InvalidActiveWorkspaceId
            ))
        );
        assert!(!config_dir.exists());
    }

    #[test]
    fn output_size_limit_accepts_the_boundary_and_rejects_larger_data() {
        assert_eq!(ensure_output_size(MAX_APP_DATA_BYTES), Ok(()));
        assert_eq!(
            ensure_output_size(MAX_APP_DATA_BYTES + 1),
            Err(StorageError::DataOutputTooLarge)
        );
    }

    #[test]
    fn atomic_replacement_leaves_no_temporary_files() {
        let directory = tempdir().expect("temporary directory should be created");
        let storage = storage(directory.path());
        storage
            .save(&AppData::default())
            .expect("initial defaults should save");

        let mut updated = AppData::default();
        updated
            .create_workspace("OpenDeck", recovery_time())
            .expect("workspace should be created");
        storage.save(&updated).expect("updated data should replace");

        let entries = directory_entries(&directory);
        assert_eq!(entries, vec![APP_DATA_FILE_NAME.to_owned()]);
        assert_eq!(
            storage
                .load(recovery_time())
                .expect("replaced data should load")
                .app_data,
            updated
        );
    }

    fn directory_entries(directory: &TempDir) -> Vec<String> {
        let mut entries = fs::read_dir(directory.path())
            .expect("test directory should be readable")
            .map(|entry| {
                entry
                    .expect("test entry should be readable")
                    .file_name()
                    .into_string()
                    .expect("test file name should be UTF-8")
            })
            .collect::<Vec<_>>();
        entries.sort();
        entries
    }
}
