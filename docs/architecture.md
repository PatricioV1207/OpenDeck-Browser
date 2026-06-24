# OpenDeck Browser Architecture

## Overview

OpenDeck Browser is a single-window Tauri 2 desktop application. React and
TypeScript render the user interface inside the system WebView, while Rust owns
native capabilities, persisted application data, and future integrations that
handle credentials or network access.

The current foundation is intentionally small:

- One `main` window.
- One React application shell.
- Separate sidebar, top bar, workspace, tab strip, and status components.
- Frontend-only singleton tabs managed by React context and a reducer.
- Feature-owned read-only Home and Settings views, a Projects view with
  metadata-only create, rename, active-selection, and delete controls, and an
  About view.
- Small shared presentation components for view headers, sections, status
  labels, and information cards.
- Plain CSS organized into design tokens, global rules, and layout rules.
- A Rust-owned domain model for schema-versioned settings and metadata-only
  workspaces.
- Strict JSON storage and managed Rust state for serialized app-data access.
- Seven narrow Tauri commands registered through one invoke handler.
- Typed frontend DTOs, runtime guards, and command-specific service wrappers.
- A React app-data provider that performs one startup load, stores the
  validated snapshot and notices in memory, and exposes narrow workspace
  create, rename, active-selection, and delete actions through a shared mutation
  queue.
- One main-window capability with no granted permissions.
- No Tauri plugins, remote content, credential storage, or network
  integrations.

GitHub and AI integrations are not part of the foundation implementation.
React uses `load_app_data` during startup and the create, rename, active
selection, and delete commands through the provider action boundary. Home
presents a safe summary of the validated snapshot, Projects can create,
rename, select active, delete, and present metadata-only workspaces, and
Settings presents validated stored preferences. Settings mutations,
persisted-setting application, live repository data, repository or file
deletion, and broader persistence controls remain deferred.

## Architecture principles

- Local-first by default.
- Secure by design.
- Small, modular, and reviewable changes.
- Strict TypeScript and explicit Rust data types.
- Clear separation between UI, state, services, domain logic, and native
  commands.
- Validation on both sides of the frontend/backend boundary.
- No plaintext storage of credentials.
- No automatic execution of untrusted code.
- No remote content loaded into the main WebView.
- No dependency added without a concrete need.

## Frontend responsibilities

The React frontend renders the application shell and manages non-persisted
internal tabs. Layout components live under `components/layout`, tab state and
controls live under `features/tabs`, and shell composition lives under `app`.
Static internal view content is owned by the corresponding feature folder,
while reusable view presentation components live under `components/ui`.

Current frontend responsibilities include:

- Rendering the application shell and internal views.
- Managing open and active tabs in session memory.
- Presenting a validated app-data summary read-only in Home.
- Creating, renaming, selecting active, deleting, and presenting validated
  metadata-only workspaces in Projects.
- Presenting validated non-sensitive preferences read-only in Settings.

The app-data IPC boundary is implemented under `types` and `services/tauri`:

- Public DTO types describe app info, settings, workspaces, notices, and safe
  command errors.
- Seven command-specific wrappers call a private `invoke<unknown>` helper.
- Successful and rejected values are validated before typed data or errors are
  returned.
- Exact object fields, schema version, workspace invariants, timestamps,
  notices, and error code/field combinations are checked at runtime.
- `AppCommandError` retains only validated safe fields.
- `IpcContractError` identifies the command and contract phase without
  retaining the raw IPC value.

`AppDataProvider` calls the existing `loadAppData()` wrapper during startup,
exposes a guarded data context with `loading`, `ready`, and `error` states, and
exposes a separate action context containing `createWorkspace(name)`,
`renameWorkspace(id, name)`, `setActiveWorkspace(id)`, and
`deleteWorkspace(id)`. The action context also exposes a disconnected
`updateSettings(patch)` boundary; Settings controls and visual application
remain deferred.
The provider stores the canonical `AppDataDto` snapshot and validated notices
in React memory. A module-scoped single-flight promise ensures React Strict
Mode remounts share one startup request per JavaScript application runtime.

The shell remains visible for every state. The status panel uses fixed
frontend-owned loading, ready, error, and recovery text. It does not render raw
rejections or arbitrary notice messages. The provider rejects mutations before
app data is ready, serializes workspace and settings operations through one
shared queue, replaces state only with validated canonical command responses,
and reduces failures to safe codes.

Home maps the provider state into fixed loading, error, and ready
presentations. The ready summary shows the workspace count, active workspace
name or a fixed no-selection fallback, stored color mode, and a fixed
loaded-and-validated status. Home ignores provider notices and backend error
messages, imports no Tauri service, exposes no controls, and does not mutate
provider state.

Projects maps the provider state into fixed loading, error, empty, and ready
presentations. Its create and inline rename forms validate and trim workspace
names for immediate UX, then delegate to provider actions. Active-selection
buttons are available on every workspace card, including an already-active
safe no-op control. Delete controls open one inline confirmation at a time and
state that deletion removes only local workspace metadata, not repositories,
folders, files, credentials, or remote data. Only one rename editor is open at
a time. Rust remains authoritative and returns canonical names, IDs,
timestamps, ordering, active selection, and deletion results. Exact no-op and
case-only renames are allowed; no-op results preserve the stored update
timestamp. Active markers and workspace removal update only after a canonical
provider response. Projects does not import the Tauri service or call `invoke`
directly.

Settings maps the provider state into fixed loading, error, and ready
presentations. Ready values show the stored color mode, sidebar presentation,
and status-panel visibility with human-readable text. Settings does not render
provider error messages or notices and does not import the Tauri service,
expose commands, or mutate provider state.

The displayed `colorMode`, `sidebarCollapsed`, and `statusPanelVisible` values
are not applied to the interface yet. Future frontend state work will connect
approved mutations and application behavior without bypassing the typed
service boundary.

React context and reducers are sufficient for the foundation. A third-party
state-management library is not required.

The frontend must not:

- Store application data or credentials in `localStorage`.
- Read or write arbitrary files.
- Execute local commands.
- Make authenticated GitHub requests.
- Render arbitrary remote pages inside the application WebView.

## App-data domain

Rust owns the canonical version-1 app-data model:

```text
AppData
├─ schemaVersion: 1
├─ nextWorkspaceSequence: positive integer
├─ settings
│  ├─ colorMode: system | light | dark
│  ├─ sidebarCollapsed: boolean
│  └─ statusPanelVisible: boolean
├─ workspaces
│  ├─ id: workspace-{positive integer}
│  ├─ name
│  ├─ createdAt: RFC 3339 UTC
│  └─ updatedAt: RFC 3339 UTC
└─ activeWorkspaceId: string | null
```

`nextWorkspaceSequence` is persisted internally to prevent identifier reuse,
but it is omitted from frontend DTOs. Workspace names are trimmed, contain
between 1 and 80 Unicode characters, contain no control characters, and are
unique ignoring case. At most 1,000 workspaces may exist. Timestamps are UTC,
and `updatedAt` cannot precede `createdAt`.

Creation allocates a sequential ID and activates the new workspace. Deleting
the active workspace clears the selection. A real rename updates `updatedAt`;
an exact trimmed no-op rename does not.

## JSON storage

`JsonAppDataStorage` receives the Tauri-resolved application-config directory
and owns `app-data.json` within that directory:

- Missing directories and files return defaults without creating anything.
- Existing primary entries must be regular files; symlinks and other file types
  are rejected.
- Reads are limited to 1 MiB plus one detection byte.
- JSON uses strict camelCase persisted fields, rejects unknown or missing
  fields, and validates the complete domain model.
- Unsupported nonnegative integer schema versions are left untouched.
- Malformed JSON, invalid schema-version shapes, and invalid schema-1 data are
  preserved byte-for-byte in a timestamped corrupt backup before defaults
  replace the primary file.
- Saves validate first, produce pretty JSON with one trailing newline, enforce
  the 1 MiB output limit, and use a flushed and synchronized same-directory
  temporary file for atomic replacement.

Only non-sensitive settings and metadata-only workspace records belong in this
file. Credentials, tokens, repository content, prompts, local project paths,
and secrets are excluded.

## Managed Rust state

`AppState` owns an optional validated cache behind a mutex:

- Setup registers the state without loading data or creating a directory.
- The first load or mutation reads storage and caches the validated snapshot.
- Later loads use the cache; external file changes are intentionally ignored
  until restart.
- Mutations clone the cache, apply pure domain logic, validate, and persist the
  draft while holding the serialization lock.
- Domain failures perform no write and leave the cache unchanged.
- Save failures leave the previous cache unchanged.
- Identical mutation results skip persistence.
- Recovery notices are returned only by the operation that triggered loading
  and are not cached.
- A poisoned mutex becomes a safe state-unavailable failure.

## Tauri command boundary

The registered application command surface is:

- `get_app_info`
- `load_app_data`
- `create_workspace`
- `rename_workspace`
- `delete_workspace`
- `set_active_workspace`
- `update_settings`

Mutation commands use strict camelCase input structs with unknown-field
rejection and delegate to `AppState`. Responses expose safe DTOs only.
Application data responses contain `schemaVersion`, settings, workspaces,
`activeWorkspaceId`, and notices; they do not expose
`nextWorkspaceSequence`.

Command failures use stable codes: `validation`, `not_found`, `conflict`,
`storage`, `unsupported_schema`, and `internal`. Messages are fixed and do not
include input, paths, lock details, backtraces, or native diagnostics. A
corrupt-data recovery notice remains attached when a later operation fails.
No generic filesystem, shell, process, HTTP, dialog, opener, or command
dispatch API is exposed.

## Session state

Tabs are session state and are not persisted. Home is always open, first, and
cannot be closed. Opening another internal view appends a singleton tab or
focuses its existing tab. Closing an active tab selects the right neighbor,
then the left neighbor, then Home.

The startup app-data snapshot and recovery notices are held in React memory for
the current application runtime. The current status panel presents only this
small bootstrap state; a bounded general-purpose session status log remains
deferred.

## Suggested structure

```text
opendeck-browser/
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  ├─ components/
│  │  ├─ layout/
│  │  └─ ui/
│  ├─ features/
│  │  ├─ tabs/
│  │  ├─ home/
│  │  ├─ projects/
│  │  ├─ settings/
│  │  └─ about/
│  ├─ services/
│  │  └─ tauri/
│  ├─ state/
│  ├─ styles/
│  └─ types/
├─ src-tauri/
│  ├─ capabilities/
│  └─ src/
│     ├─ commands/
│     ├─ domain/
│     ├─ services/
│     ├─ error.rs
│     ├─ lib.rs
│     ├─ main.rs
│     └─ state.rs
├─ docs/
├─ .github/
└─ AGENTS.md
```

Feature folders own feature-specific views and logic. Shared visual primitives
belong in `components/ui`, shell components belong in `components/layout`,
cross-feature state belongs in `state`, and IPC access belongs exclusively in
`services/tauri`.

## Next implementation order

1. Connect approved non-sensitive settings mutations to Settings.
2. Apply approved stored presentation settings during bootstrap.
3. Replace the bootstrap-only status text with bounded session status state.

## Deferred decisions

The following decisions belong to later phases:

- GitHub authentication and minimum token scopes.
- Operating-system secure storage for credentials.
- GitHub HTTP client, caching, pagination, and rate-limit behavior.
- Directory-backed workspaces.
- Multiple windows, deep links, tray integration, and native menus.
- Release signing, automatic updates, and the supported platform matrix.
- AI providers, credential handling, and privacy workflows.
- Data migrations beyond schema version 1.
