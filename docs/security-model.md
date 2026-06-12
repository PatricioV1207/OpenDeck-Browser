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

The foundation build does not create an application data file. A later
workspace and settings implementation may persist only non-sensitive settings
and metadata-only workspace names.

## Foundation controls

### Tauri capabilities

- Use one local capability assigned only to the `main` window.
- Enable only the core permissions required for application and window
  operation.
- Do not enable shell, process, filesystem, HTTP, dialog, or opener plugins.
- Do not expose Tauri APIs globally.
- Keep the Content Security Policy restricted to bundled application assets.

The foundation Rust code performs no application filesystem access. The
frontend receives no generic filesystem command.

### IPC

- Expose no application commands in the foundation build.
- Add only narrow, named commands with typed input and output in later changes.
- Validate identifiers, workspace names, settings values, and schema versions.
- Do not expose generic command dispatch, arbitrary paths, or executable input.
- Return structured error codes and safe messages.
- Do not include raw local paths, serialized input, or backtraces in frontend
  errors.

### Future persistence

- Store non-sensitive data in a versioned JSON document under the operating
  system application-config directory.
- Serialize writes to prevent concurrent file corruption.
- Use temporary files and atomic replacement.
- Preserve corrupt data for recovery without exposing its path in the UI.
- Never overwrite a document with a newer unsupported schema.
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
