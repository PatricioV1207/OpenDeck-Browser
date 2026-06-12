use std::sync::{Arc, Mutex, MutexGuard};

use time::OffsetDateTime;

use crate::{
    domain::app_data::{AppData, DomainError, SettingsPatch},
    error::{StateError, StateFailure, StorageError, StorageNotice},
    services::storage::AppDataStore,
};

pub trait Clock: Send + Sync {
    fn now_utc(&self) -> OffsetDateTime;
}

#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_utc(&self) -> OffsetDateTime {
        OffsetDateTime::now_utc()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateOutcome {
    pub app_data: AppData,
    pub notices: Vec<StorageNotice>,
}

pub struct AppState {
    inner: Mutex<StateInner>,
    store: Arc<dyn AppDataStore>,
    clock: Arc<dyn Clock>,
}

#[derive(Debug, Default)]
struct StateInner {
    cache: Option<AppData>,
}

impl AppState {
    pub fn new(store: Arc<dyn AppDataStore>, clock: Arc<dyn Clock>) -> Self {
        Self {
            inner: Mutex::new(StateInner::default()),
            store,
            clock,
        }
    }

    pub fn with_system_clock(store: Arc<dyn AppDataStore>) -> Self {
        Self::new(store, Arc::new(SystemClock))
    }

    pub fn load(&self) -> Result<StateOutcome, StateFailure> {
        let mut inner = self.lock_inner()?;

        if let Some(app_data) = inner.cache.as_ref() {
            return Ok(StateOutcome {
                app_data: app_data.clone(),
                notices: Vec::new(),
            });
        }

        let notices = self.load_into_cache(&mut inner, self.clock.now_utc())?;
        Ok(StateOutcome {
            app_data: cached_app_data(&inner)?.clone(),
            notices,
        })
    }

    pub fn create_workspace(&self, name: &str) -> Result<StateOutcome, StateFailure> {
        self.mutate(|app_data, now| {
            app_data.create_workspace(name, now)?;
            Ok(())
        })
    }

    pub fn rename_workspace(
        &self,
        workspace_id: &str,
        name: &str,
    ) -> Result<StateOutcome, StateFailure> {
        self.mutate(|app_data, now| {
            app_data.rename_workspace(workspace_id, name, now)?;
            Ok(())
        })
    }

    pub fn delete_workspace(&self, workspace_id: &str) -> Result<StateOutcome, StateFailure> {
        self.mutate(|app_data, _| {
            app_data.delete_workspace(workspace_id)?;
            Ok(())
        })
    }

    pub fn set_active_workspace(
        &self,
        workspace_id: Option<&str>,
    ) -> Result<StateOutcome, StateFailure> {
        self.mutate(|app_data, _| app_data.set_active_workspace(workspace_id))
    }

    pub fn update_settings(&self, patch: SettingsPatch) -> Result<StateOutcome, StateFailure> {
        self.mutate(|app_data, _| {
            app_data.update_settings(patch)?;
            Ok(())
        })
    }

    fn mutate(
        &self,
        mutation: impl FnOnce(&mut AppData, OffsetDateTime) -> Result<(), DomainError>,
    ) -> Result<StateOutcome, StateFailure> {
        let mut inner = self.lock_inner()?;
        let now = self.clock.now_utc();
        let notices = self.load_into_cache(&mut inner, now)?;
        let cached = cached_app_data(&inner)?;
        let mut draft = cached.clone();

        if let Err(error) = mutation(&mut draft, now) {
            return Err(StateFailure {
                error: StateError::Domain(error),
                notices,
            });
        }

        if draft == *cached {
            return Ok(StateOutcome {
                app_data: draft,
                notices,
            });
        }

        if let Err(error) = draft.validate() {
            return Err(StateFailure {
                error: StateError::Domain(error),
                notices,
            });
        }

        if let Err(error) = self.store.save(&draft) {
            return Err(StateFailure {
                error: StateError::Storage(error),
                notices,
            });
        }

        inner.cache = Some(draft.clone());
        Ok(StateOutcome {
            app_data: draft,
            notices,
        })
    }

    fn load_into_cache(
        &self,
        inner: &mut StateInner,
        recovery_time: OffsetDateTime,
    ) -> Result<Vec<StorageNotice>, StateFailure> {
        if inner.cache.is_some() {
            return Ok(Vec::new());
        }

        let outcome = self
            .store
            .load(recovery_time)
            .map_err(|error| StateFailure {
                error: StateError::Storage(error),
                notices: Vec::new(),
            })?;
        let notices = outcome.notices;

        if let Err(error) = outcome.app_data.validate() {
            return Err(StateFailure {
                error: StateError::Storage(StorageError::ValidationFailed(error)),
                notices,
            });
        }

        inner.cache = Some(outcome.app_data);
        Ok(notices)
    }

    fn lock_inner(&self) -> Result<MutexGuard<'_, StateInner>, StateFailure> {
        self.inner.lock().map_err(|_| StateFailure {
            error: StateError::StateUnavailable,
            notices: Vec::new(),
        })
    }
}

fn cached_app_data(inner: &StateInner) -> Result<&AppData, StateFailure> {
    inner.cache.as_ref().ok_or(StateFailure {
        error: StateError::StateUnavailable,
        notices: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use std::{
        collections::VecDeque,
        sync::{Arc, Barrier, Mutex},
        thread,
    };

    use serde_json::json;
    use time::format_description::well_known::Rfc3339;

    use super::*;
    use crate::{
        domain::app_data::{ColorMode, DomainError},
        error::{StorageError, StorageNotice},
        services::storage::LoadOutcome,
    };

    const NOW: &str = "2026-06-12T10:00:00Z";

    #[derive(Debug)]
    struct FixedClock {
        now: OffsetDateTime,
    }

    impl FixedClock {
        fn new() -> Self {
            Self {
                now: OffsetDateTime::parse(NOW, &Rfc3339).expect("fixed test time should parse"),
            }
        }
    }

    impl Clock for FixedClock {
        fn now_utc(&self) -> OffsetDateTime {
            self.now
        }
    }

    #[derive(Debug)]
    struct FakeStore {
        inner: Mutex<FakeStoreInner>,
    }

    #[derive(Debug)]
    struct FakeStoreInner {
        disk: AppData,
        load_results: VecDeque<Result<LoadOutcome, StorageError>>,
        save_results: VecDeque<Result<(), StorageError>>,
        load_count: usize,
        save_count: usize,
        save_attempts: Vec<AppData>,
    }

    impl FakeStore {
        fn new(disk: AppData) -> Self {
            Self {
                inner: Mutex::new(FakeStoreInner {
                    disk,
                    load_results: VecDeque::new(),
                    save_results: VecDeque::new(),
                    load_count: 0,
                    save_count: 0,
                    save_attempts: Vec::new(),
                }),
            }
        }

        fn queue_load(&self, result: Result<LoadOutcome, StorageError>) {
            self.inner
                .lock()
                .expect("fake store lock should be available")
                .load_results
                .push_back(result);
        }

        fn queue_save(&self, result: Result<(), StorageError>) {
            self.inner
                .lock()
                .expect("fake store lock should be available")
                .save_results
                .push_back(result);
        }

        fn replace_disk(&self, app_data: AppData) {
            self.inner
                .lock()
                .expect("fake store lock should be available")
                .disk = app_data;
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

        fn disk(&self) -> AppData {
            self.inner
                .lock()
                .expect("fake store lock should be available")
                .disk
                .clone()
        }
    }

    impl AppDataStore for FakeStore {
        fn load(&self, _recovery_time: OffsetDateTime) -> Result<LoadOutcome, StorageError> {
            let mut inner = self
                .inner
                .lock()
                .expect("fake store lock should be available");
            inner.load_count += 1;

            if let Some(result) = inner.load_results.pop_front() {
                return result;
            }

            Ok(LoadOutcome {
                app_data: inner.disk.clone(),
                notices: Vec::new(),
            })
        }

        fn save(&self, app_data: &AppData) -> Result<(), StorageError> {
            let mut inner = self
                .inner
                .lock()
                .expect("fake store lock should be available");
            inner.save_count += 1;
            inner.save_attempts.push(app_data.clone());

            if let Some(result) = inner.save_results.pop_front() {
                result?;
            }

            inner.disk = app_data.clone();
            Ok(())
        }
    }

    fn state(store: &Arc<FakeStore>) -> AppState {
        let store: Arc<dyn AppDataStore> = store.clone();
        AppState::new(store, Arc::new(FixedClock::new()))
    }

    fn app_data_with_workspace(name: &str) -> AppData {
        let mut app_data = AppData::default();
        app_data
            .create_workspace(name, FixedClock::new().now_utc())
            .expect("fixture workspace should be created");
        app_data
    }

    #[test]
    fn first_load_populates_cache_and_later_loads_ignore_disk_changes() {
        let initial = app_data_with_workspace("Initial");
        let store = Arc::new(FakeStore::new(initial.clone()));
        let state = state(&store);

        let first = state.load().expect("first load should succeed");
        store.replace_disk(app_data_with_workspace("External change"));
        let second = state.load().expect("cached load should succeed");

        assert_eq!(first.app_data, initial);
        assert_eq!(second.app_data, initial);
        assert!(first.notices.is_empty());
        assert!(second.notices.is_empty());
        assert_eq!(store.load_count(), 1);
    }

    #[test]
    fn failed_load_leaves_cache_empty_and_can_be_retried() {
        let expected = app_data_with_workspace("Retry");
        let store = Arc::new(FakeStore::new(expected.clone()));
        store.queue_load(Err(StorageError::ReadFailed));
        let state = state(&store);

        assert_eq!(
            state.load(),
            Err(StateFailure {
                error: StateError::Storage(StorageError::ReadFailed),
                notices: Vec::new(),
            })
        );
        assert_eq!(
            state.load().expect("second load should retry").app_data,
            expected
        );
        assert_eq!(store.load_count(), 2);
    }

    #[test]
    fn invalid_store_output_is_rejected_without_caching() {
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
        .expect("structurally valid fixture should deserialize");
        let store = Arc::new(FakeStore::new(AppData::default()));
        store.queue_load(Ok(LoadOutcome {
            app_data: invalid,
            notices: Vec::new(),
        }));
        let state = state(&store);

        assert_eq!(
            state.load(),
            Err(StateFailure {
                error: StateError::Storage(StorageError::ValidationFailed(
                    DomainError::InvalidActiveWorkspaceId
                )),
                notices: Vec::new(),
            })
        );
        assert_eq!(
            state.load().expect("valid retry should succeed").app_data,
            AppData::default()
        );
        assert_eq!(store.load_count(), 2);
    }

    #[test]
    fn mutation_before_explicit_load_loads_saves_and_uses_fixed_time() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        let state = state(&store);

        let outcome = state
            .create_workspace("OpenDeck")
            .expect("workspace creation should succeed");

        assert_eq!(store.load_count(), 1);
        assert_eq!(store.save_count(), 1);
        assert_eq!(outcome.app_data.active_workspace_id(), Some("workspace-1"));
        assert_eq!(outcome.app_data.workspaces()[0].created_at(), NOW);
        assert_eq!(outcome.app_data.workspaces()[0].updated_at(), NOW);
        assert_eq!(store.disk(), outcome.app_data);
    }

    #[test]
    fn state_exposes_all_domain_mutations_through_canonical_snapshots() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        let state = state(&store);

        state
            .create_workspace("First")
            .expect("first workspace should be created");
        state
            .create_workspace("Second")
            .expect("second workspace should be created");
        state
            .rename_workspace("workspace-1", "Renamed")
            .expect("workspace should be renamed");
        state
            .set_active_workspace(Some("workspace-1"))
            .expect("active workspace should change");
        let settings = state
            .update_settings(SettingsPatch {
                color_mode: Some(ColorMode::Dark),
                sidebar_collapsed: Some(true),
                status_panel_visible: Some(false),
            })
            .expect("settings should update");
        let deleted = state
            .delete_workspace("workspace-1")
            .expect("workspace should be deleted");

        assert_eq!(settings.app_data.settings().color_mode(), ColorMode::Dark);
        assert!(settings.app_data.settings().sidebar_collapsed());
        assert!(!settings.app_data.settings().status_panel_visible());
        assert_eq!(deleted.app_data.workspaces().len(), 1);
        assert_eq!(deleted.app_data.workspaces()[0].id(), "workspace-2");
        assert_eq!(deleted.app_data.active_workspace_id(), None);
        assert_eq!(store.disk(), deleted.app_data);
        assert_eq!(store.save_count(), 6);
    }

    #[test]
    fn domain_failure_does_not_save_or_change_cache() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        let state = state(&store);

        let failure = state
            .create_workspace("   ")
            .expect_err("empty name should fail");
        let cached = state
            .load()
            .expect("cached defaults should remain available");

        assert_eq!(
            failure.error,
            StateError::Domain(DomainError::EmptyWorkspaceName)
        );
        assert!(failure.notices.is_empty());
        assert_eq!(cached.app_data, AppData::default());
        assert_eq!(store.load_count(), 1);
        assert_eq!(store.save_count(), 0);
    }

    #[test]
    fn save_failure_leaves_previous_cache_unchanged() {
        let initial = app_data_with_workspace("Initial");
        let store = Arc::new(FakeStore::new(initial.clone()));
        store.queue_save(Err(StorageError::WriteFailed));
        let state = state(&store);

        let failure = state
            .rename_workspace("workspace-1", "Changed")
            .expect_err("failed save should fail the mutation");
        let cached = state
            .load()
            .expect("previous cache should remain available");

        assert_eq!(
            failure.error,
            StateError::Storage(StorageError::WriteFailed)
        );
        assert_eq!(cached.app_data, initial);
        assert_eq!(store.disk(), cached.app_data);
        assert_eq!(store.save_count(), 1);
    }

    #[test]
    fn no_op_mutations_skip_persistence() {
        let initial = app_data_with_workspace("OpenDeck");
        let store = Arc::new(FakeStore::new(initial.clone()));
        let state = state(&store);

        state
            .rename_workspace("workspace-1", "  OpenDeck  ")
            .expect("no-op rename should succeed");
        state
            .set_active_workspace(Some("workspace-1"))
            .expect("no-op active selection should succeed");
        state
            .update_settings(SettingsPatch {
                color_mode: Some(ColorMode::System),
                sidebar_collapsed: Some(false),
                status_panel_visible: Some(true),
            })
            .expect("no-op settings update should succeed");

        assert_eq!(store.load_count(), 1);
        assert_eq!(store.save_count(), 0);
        assert_eq!(state.load().expect("cache should load").app_data, initial);
    }

    #[test]
    fn successful_save_commits_the_draft_to_cache() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        let state = state(&store);

        let created = state
            .create_workspace("OpenDeck")
            .expect("workspace should be created");
        let loaded = state.load().expect("cached state should load");

        assert_eq!(loaded.app_data, created.app_data);
        assert_eq!(store.load_count(), 1);
        assert_eq!(store.save_count(), 1);
    }

    #[test]
    fn recovery_notice_is_returned_once_on_successful_triggering_operation() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        store.queue_load(Ok(LoadOutcome {
            app_data: AppData::default(),
            notices: vec![StorageNotice::CorruptDataRecovered],
        }));
        let state = state(&store);

        let created = state
            .create_workspace("OpenDeck")
            .expect("mutation should succeed after recovery");
        let later = state.load().expect("cached load should succeed");

        assert_eq!(created.notices, vec![StorageNotice::CorruptDataRecovered]);
        assert!(later.notices.is_empty());
        assert_eq!(store.load_count(), 1);
    }

    #[test]
    fn recovery_notice_is_attached_to_domain_failure_and_not_cached() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        store.queue_load(Ok(LoadOutcome {
            app_data: AppData::default(),
            notices: vec![StorageNotice::CorruptDataRecovered],
        }));
        let state = state(&store);

        let failure = state
            .create_workspace("")
            .expect_err("mutation should fail after recovery");
        let later = state
            .load()
            .expect("recovered cache should remain available");

        assert_eq!(
            failure.error,
            StateError::Domain(DomainError::EmptyWorkspaceName)
        );
        assert_eq!(failure.notices, vec![StorageNotice::CorruptDataRecovered]);
        assert!(later.notices.is_empty());
        assert_eq!(store.save_count(), 0);
    }

    #[test]
    fn recovery_notice_is_attached_to_save_failure_and_not_cached() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        store.queue_load(Ok(LoadOutcome {
            app_data: AppData::default(),
            notices: vec![StorageNotice::CorruptDataRecovered],
        }));
        store.queue_save(Err(StorageError::WriteFailed));
        let state = state(&store);

        let failure = state
            .create_workspace("OpenDeck")
            .expect_err("save should fail after recovery");
        let later = state
            .load()
            .expect("recovered cache should remain available");

        assert_eq!(
            failure.error,
            StateError::Storage(StorageError::WriteFailed)
        );
        assert_eq!(failure.notices, vec![StorageNotice::CorruptDataRecovered]);
        assert_eq!(later.app_data, AppData::default());
        assert!(later.notices.is_empty());
    }

    #[test]
    fn poisoned_mutex_returns_state_unavailable() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        let state = Arc::new(state(&store));
        let state_for_thread = state.clone();

        let result = thread::spawn(move || {
            let _guard = state_for_thread
                .inner
                .lock()
                .expect("state lock should initially be available");
            panic!("poison state mutex for test");
        })
        .join();

        assert!(result.is_err());
        assert_eq!(
            state.load(),
            Err(StateFailure {
                error: StateError::StateUnavailable,
                notices: Vec::new(),
            })
        );
        assert_eq!(store.load_count(), 0);
    }

    #[test]
    fn concurrent_mutations_are_serialized_without_lost_updates() {
        let store = Arc::new(FakeStore::new(AppData::default()));
        let state = Arc::new(state(&store));
        let barrier = Arc::new(Barrier::new(3));

        let first_state = state.clone();
        let first_barrier = barrier.clone();
        let first = thread::spawn(move || {
            first_barrier.wait();
            first_state
                .create_workspace("First")
                .expect("first concurrent mutation should succeed");
        });

        let second_state = state.clone();
        let second_barrier = barrier.clone();
        let second = thread::spawn(move || {
            second_barrier.wait();
            second_state
                .create_workspace("Second")
                .expect("second concurrent mutation should succeed");
        });

        barrier.wait();
        first.join().expect("first thread should finish");
        second.join().expect("second thread should finish");

        let outcome = state.load().expect("final cache should load");
        let mut ids = outcome
            .app_data
            .workspaces()
            .iter()
            .map(|workspace| workspace.id().to_owned())
            .collect::<Vec<_>>();
        ids.sort();

        assert_eq!(ids, vec!["workspace-1", "workspace-2"]);
        assert_eq!(outcome.app_data.next_workspace_sequence(), 3);
        assert_eq!(store.load_count(), 1);
        assert_eq!(store.save_count(), 2);
        assert_eq!(store.disk(), outcome.app_data);
    }
}
