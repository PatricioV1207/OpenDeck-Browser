# OpenDeck Browser

OpenDeck Browser is an open-source, local-first desktop workspace for
open-source maintainers, developers, and contributors.

## Current status

The repository currently contains the foundation build:

- A single-window Tauri 2 desktop shell.
- A React and TypeScript application layout built with Vite.
- Separate sidebar, top bar, workspace, tab strip, and status components.
- Frontend-only singleton tabs that reset when the application restarts.
- Structured static Home, Projects, Settings, and About views.
- A Rust-owned, schema-versioned app-data domain for non-sensitive settings and
  metadata-only workspaces.
- Strict JSON storage under the operating-system application-config directory,
  with bounded reads, validation, corrupt-data recovery, and atomic writes.
- Managed Rust state that lazily loads and serializes app-data mutations.
- Seven narrow Tauri commands with safe DTOs, notices, and error codes.
- Typed frontend service wrappers that validate every unknown IPC response.
- A React app-data provider that loads the validated snapshot once during
  startup and keeps it in memory.
- A restrictive Content Security Policy and an empty main-window capability.

The frontend loads app data and reports a safe startup status, but it does not
apply persisted settings or expose workspace mutations yet. Workspace CRUD UI,
settings UI behavior, live project data, GitHub, and AI features remain
deferred.
See [`docs/mvp.md`](docs/mvp.md) for the planned MVP scope.

## Prerequisites

Install:

- Node.js 22.12 or newer and npm.
- The Rust toolchain through [rustup](https://rustup.rs/).
- The operating-system prerequisites listed in the
  [Tauri documentation](https://v2.tauri.app/start/prerequisites/).

## Local development

Install the JavaScript dependencies:

```text
npm install
```

Run the frontend in a browser:

```text
npm run dev
```

Run the desktop application:

```text
npm run tauri dev
```

## Validation

Check TypeScript:

```text
npm run check
```

Build the frontend:

```text
npm run build
```

Run the dependency-free frontend tests:

```text
npm test
```

Run the Rust tests and strict Clippy checks:

```text
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Security

Read [`docs/security-model.md`](docs/security-model.md) before adding native
commands, expanding filesystem access, external URLs, authentication, or remote
content.
Report vulnerabilities according to [`SECURITY.md`](SECURITY.md).
