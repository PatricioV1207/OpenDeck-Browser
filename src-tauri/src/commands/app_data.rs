use std::fmt;

use serde::{
    de::{self, Visitor},
    Deserialize, Deserializer, Serialize,
};
use tauri::State;

use crate::{
    domain::app_data::{
        AppData, AppSettings, ColorMode, DomainError, SettingsPatch, Workspace,
        APP_DATA_SCHEMA_VERSION,
    },
    error::{StateError, StateFailure, StorageError, StorageNotice},
    state::{AppState, StateOutcome},
};

const PRODUCT_NAME: &str = "OpenDeck Browser";
const NOTICE_CORRUPT_DATA_RECOVERED_MESSAGE: &str =
    "Corrupt app data was preserved and replaced with safe defaults.";
const ERROR_VALIDATION_MESSAGE: &str = "The request contains invalid data.";
const ERROR_NOT_FOUND_MESSAGE: &str = "The requested workspace was not found.";
const ERROR_CONFLICT_MESSAGE: &str = "The request conflicts with existing app data.";
const ERROR_STORAGE_MESSAGE: &str = "App data could not be accessed safely.";
const ERROR_UNSUPPORTED_SCHEMA_MESSAGE: &str =
    "The app data was created by an unsupported version of OpenDeck Browser.";
const ERROR_INTERNAL_MESSAGE: &str = "OpenDeck Browser could not complete the request.";

type CommandResult<T> = Result<T, CommandErrorDto>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoDto {
    pub product_name: String,
    pub version: String,
    pub supported_schema_version: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDataResponseDto {
    pub data: AppDataDto,
    pub notices: Vec<NoticeDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDataDto {
    pub schema_version: u32,
    pub settings: AppSettingsDto,
    pub workspaces: Vec<WorkspaceDto>,
    pub active_workspace_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsDto {
    pub color_mode: ColorModeDto,
    pub sidebar_collapsed: bool,
    pub status_panel_visible: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ColorModeDto {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDto {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoticeDto {
    pub code: NoticeCodeDto,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NoticeCodeDto {
    CorruptDataRecovered,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorDto {
    pub code: CommandErrorCodeDto,
    pub message: String,
    pub field: Option<ErrorFieldDto>,
    pub notices: Vec<NoticeDto>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandErrorCodeDto {
    Validation,
    NotFound,
    Conflict,
    Storage,
    UnsupportedSchema,
    Internal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorFieldDto {
    Name,
    Id,
    Patch,
    SchemaVersion,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateWorkspaceInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenameWorkspaceInput {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DeleteWorkspaceInput {
    pub id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetActiveWorkspaceInput {
    pub id: RequiredNullableString,
}

#[derive(Debug)]
pub enum RequiredNullableString {
    Value(String),
    Null,
}

impl RequiredNullableString {
    fn as_deref(&self) -> Option<&str> {
        match self {
            Self::Value(value) => Some(value),
            Self::Null => None,
        }
    }
}

impl<'de> Deserialize<'de> for RequiredNullableString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct RequiredNullableStringVisitor;

        impl<'de> Visitor<'de> for RequiredNullableStringVisitor {
            type Value = RequiredNullableString;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a string or null")
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                Ok(RequiredNullableString::Null)
            }

            fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                Ok(RequiredNullableString::Value(value))
            }

            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                Ok(RequiredNullableString::Value(value.to_owned()))
            }
        }

        deserializer.deserialize_any(RequiredNullableStringVisitor)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateSettingsInput {
    pub patch: SettingsPatchInput,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsPatchInput {
    pub color_mode: Option<ColorMode>,
    pub sidebar_collapsed: Option<bool>,
    pub status_panel_visible: Option<bool>,
}

#[tauri::command]
pub fn get_app_info() -> AppInfoDto {
    AppInfoDto {
        product_name: PRODUCT_NAME.to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        supported_schema_version: APP_DATA_SCHEMA_VERSION,
    }
}

#[tauri::command]
pub fn load_app_data(state: State<'_, AppState>) -> CommandResult<AppDataResponseDto> {
    load_app_data_from_state(&state)
}

#[tauri::command]
pub fn create_workspace(
    state: State<'_, AppState>,
    input: CreateWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    create_workspace_from_state(&state, input)
}

#[tauri::command]
pub fn rename_workspace(
    state: State<'_, AppState>,
    input: RenameWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    rename_workspace_from_state(&state, input)
}

#[tauri::command]
pub fn delete_workspace(
    state: State<'_, AppState>,
    input: DeleteWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    delete_workspace_from_state(&state, input)
}

#[tauri::command]
pub fn set_active_workspace(
    state: State<'_, AppState>,
    input: SetActiveWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    set_active_workspace_from_state(&state, input)
}

#[tauri::command]
pub fn update_settings(
    state: State<'_, AppState>,
    input: UpdateSettingsInput,
) -> CommandResult<AppDataResponseDto> {
    update_settings_from_state(&state, input)
}

fn load_app_data_from_state(state: &AppState) -> CommandResult<AppDataResponseDto> {
    state
        .load()
        .map(AppDataResponseDto::from)
        .map_err(Into::into)
}

fn create_workspace_from_state(
    state: &AppState,
    input: CreateWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    state
        .create_workspace(&input.name)
        .map(AppDataResponseDto::from)
        .map_err(Into::into)
}

fn rename_workspace_from_state(
    state: &AppState,
    input: RenameWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    state
        .rename_workspace(&input.id, &input.name)
        .map(AppDataResponseDto::from)
        .map_err(Into::into)
}

fn delete_workspace_from_state(
    state: &AppState,
    input: DeleteWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    state
        .delete_workspace(&input.id)
        .map(AppDataResponseDto::from)
        .map_err(Into::into)
}

fn set_active_workspace_from_state(
    state: &AppState,
    input: SetActiveWorkspaceInput,
) -> CommandResult<AppDataResponseDto> {
    state
        .set_active_workspace(input.id.as_deref())
        .map(AppDataResponseDto::from)
        .map_err(Into::into)
}

fn update_settings_from_state(
    state: &AppState,
    input: UpdateSettingsInput,
) -> CommandResult<AppDataResponseDto> {
    state
        .update_settings(input.patch.into())
        .map(AppDataResponseDto::from)
        .map_err(Into::into)
}

impl From<StateOutcome> for AppDataResponseDto {
    fn from(outcome: StateOutcome) -> Self {
        Self {
            data: outcome.app_data.into(),
            notices: outcome.notices.into_iter().map(NoticeDto::from).collect(),
        }
    }
}

impl From<AppData> for AppDataDto {
    fn from(app_data: AppData) -> Self {
        Self {
            schema_version: app_data.schema_version(),
            settings: app_data.settings().into(),
            workspaces: app_data
                .workspaces()
                .iter()
                .map(WorkspaceDto::from)
                .collect(),
            active_workspace_id: app_data.active_workspace_id().map(str::to_owned),
        }
    }
}

impl From<&AppSettings> for AppSettingsDto {
    fn from(settings: &AppSettings) -> Self {
        Self {
            color_mode: settings.color_mode().into(),
            sidebar_collapsed: settings.sidebar_collapsed(),
            status_panel_visible: settings.status_panel_visible(),
        }
    }
}

impl From<ColorMode> for ColorModeDto {
    fn from(color_mode: ColorMode) -> Self {
        match color_mode {
            ColorMode::System => Self::System,
            ColorMode::Light => Self::Light,
            ColorMode::Dark => Self::Dark,
        }
    }
}

impl From<&Workspace> for WorkspaceDto {
    fn from(workspace: &Workspace) -> Self {
        Self {
            id: workspace.id().to_owned(),
            name: workspace.name().to_owned(),
            created_at: workspace.created_at().to_owned(),
            updated_at: workspace.updated_at().to_owned(),
        }
    }
}

impl From<StorageNotice> for NoticeDto {
    fn from(notice: StorageNotice) -> Self {
        match notice {
            StorageNotice::CorruptDataRecovered => Self {
                code: NoticeCodeDto::CorruptDataRecovered,
                message: NOTICE_CORRUPT_DATA_RECOVERED_MESSAGE.to_owned(),
            },
        }
    }
}

impl From<SettingsPatchInput> for SettingsPatch {
    fn from(patch: SettingsPatchInput) -> Self {
        Self {
            color_mode: patch.color_mode,
            sidebar_collapsed: patch.sidebar_collapsed,
            status_panel_visible: patch.status_panel_visible,
        }
    }
}

impl From<StateFailure> for CommandErrorDto {
    fn from(failure: StateFailure) -> Self {
        let notices = failure.notices.into_iter().map(NoticeDto::from).collect();
        let (code, message, field) = map_state_error(failure.error);

        Self {
            code,
            message: message.to_owned(),
            field,
            notices,
        }
    }
}

fn map_state_error(
    error: StateError,
) -> (CommandErrorCodeDto, &'static str, Option<ErrorFieldDto>) {
    match error {
        StateError::Domain(error) => map_domain_error(error),
        StateError::Storage(StorageError::UnsupportedSchema) => (
            CommandErrorCodeDto::UnsupportedSchema,
            ERROR_UNSUPPORTED_SCHEMA_MESSAGE,
            Some(ErrorFieldDto::SchemaVersion),
        ),
        StateError::Storage(StorageError::ValidationFailed(_)) | StateError::StateUnavailable => {
            (CommandErrorCodeDto::Internal, ERROR_INTERNAL_MESSAGE, None)
        }
        StateError::Storage(_) => (CommandErrorCodeDto::Storage, ERROR_STORAGE_MESSAGE, None),
    }
}

fn map_domain_error(
    error: DomainError,
) -> (CommandErrorCodeDto, &'static str, Option<ErrorFieldDto>) {
    match error {
        DomainError::EmptyWorkspaceName
        | DomainError::InvalidWorkspaceNameWhitespace
        | DomainError::WorkspaceNameTooLong
        | DomainError::WorkspaceNameContainsControlCharacter => (
            CommandErrorCodeDto::Validation,
            ERROR_VALIDATION_MESSAGE,
            Some(ErrorFieldDto::Name),
        ),
        DomainError::EmptySettingsPatch => (
            CommandErrorCodeDto::Validation,
            ERROR_VALIDATION_MESSAGE,
            Some(ErrorFieldDto::Patch),
        ),
        DomainError::WorkspaceNotFound => (
            CommandErrorCodeDto::NotFound,
            ERROR_NOT_FOUND_MESSAGE,
            Some(ErrorFieldDto::Id),
        ),
        DomainError::DuplicateWorkspaceName | DomainError::WorkspaceLimitReached => (
            CommandErrorCodeDto::Conflict,
            ERROR_CONFLICT_MESSAGE,
            Some(ErrorFieldDto::Name),
        ),
        DomainError::UnsupportedSchemaVersion => (
            CommandErrorCodeDto::UnsupportedSchema,
            ERROR_UNSUPPORTED_SCHEMA_MESSAGE,
            Some(ErrorFieldDto::SchemaVersion),
        ),
        DomainError::InvalidNextWorkspaceSequence
        | DomainError::InvalidWorkspaceId
        | DomainError::DuplicateWorkspaceId
        | DomainError::InvalidActiveWorkspaceId
        | DomainError::InvalidTimestamp(_)
        | DomainError::TimestampNotUtc(_)
        | DomainError::UpdatedAtBeforeCreatedAt
        | DomainError::WorkspaceIdSequenceExhausted
        | DomainError::InternalInvariantViolation => {
            (CommandErrorCodeDto::Internal, ERROR_INTERNAL_MESSAGE, None)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use serde_json::{json, Value};
    use time::{format_description::well_known::Rfc3339, OffsetDateTime};

    use super::*;
    use crate::{
        services::storage::{AppDataStore, LoadOutcome},
        state::Clock,
    };

    const NOW: &str = "2026-06-12T10:00:00Z";

    #[derive(Debug)]
    struct FixedClock;

    impl Clock for FixedClock {
        fn now_utc(&self) -> OffsetDateTime {
            OffsetDateTime::parse(NOW, &Rfc3339).expect("fixed time should parse")
        }
    }

    #[derive(Debug)]
    struct FakeStore {
        inner: Mutex<FakeStoreInner>,
    }

    #[derive(Debug)]
    struct FakeStoreInner {
        app_data: AppData,
        notices: Vec<StorageNotice>,
        save_error: Option<StorageError>,
        load_count: usize,
        save_count: usize,
    }

    impl FakeStore {
        fn new(app_data: AppData) -> Self {
            Self {
                inner: Mutex::new(FakeStoreInner {
                    app_data,
                    notices: Vec::new(),
                    save_error: None,
                    load_count: 0,
                    save_count: 0,
                }),
            }
        }

        fn with_notices(app_data: AppData, notices: Vec<StorageNotice>) -> Self {
            Self {
                inner: Mutex::new(FakeStoreInner {
                    app_data,
                    notices,
                    save_error: None,
                    load_count: 0,
                    save_count: 0,
                }),
            }
        }

        fn load_count(&self) -> usize {
            self.inner
                .lock()
                .expect("fake store lock should be available")
                .load_count
        }

        fn save_count(&self) -> usize {
            self.inner
                .lock()
                .expect("fake store lock should be available")
                .save_count
        }
    }

    impl AppDataStore for FakeStore {
        fn load(&self, _recovery_time: OffsetDateTime) -> Result<LoadOutcome, StorageError> {
            let mut inner = self
                .inner
                .lock()
                .expect("fake store lock should be available");
            inner.load_count += 1;
            Ok(LoadOutcome {
                app_data: inner.app_data.clone(),
                notices: std::mem::take(&mut inner.notices),
            })
        }

        fn save(&self, app_data: &AppData) -> Result<(), StorageError> {
            let mut inner = self
                .inner
                .lock()
                .expect("fake store lock should be available");
            inner.save_count += 1;
            if let Some(error) = inner.save_error {
                return Err(error);
            }
            inner.app_data = app_data.clone();
            Ok(())
        }
    }

    fn state(store: &Arc<FakeStore>) -> AppState {
        let store: Arc<dyn AppDataStore> = store.clone();
        AppState::new(store, Arc::new(FixedClock))
    }

    fn state_failure(error: StateError) -> StateFailure {
        StateFailure {
            error,
            notices: Vec::new(),
        }
    }

    #[test]
    fn app_info_dto_uses_fixed_public_metadata() {
        assert_eq!(
            get_app_info(),
            AppInfoDto {
                product_name: "OpenDeck Browser".to_owned(),
                version: env!("CARGO_PKG_VERSION").to_owned(),
                supported_schema_version: APP_DATA_SCHEMA_VERSION,
            }
        );
        assert_eq!(
            serde_json::to_value(get_app_info()).expect("app info should serialize"),
            json!({
                "productName": "OpenDeck Browser",
                "version": env!("CARGO_PKG_VERSION"),
                "supportedSchemaVersion": 1
            })
        );
    }

    #[test]
    fn app_data_dto_conversion_is_safe_and_omits_internal_sequence() {
        let mut app_data = AppData::default();
        app_data
            .create_workspace("OpenDeck", FixedClock.now_utc())
            .expect("workspace should be created");
        app_data
            .update_settings(SettingsPatch {
                color_mode: Some(ColorMode::Dark),
                sidebar_collapsed: Some(true),
                status_panel_visible: Some(false),
            })
            .expect("settings should update");

        let dto: AppDataDto = app_data.into();
        let value = serde_json::to_value(dto).expect("app data DTO should serialize");

        assert_eq!(
            value,
            json!({
                "schemaVersion": 1,
                "settings": {
                    "colorMode": "dark",
                    "sidebarCollapsed": true,
                    "statusPanelVisible": false
                },
                "workspaces": [{
                    "id": "workspace-1",
                    "name": "OpenDeck",
                    "createdAt": NOW,
                    "updatedAt": NOW
                }],
                "activeWorkspaceId": "workspace-1"
            })
        );
        assert!(value.get("nextWorkspaceSequence").is_none());
    }

    #[test]
    fn notice_dto_uses_stable_code_and_fixed_message() {
        let value = serde_json::to_value(NoticeDto::from(StorageNotice::CorruptDataRecovered))
            .expect("notice should serialize");

        assert_eq!(
            value,
            json!({
                "code": "corrupt_data_recovered",
                "message": NOTICE_CORRUPT_DATA_RECOVERED_MESSAGE
            })
        );
    }

    #[test]
    fn maps_validation_not_found_and_conflict_errors() {
        let validation = CommandErrorDto::from(state_failure(StateError::Domain(
            DomainError::EmptyWorkspaceName,
        )));
        let not_found = CommandErrorDto::from(state_failure(StateError::Domain(
            DomainError::WorkspaceNotFound,
        )));
        let conflict = CommandErrorDto::from(state_failure(StateError::Domain(
            DomainError::DuplicateWorkspaceName,
        )));

        assert_eq!(validation.code, CommandErrorCodeDto::Validation);
        assert_eq!(validation.message, ERROR_VALIDATION_MESSAGE);
        assert_eq!(validation.field, Some(ErrorFieldDto::Name));
        assert_eq!(not_found.code, CommandErrorCodeDto::NotFound);
        assert_eq!(not_found.message, ERROR_NOT_FOUND_MESSAGE);
        assert_eq!(not_found.field, Some(ErrorFieldDto::Id));
        assert_eq!(conflict.code, CommandErrorCodeDto::Conflict);
        assert_eq!(conflict.message, ERROR_CONFLICT_MESSAGE);
        assert_eq!(conflict.field, Some(ErrorFieldDto::Name));
    }

    #[test]
    fn maps_storage_unsupported_schema_and_internal_errors() {
        let storage =
            CommandErrorDto::from(state_failure(StateError::Storage(StorageError::ReadFailed)));
        let unsupported = CommandErrorDto::from(state_failure(StateError::Storage(
            StorageError::UnsupportedSchema,
        )));
        let internal = CommandErrorDto::from(state_failure(StateError::StateUnavailable));

        assert_eq!(storage.code, CommandErrorCodeDto::Storage);
        assert_eq!(storage.message, ERROR_STORAGE_MESSAGE);
        assert_eq!(storage.field, None);
        assert_eq!(unsupported.code, CommandErrorCodeDto::UnsupportedSchema);
        assert_eq!(unsupported.message, ERROR_UNSUPPORTED_SCHEMA_MESSAGE);
        assert_eq!(unsupported.field, Some(ErrorFieldDto::SchemaVersion));
        assert_eq!(internal.code, CommandErrorCodeDto::Internal);
        assert_eq!(internal.message, ERROR_INTERNAL_MESSAGE);
        assert_eq!(internal.field, None);
    }

    #[test]
    fn state_failure_notices_remain_attached_to_command_errors() {
        let error = CommandErrorDto::from(StateFailure {
            error: StateError::Domain(DomainError::EmptyWorkspaceName),
            notices: vec![StorageNotice::CorruptDataRecovered],
        });

        assert_eq!(error.notices.len(), 1);
        assert_eq!(error.notices[0].code, NoticeCodeDto::CorruptDataRecovered);
    }

    #[test]
    fn strict_inputs_reject_unknown_wrong_case_and_missing_required_fields() {
        assert!(serde_json::from_value::<CreateWorkspaceInput>(json!({
            "name": "OpenDeck",
            "unexpected": true
        }))
        .is_err());
        assert!(serde_json::from_value::<RenameWorkspaceInput>(json!({
            "id": "workspace-1",
            "Name": "OpenDeck"
        }))
        .is_err());
        assert!(serde_json::from_value::<DeleteWorkspaceInput>(json!({})).is_err());
        assert!(serde_json::from_value::<SetActiveWorkspaceInput>(json!({})).is_err());
        assert!(serde_json::from_value::<UpdateSettingsInput>(json!({
            "patch": {
                "sidebarCollapsed": true,
                "unexpected": false
            }
        }))
        .is_err());
    }

    #[test]
    fn strict_inputs_accept_expected_camel_case_and_nullable_id() {
        let create: CreateWorkspaceInput = serde_json::from_value(json!({ "name": "OpenDeck" }))
            .expect("create input should deserialize");
        let settings: UpdateSettingsInput = serde_json::from_value(json!({
            "patch": {
                "colorMode": "light",
                "sidebarCollapsed": true,
                "statusPanelVisible": false
            }
        }))
        .expect("settings input should deserialize");
        let cleared: SetActiveWorkspaceInput =
            serde_json::from_value(json!({ "id": null })).expect("nullable ID should deserialize");

        assert_eq!(create.name, "OpenDeck");
        assert_eq!(settings.patch.color_mode, Some(ColorMode::Light));
        assert_eq!(settings.patch.sidebar_collapsed, Some(true));
        assert_eq!(settings.patch.status_panel_visible, Some(false));
        assert!(matches!(cleared.id, RequiredNullableString::Null));
    }

    #[test]
    fn thin_command_helpers_delegate_to_app_state_and_return_safe_dtos() {
        let store = Arc::new(FakeStore::with_notices(
            AppData::default(),
            vec![StorageNotice::CorruptDataRecovered],
        ));
        let state = state(&store);

        let loaded = load_app_data_from_state(&state).expect("load command helper should succeed");
        let created = create_workspace_from_state(
            &state,
            CreateWorkspaceInput {
                name: "OpenDeck".to_owned(),
            },
        )
        .expect("create command helper should succeed");

        assert_eq!(loaded.data.schema_version, 1);
        assert_eq!(loaded.notices[0].code, NoticeCodeDto::CorruptDataRecovered);
        assert_eq!(created.data.workspaces.len(), 1);
        assert_eq!(created.data.workspaces[0].id, "workspace-1");
        assert!(created.notices.is_empty());
        assert_eq!(store.load_count(), 1);
        assert_eq!(store.save_count(), 1);

        let value =
            serde_json::to_value(created).expect("command response DTO should serialize safely");
        assert!(value["data"].get("nextWorkspaceSequence").is_none());
    }

    #[test]
    fn command_helper_maps_domain_failures_without_exposing_input() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        let state = state(&store);
        let error = create_workspace_from_state(
            &state,
            CreateWorkspaceInput {
                name: "secret-looking-input".repeat(20),
            },
        )
        .expect_err("long name should fail");
        let value = serde_json::to_value(error).expect("command error should serialize");

        assert_eq!(value["code"], Value::String("validation".to_owned()));
        assert_eq!(
            value["message"],
            Value::String(ERROR_VALIDATION_MESSAGE.to_owned())
        );
        assert!(!value.to_string().contains("secret-looking-input"));
    }
}
