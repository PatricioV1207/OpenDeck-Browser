# OpenDeck Browser Security Model

## Security goal

OpenDeck Browser must protect user data, repository information, credentials,
local paths, and maintainer workflows. Security controls are part of the
foundation architecture and must be present before GitHub or AI integrations
are added.

## Trust boundaries

The initial application has three trust zones:

1. The React application running in the system WebView.
2. The Tauri IPC boundary.
3. Rust code with native filesystem access.

The WebView is treated as less trusted than Rust. Every IPC input is validated
in Rust, and every IPC response is treated as unknown and validated by the
frontend before use.

Repository content, URLs, issue text, pull request text, and future API
responses must be treated as untrusted data.

## Sensitive data

OpenDeck Browser treats the following as sensitive:

- GitHub and future provider credentials.
- User account information.
- Private repository, pull request, and issue data.
- Local file paths.
- AI prompts containing private repository data.
- Logs and errors that may include credentials, URLs, or private content.

The implemented app-data boundary may persist only non-sensitive settings and
metadata-only workspace records. It does not store credentials, tokens,
repository content, AI prompts, local project paths, or secrets. Setup does not
create the data file; a missing file remains absent until the first successful
mutation or corruption recovery.

## Foundation controls

### Tauri capabilities

- Use one local capability assigned only to the `main` window.
- Enable only the core permissions required for application and window
  operation.
- Do not enable shell, process, filesystem, HTTP, dialog, or opener plugins.
- Do not expose Tauri APIs globally.
- Keep the Content Security Policy restricted to bundled application assets.

The main capability grants no permissions. No shell, process, filesystem, HTTP,
dialog, opener, updater, tray, or background-process plugin is enabled.

Rust performs direct, narrowly scoped filesystem access only for
`app-data.json`, same-directory temporary files, and timestamped corrupt
backups under the application-config directory resolved by Tauri. The frontend
receives no generic filesystem command, path, directory picker, or plugin
permission.

### IPC

- Expose only `get_app_info`, `load_app_data`, `create_workspace`,
  `rename_workspace`, `delete_workspace`, `set_active_workspace`, and
  `update_settings`.
- Register the commands through one invoke handler.
- Use strict typed mutation inputs with camelCase fields and unknown-field
  rejection.
- Validate identifiers, workspace names, settings values, and schema versions.
- Do not expose generic command dispatch, arbitrary paths, or executable input.
- Return DTOs that omit internal sequence state and contain no sensitive data.
- Return structured error codes, fixed safe messages, and bounded notices.
- Do not include raw local paths, serialized input, or backtraces in frontend
  errors.
- Treat frontend IPC successes and rejections as `unknown`, then validate exact
  fields and domain invariants before returning typed values.
- Keep Tauri `invoke` private to command-specific service wrappers.
- Do not retain malformed raw IPC values in frontend errors.

The React app-data provider calls the `load_app_data` wrapper during startup
and exposes approved workspace mutations plus a disconnected `updateSettings`
action through a separate action context. Results are reduced to validated
in-memory data, fixed safe failure categories, and validated notice codes. A
single-flight promise prevents duplicate startup invokes during React Strict
Mode remounts, and one shared queue serializes workspace and settings
operations. Settings controls and visual application remain deferred.

Home consumes only the provider state. Its read-only presentation maps safe
provider failure codes to fixed Home-owned text, ignores notices and backend
messages, and displays only workspace count, active workspace name, stored
color mode, and a fixed app-data status. It exposes no commands, controls,
links, or retry behavior.

Projects consumes provider state and the narrow create, rename,
active-selection, and delete actions. Its forms send only a canonical
workspace ID and normalized workspace name, active-selection controls send only
a canonical workspace ID, and delete controls send only a canonical workspace
ID after explicit confirmation. Projects performs local UX validation where
useful and relies on Rust for authoritative validation and persistence. Rename
uses one inline editor at a time, active selection remains a metadata-only
operation, and deletion removes only local workspace metadata. Projects
performs no optimistic metadata, active-marker, or removal update and installs
only the canonical validated response. It maps action failure codes to fixed
frontend-owned text and never renders backend messages, rejected values, notice
text, paths, diagnostics, or command details. It requests no repository,
folder, path, credential, or remote-account data.

Settings also consumes only the provider state. Its read-only presentation maps
safe provider failure codes to fixed Settings-owned text, ignores notices and
backend messages, and displays only the three approved non-sensitive settings.
It exposes no commands, controls, links, or retry behavior, and it does not
apply stored values to the interface.

### App-data persistence

- Store non-sensitive data in a versioned JSON document under the operating
  system application-config directory.
- Reject symlinks and non-regular primary entries.
- Limit input and output to 1 MiB.
- Reject unknown and missing persisted fields and validate the full domain
  snapshot.
- Serialize load-modify-write operations through managed Rust state.
- Validate draft mutations and update the cache only after persistence
  succeeds.
- Use flushed and synchronized same-directory temporary files and atomic
  replacement.
- Preserve corrupt bytes in timestamped backups before replacing the primary
  file with defaults.
- Never overwrite a document with an unsupported nonnegative integer schema
  version.
- Return safe error categories without exposing paths, JSON, temporary names,
  or native diagnostics.
- Never use `localStorage` for application data or secrets.

### WebView and content

- Load only bundled application content in the main WebView.
- Do not embed arbitrary remote pages.
- Escape untrusted text before rendering.
- Add URL validation before external links are introduced.
- Do not execute scripts, commands, hooks, or repository code from untrusted
  content.

### Logging and status messages

- Never log credentials or complete command payloads.
- Keep UI status entries in memory only and limit them to 100 entries.
- Use predefined, sanitized status text.
- Map known app-data notice codes to fixed frontend-owned text; do not render
  arbitrary notice messages.
- Do not place private repository data, local paths, or native error details in
  status messages.

## Initial threat model

### Credential leakage

Risk: Future credentials may be exposed through logs, frontend state,
screenshots, errors, or plaintext persistence.

Mitigation:

- Keep credentials out of the future non-sensitive application data model.
- Add operating-system secure storage before GitHub authentication.
- Keep authenticated network operations in Rust.
- Mask credentials in any future account UI.

### Unsafe IPC

Risk: Compromised or malformed frontend code may invoke native commands with
unsafe data.

Mitigation:

- Keep the command surface narrow.
- Validate all command inputs in Rust.
- Avoid generic filesystem, URL, and process commands.
- Apply minimal window capabilities.

### Malicious remote content

Risk: Future repository content may include malicious markup, URLs, or prompt
injection.

Mitigation:

- Treat remote content as data.
- Render text safely and validate external links.
- Never execute repository content.
- Require explicit user action before future AI transmission.

### Local data corruption

Risk: Interrupted writes or incompatible versions may destroy workspace and
settings data.

Mitigation:

- Validate the full document before accepting it.
- Write atomically.
- Back up corrupt data.
- Refuse to overwrite unsupported future schemas.

## Current guardrail audit

The Step 23 app-data boundary was audited with these findings:

- The main-window capability remains empty and assigned only to `main`.
- The restrictive CSP and `withGlobalTauri: false` remain unchanged.
- No Tauri plugin or broad permission was added.
- Native filesystem access is limited to the app-config app-data files.
- The public command surface is limited to the seven named app-data commands.
- No arbitrary file, path, URL, process, shell, or network input is accepted.
- No credentials, repository content, prompts, paths, or secrets exist in the
  persisted schema or frontend DTOs.
- No `localStorage` or `sessionStorage` use exists.
- No remote content, external-link behavior, GitHub implementation, or AI
  implementation exists.
- React accesses typed app-data wrappers only through `AppDataProvider`.
- The provider exposes only the approved `create_workspace`,
  `rename_workspace`, `set_active_workspace`, and `delete_workspace`
  mutations to React and installs only validated canonical responses.
- Home reads the validated snapshot from `AppDataProvider` and presents a safe
  summary without controls or mutation behavior.
- Projects creates, renames, selects active, and deletes metadata-only
  workspaces through `AppDataProvider` and presents returned canonical
  metadata.
- Settings reads validated non-sensitive preferences from `AppDataProvider`
  and presents them without editing or application behavior.
- Repository or filesystem deletion and all settings mutations remain
  disconnected from React components.
- Persisted presentation settings are loaded but are not applied to the UI.

## Requirements before GitHub integration

- Choose an authentication method and minimum read-only scopes.
- Add operating-system-backed credential storage.
- Define logout and credential-revocation behavior.
- Keep tokens and authenticated requests in Rust.
- Add centralized external URL validation.
- Confirm that errors, logs, and screenshots cannot expose credentials.

## Requirements before AI integration

- Keep AI actions manual.
- Show exactly what content will be sent.
- Display a privacy warning before transmission.
- Require explicit user confirmation for private repository data.
- Allow AI features to be disabled.
- Do not allow repository content to trigger tools or native commands.
