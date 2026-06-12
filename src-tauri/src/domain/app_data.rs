use std::collections::HashSet;

use time::{format_description::well_known::Rfc3339, OffsetDateTime, UtcOffset};

pub const APP_DATA_SCHEMA_VERSION: u32 = 1;
pub const MAX_WORKSPACES: usize = 1_000;
pub const MAX_WORKSPACE_NAME_CHARS: usize = 80;

const WORKSPACE_ID_PREFIX: &str = "workspace-";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ColorMode {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppSettings {
    color_mode: ColorMode,
    sidebar_collapsed: bool,
    status_panel_visible: bool,
}

impl AppSettings {
    pub fn color_mode(&self) -> ColorMode {
        self.color_mode
    }

    pub fn sidebar_collapsed(&self) -> bool {
        self.sidebar_collapsed
    }

    pub fn status_panel_visible(&self) -> bool {
        self.status_panel_visible
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            color_mode: ColorMode::System,
            sidebar_collapsed: false,
            status_panel_visible: true,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SettingsPatch {
    pub color_mode: Option<ColorMode>,
    pub sidebar_collapsed: Option<bool>,
    pub status_panel_visible: Option<bool>,
}

impl SettingsPatch {
    pub fn is_empty(&self) -> bool {
        self.color_mode.is_none()
            && self.sidebar_collapsed.is_none()
            && self.status_panel_visible.is_none()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Workspace {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
}

impl Workspace {
    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn created_at(&self) -> &str {
        &self.created_at
    }

    pub fn updated_at(&self) -> &str {
        &self.updated_at
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppData {
    schema_version: u32,
    next_workspace_sequence: u64,
    settings: AppSettings,
    workspaces: Vec<Workspace>,
    active_workspace_id: Option<String>,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            schema_version: APP_DATA_SCHEMA_VERSION,
            next_workspace_sequence: 1,
            settings: AppSettings::default(),
            workspaces: Vec::new(),
            active_workspace_id: None,
        }
    }
}

impl AppData {
    pub fn schema_version(&self) -> u32 {
        self.schema_version
    }

    pub fn next_workspace_sequence(&self) -> u64 {
        self.next_workspace_sequence
    }

    pub fn settings(&self) -> &AppSettings {
        &self.settings
    }

    pub fn workspaces(&self) -> &[Workspace] {
        &self.workspaces
    }

    pub fn active_workspace_id(&self) -> Option<&str> {
        self.active_workspace_id.as_deref()
    }

    pub fn validate(&self) -> Result<(), DomainError> {
        if self.schema_version != APP_DATA_SCHEMA_VERSION {
            return Err(DomainError::UnsupportedSchemaVersion);
        }

        if self.next_workspace_sequence == 0 {
            return Err(DomainError::InvalidNextWorkspaceSequence);
        }

        if self.workspaces.len() > MAX_WORKSPACES {
            return Err(DomainError::WorkspaceLimitReached);
        }

        let mut workspace_ids = HashSet::with_capacity(self.workspaces.len());
        let mut workspace_names = HashSet::with_capacity(self.workspaces.len());
        let mut highest_workspace_sequence = 0;

        for workspace in &self.workspaces {
            let sequence = parse_workspace_sequence(&workspace.id)?;
            highest_workspace_sequence = highest_workspace_sequence.max(sequence);

            if !workspace_ids.insert(workspace.id.as_str()) {
                return Err(DomainError::DuplicateWorkspaceId);
            }

            validate_stored_workspace_name(&workspace.name)?;
            if !workspace_names.insert(normalize_workspace_name(&workspace.name)) {
                return Err(DomainError::DuplicateWorkspaceName);
            }

            let created_at = parse_utc_timestamp(&workspace.created_at, TimestampField::CreatedAt)?;
            let updated_at = parse_utc_timestamp(&workspace.updated_at, TimestampField::UpdatedAt)?;
            if updated_at < created_at {
                return Err(DomainError::UpdatedAtBeforeCreatedAt);
            }
        }

        if self.next_workspace_sequence <= highest_workspace_sequence {
            return Err(DomainError::InvalidNextWorkspaceSequence);
        }

        if let Some(active_workspace_id) = self.active_workspace_id.as_deref() {
            if !workspace_ids.contains(active_workspace_id) {
                return Err(DomainError::InvalidActiveWorkspaceId);
            }
        }

        Ok(())
    }

    pub fn create_workspace(
        &mut self,
        name: &str,
        now: OffsetDateTime,
    ) -> Result<&Workspace, DomainError> {
        self.validate()?;

        if self.workspaces.len() >= MAX_WORKSPACES {
            return Err(DomainError::WorkspaceLimitReached);
        }

        let name = validate_workspace_name(name)?;
        self.ensure_unique_workspace_name(&name, None)?;

        let next_workspace_sequence = self
            .next_workspace_sequence
            .checked_add(1)
            .ok_or(DomainError::WorkspaceIdSequenceExhausted)?;
        let id = format!("{WORKSPACE_ID_PREFIX}{}", self.next_workspace_sequence);
        let timestamp = format_utc_timestamp(now, TimestampField::CreatedAt)?;

        self.workspaces.push(Workspace {
            id: id.clone(),
            name,
            created_at: timestamp.clone(),
            updated_at: timestamp,
        });
        self.next_workspace_sequence = next_workspace_sequence;
        self.active_workspace_id = Some(id);

        self.workspaces
            .last()
            .ok_or(DomainError::InternalInvariantViolation)
    }

    pub fn rename_workspace(
        &mut self,
        workspace_id: &str,
        name: &str,
        now: OffsetDateTime,
    ) -> Result<&Workspace, DomainError> {
        self.validate()?;

        let workspace_index = self
            .workspace_index(workspace_id)
            .ok_or(DomainError::WorkspaceNotFound)?;
        let name = validate_workspace_name(name)?;

        if self.workspaces[workspace_index].name == name {
            return Ok(&self.workspaces[workspace_index]);
        }

        self.ensure_unique_workspace_name(&name, Some(workspace_index))?;
        let updated_at = format_utc_timestamp(now, TimestampField::UpdatedAt)?;
        let created_at = parse_utc_timestamp(
            &self.workspaces[workspace_index].created_at,
            TimestampField::CreatedAt,
        )?;
        let parsed_updated_at = parse_utc_timestamp(&updated_at, TimestampField::UpdatedAt)?;

        if parsed_updated_at < created_at {
            return Err(DomainError::UpdatedAtBeforeCreatedAt);
        }

        let workspace = &mut self.workspaces[workspace_index];
        workspace.name = name;
        workspace.updated_at = updated_at;

        Ok(workspace)
    }

    pub fn delete_workspace(&mut self, workspace_id: &str) -> Result<Workspace, DomainError> {
        self.validate()?;

        let workspace_index = self
            .workspace_index(workspace_id)
            .ok_or(DomainError::WorkspaceNotFound)?;
        let workspace = self.workspaces.remove(workspace_index);

        if self.active_workspace_id.as_deref() == Some(workspace_id) {
            self.active_workspace_id = None;
        }

        Ok(workspace)
    }

    pub fn set_active_workspace(&mut self, workspace_id: Option<&str>) -> Result<(), DomainError> {
        self.validate()?;

        if let Some(workspace_id) = workspace_id {
            if self.workspace_index(workspace_id).is_none() {
                return Err(DomainError::WorkspaceNotFound);
            }
        }

        self.active_workspace_id = workspace_id.map(str::to_owned);
        Ok(())
    }

    pub fn update_settings(&mut self, patch: SettingsPatch) -> Result<&AppSettings, DomainError> {
        self.validate()?;

        if patch.is_empty() {
            return Err(DomainError::EmptySettingsPatch);
        }

        if let Some(color_mode) = patch.color_mode {
            self.settings.color_mode = color_mode;
        }
        if let Some(sidebar_collapsed) = patch.sidebar_collapsed {
            self.settings.sidebar_collapsed = sidebar_collapsed;
        }
        if let Some(status_panel_visible) = patch.status_panel_visible {
            self.settings.status_panel_visible = status_panel_visible;
        }

        Ok(&self.settings)
    }

    fn workspace_index(&self, workspace_id: &str) -> Option<usize> {
        self.workspaces
            .iter()
            .position(|workspace| workspace.id == workspace_id)
    }

    fn ensure_unique_workspace_name(
        &self,
        name: &str,
        excluded_index: Option<usize>,
    ) -> Result<(), DomainError> {
        let normalized_name = normalize_workspace_name(name);
        let duplicate_exists = self
            .workspaces
            .iter()
            .enumerate()
            .any(|(index, workspace)| {
                Some(index) != excluded_index
                    && normalize_workspace_name(&workspace.name) == normalized_name
            });

        if duplicate_exists {
            return Err(DomainError::DuplicateWorkspaceName);
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimestampField {
    CreatedAt,
    UpdatedAt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DomainError {
    UnsupportedSchemaVersion,
    InvalidNextWorkspaceSequence,
    InvalidWorkspaceId,
    DuplicateWorkspaceId,
    EmptyWorkspaceName,
    InvalidWorkspaceNameWhitespace,
    WorkspaceNameTooLong,
    WorkspaceNameContainsControlCharacter,
    DuplicateWorkspaceName,
    WorkspaceLimitReached,
    WorkspaceNotFound,
    InvalidActiveWorkspaceId,
    InvalidTimestamp(TimestampField),
    TimestampNotUtc(TimestampField),
    UpdatedAtBeforeCreatedAt,
    WorkspaceIdSequenceExhausted,
    EmptySettingsPatch,
    InternalInvariantViolation,
}

fn validate_workspace_name(name: &str) -> Result<String, DomainError> {
    let name = name.trim();
    validate_stored_workspace_name(name)?;
    Ok(name.to_owned())
}

fn validate_stored_workspace_name(name: &str) -> Result<(), DomainError> {
    if name.is_empty() {
        return Err(DomainError::EmptyWorkspaceName);
    }

    if name.trim() != name {
        return Err(DomainError::InvalidWorkspaceNameWhitespace);
    }

    if name.chars().count() > MAX_WORKSPACE_NAME_CHARS {
        return Err(DomainError::WorkspaceNameTooLong);
    }

    if name.chars().any(char::is_control) {
        return Err(DomainError::WorkspaceNameContainsControlCharacter);
    }

    Ok(())
}

fn normalize_workspace_name(name: &str) -> String {
    name.to_lowercase()
}

fn parse_workspace_sequence(workspace_id: &str) -> Result<u64, DomainError> {
    let sequence = workspace_id
        .strip_prefix(WORKSPACE_ID_PREFIX)
        .ok_or(DomainError::InvalidWorkspaceId)?;

    if sequence.is_empty()
        || sequence.starts_with('0')
        || !sequence.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(DomainError::InvalidWorkspaceId);
    }

    sequence
        .parse::<u64>()
        .map_err(|_| DomainError::InvalidWorkspaceId)
}

fn format_utc_timestamp(
    timestamp: OffsetDateTime,
    field: TimestampField,
) -> Result<String, DomainError> {
    timestamp
        .to_offset(UtcOffset::UTC)
        .format(&Rfc3339)
        .map_err(|_| DomainError::InvalidTimestamp(field))
}

fn parse_utc_timestamp(
    timestamp: &str,
    field: TimestampField,
) -> Result<OffsetDateTime, DomainError> {
    let timestamp = OffsetDateTime::parse(timestamp, &Rfc3339)
        .map_err(|_| DomainError::InvalidTimestamp(field))?;

    if timestamp.offset() != UtcOffset::UTC {
        return Err(DomainError::TimestampNotUtc(field));
    }

    Ok(timestamp)
}

#[cfg(test)]
mod tests {
    use super::*;

    const CREATED_AT: &str = "2026-06-12T10:00:00Z";
    const UPDATED_AT: &str = "2026-06-12T11:00:00Z";

    fn timestamp(value: &str) -> OffsetDateTime {
        OffsetDateTime::parse(value, &Rfc3339).expect("test timestamp should be valid")
    }

    fn workspace(id: &str, name: &str, created_at: &str, updated_at: &str) -> Workspace {
        Workspace {
            id: id.to_owned(),
            name: name.to_owned(),
            created_at: created_at.to_owned(),
            updated_at: updated_at.to_owned(),
        }
    }

    #[test]
    fn default_app_data_is_valid() {
        let data = AppData::default();

        assert_eq!(data.schema_version(), APP_DATA_SCHEMA_VERSION);
        assert_eq!(data.next_workspace_sequence(), 1);
        assert!(data.workspaces().is_empty());
        assert_eq!(data.active_workspace_id(), None);
        assert_eq!(data.settings().color_mode(), ColorMode::System);
        assert!(!data.settings().sidebar_collapsed());
        assert!(data.settings().status_panel_visible());
        assert_eq!(data.validate(), Ok(()));
    }

    #[test]
    fn creates_and_activates_a_workspace() {
        let mut data = AppData::default();

        let created = data
            .create_workspace("OpenDeck", timestamp(CREATED_AT))
            .expect("workspace creation should succeed")
            .clone();

        assert_eq!(created.id(), "workspace-1");
        assert_eq!(created.name(), "OpenDeck");
        assert_eq!(created.created_at(), CREATED_AT);
        assert_eq!(created.updated_at(), CREATED_AT);
        assert_eq!(data.active_workspace_id(), Some("workspace-1"));
    }

    #[test]
    fn allocates_sequential_workspace_ids() {
        let mut data = AppData::default();

        data.create_workspace("First", timestamp(CREATED_AT))
            .expect("first workspace should be created");
        let second = data
            .create_workspace("Second", timestamp(UPDATED_AT))
            .expect("second workspace should be created");

        assert_eq!(second.id(), "workspace-2");
        assert_eq!(data.next_workspace_sequence(), 3);
    }

    #[test]
    fn does_not_reuse_deleted_workspace_ids() {
        let mut data = AppData::default();

        data.create_workspace("First", timestamp(CREATED_AT))
            .expect("first workspace should be created");
        data.create_workspace("Second", timestamp(CREATED_AT))
            .expect("second workspace should be created");
        data.delete_workspace("workspace-2")
            .expect("second workspace should be deleted");
        let third = data
            .create_workspace("Third", timestamp(UPDATED_AT))
            .expect("third workspace should be created");

        assert_eq!(third.id(), "workspace-3");
        assert_eq!(data.next_workspace_sequence(), 4);
    }

    #[test]
    fn trims_workspace_names() {
        let mut data = AppData::default();

        let workspace = data
            .create_workspace("  OpenDeck Browser  ", timestamp(CREATED_AT))
            .expect("trimmed name should be accepted");

        assert_eq!(workspace.name(), "OpenDeck Browser");
    }

    #[test]
    fn rejects_empty_workspace_names() {
        let mut data = AppData::default();

        assert_eq!(
            data.create_workspace(" \t ", timestamp(CREATED_AT)),
            Err(DomainError::EmptyWorkspaceName)
        );
    }

    #[test]
    fn rejects_workspace_names_longer_than_eighty_unicode_characters() {
        let mut data = AppData::default();
        let name = "é".repeat(MAX_WORKSPACE_NAME_CHARS + 1);

        assert_eq!(
            data.create_workspace(&name, timestamp(CREATED_AT)),
            Err(DomainError::WorkspaceNameTooLong)
        );
    }

    #[test]
    fn rejects_control_characters_in_workspace_names() {
        let mut data = AppData::default();

        assert_eq!(
            data.create_workspace("Open\nDeck", timestamp(CREATED_AT)),
            Err(DomainError::WorkspaceNameContainsControlCharacter)
        );
    }

    #[test]
    fn rejects_case_insensitive_duplicate_workspace_names() {
        let mut data = AppData::default();
        data.create_workspace("OpenDeck", timestamp(CREATED_AT))
            .expect("first workspace should be created");

        assert_eq!(
            data.create_workspace("  opendeck  ", timestamp(UPDATED_AT)),
            Err(DomainError::DuplicateWorkspaceName)
        );
    }

    #[test]
    fn newly_created_workspace_replaces_the_active_selection() {
        let mut data = AppData::default();
        data.create_workspace("First", timestamp(CREATED_AT))
            .expect("first workspace should be created");
        data.create_workspace("Second", timestamp(UPDATED_AT))
            .expect("second workspace should be created");

        assert_eq!(data.active_workspace_id(), Some("workspace-2"));
    }

    #[test]
    fn deleting_the_active_workspace_clears_the_selection() {
        let mut data = AppData::default();
        data.create_workspace("Active", timestamp(CREATED_AT))
            .expect("workspace should be created");

        data.delete_workspace("workspace-1")
            .expect("active workspace should be deleted");

        assert_eq!(data.active_workspace_id(), None);
    }

    #[test]
    fn renaming_updates_the_timestamp() {
        let mut data = AppData::default();
        data.create_workspace("Before", timestamp(CREATED_AT))
            .expect("workspace should be created");

        let renamed = data
            .rename_workspace("workspace-1", "After", timestamp(UPDATED_AT))
            .expect("workspace should be renamed");

        assert_eq!(renamed.name(), "After");
        assert_eq!(renamed.updated_at(), UPDATED_AT);
    }

    #[test]
    fn no_op_rename_preserves_the_timestamp() {
        let mut data = AppData::default();
        data.create_workspace("OpenDeck", timestamp(CREATED_AT))
            .expect("workspace should be created");

        let renamed = data
            .rename_workspace("workspace-1", "  OpenDeck  ", timestamp(UPDATED_AT))
            .expect("no-op rename should succeed");

        assert_eq!(renamed.name(), "OpenDeck");
        assert_eq!(renamed.updated_at(), CREATED_AT);
    }

    #[test]
    fn case_only_rename_updates_the_timestamp() {
        let mut data = AppData::default();
        data.create_workspace("OpenDeck", timestamp(CREATED_AT))
            .expect("workspace should be created");

        let renamed = data
            .rename_workspace("workspace-1", "opendeck", timestamp(UPDATED_AT))
            .expect("case-only rename should succeed");

        assert_eq!(renamed.name(), "opendeck");
        assert_eq!(renamed.updated_at(), UPDATED_AT);
    }

    #[test]
    fn enforces_the_workspace_limit() {
        let mut data = AppData {
            next_workspace_sequence: (MAX_WORKSPACES as u64) + 1,
            workspaces: (1..=MAX_WORKSPACES)
                .map(|sequence| {
                    workspace(
                        &format!("workspace-{sequence}"),
                        &format!("Workspace {sequence}"),
                        CREATED_AT,
                        CREATED_AT,
                    )
                })
                .collect(),
            ..AppData::default()
        };

        assert_eq!(data.validate(), Ok(()));
        assert_eq!(
            data.create_workspace("One too many", timestamp(UPDATED_AT)),
            Err(DomainError::WorkspaceLimitReached)
        );
    }

    #[test]
    fn rejects_an_active_workspace_id_that_does_not_exist() {
        let data = AppData {
            active_workspace_id: Some("workspace-1".to_owned()),
            ..AppData::default()
        };

        assert_eq!(data.validate(), Err(DomainError::InvalidActiveWorkspaceId));
    }

    #[test]
    fn rejects_invalid_and_duplicate_workspace_ids() {
        let invalid_id = AppData {
            next_workspace_sequence: 2,
            workspaces: vec![workspace("workspace-01", "First", CREATED_AT, CREATED_AT)],
            ..AppData::default()
        };
        let duplicate_id = AppData {
            next_workspace_sequence: 2,
            workspaces: vec![
                workspace("workspace-1", "First", CREATED_AT, CREATED_AT),
                workspace("workspace-1", "Second", CREATED_AT, CREATED_AT),
            ],
            ..AppData::default()
        };

        assert_eq!(invalid_id.validate(), Err(DomainError::InvalidWorkspaceId));
        assert_eq!(
            duplicate_id.validate(),
            Err(DomainError::DuplicateWorkspaceId)
        );
    }

    #[test]
    fn validates_schema_and_sequence_consistency() {
        let unsupported_schema = AppData {
            schema_version: APP_DATA_SCHEMA_VERSION + 1,
            ..AppData::default()
        };
        let zero_sequence = AppData {
            next_workspace_sequence: 0,
            ..AppData::default()
        };
        let reused_sequence = AppData {
            next_workspace_sequence: 1,
            workspaces: vec![workspace("workspace-1", "First", CREATED_AT, CREATED_AT)],
            ..AppData::default()
        };

        assert_eq!(
            unsupported_schema.validate(),
            Err(DomainError::UnsupportedSchemaVersion)
        );
        assert_eq!(
            zero_sequence.validate(),
            Err(DomainError::InvalidNextWorkspaceSequence)
        );
        assert_eq!(
            reused_sequence.validate(),
            Err(DomainError::InvalidNextWorkspaceSequence)
        );
    }

    #[test]
    fn rejects_invalid_non_utc_and_reversed_timestamps() {
        let invalid = AppData {
            next_workspace_sequence: 2,
            workspaces: vec![workspace(
                "workspace-1",
                "First",
                "not-a-timestamp",
                CREATED_AT,
            )],
            ..AppData::default()
        };
        let non_utc = AppData {
            next_workspace_sequence: 2,
            workspaces: vec![workspace(
                "workspace-1",
                "First",
                "2026-06-12T10:00:00+01:00",
                "2026-06-12T11:00:00+01:00",
            )],
            ..AppData::default()
        };
        let reversed = AppData {
            next_workspace_sequence: 2,
            workspaces: vec![workspace("workspace-1", "First", UPDATED_AT, CREATED_AT)],
            ..AppData::default()
        };

        assert_eq!(
            invalid.validate(),
            Err(DomainError::InvalidTimestamp(TimestampField::CreatedAt))
        );
        assert_eq!(
            non_utc.validate(),
            Err(DomainError::TimestampNotUtc(TimestampField::CreatedAt))
        );
        assert_eq!(
            reversed.validate(),
            Err(DomainError::UpdatedAtBeforeCreatedAt)
        );
    }

    #[test]
    fn rejects_rename_timestamps_before_creation() {
        let mut data = AppData::default();
        data.create_workspace("First", timestamp(UPDATED_AT))
            .expect("workspace should be created");

        assert_eq!(
            data.rename_workspace("workspace-1", "Renamed", timestamp(CREATED_AT)),
            Err(DomainError::UpdatedAtBeforeCreatedAt)
        );
    }

    #[test]
    fn updates_settings_and_rejects_empty_patches() {
        let mut data = AppData::default();

        let settings = data
            .update_settings(SettingsPatch {
                color_mode: Some(ColorMode::Dark),
                sidebar_collapsed: Some(true),
                status_panel_visible: Some(false),
            })
            .expect("settings patch should be applied");

        assert_eq!(settings.color_mode(), ColorMode::Dark);
        assert!(settings.sidebar_collapsed());
        assert!(!settings.status_panel_visible());
        assert_eq!(
            data.update_settings(SettingsPatch::default()),
            Err(DomainError::EmptySettingsPatch)
        );
    }

    #[test]
    fn rejects_workspace_id_sequence_overflow() {
        let mut data = AppData {
            next_workspace_sequence: u64::MAX,
            ..AppData::default()
        };

        assert_eq!(
            data.create_workspace("Overflow", timestamp(CREATED_AT)),
            Err(DomainError::WorkspaceIdSequenceExhausted)
        );
    }

    #[test]
    fn set_active_workspace_requires_an_existing_workspace() {
        let mut data = AppData::default();
        data.create_workspace("First", timestamp(CREATED_AT))
            .expect("workspace should be created");

        assert_eq!(
            data.set_active_workspace(Some("workspace-2")),
            Err(DomainError::WorkspaceNotFound)
        );
        data.set_active_workspace(None)
            .expect("active workspace should be cleared");
        assert_eq!(data.active_workspace_id(), None);
    }
}
