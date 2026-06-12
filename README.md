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
- A minimal Rust backend with no application IPC commands.
- A restrictive Content Security Policy and an empty main-window capability.

The internal views provide product scaffolding only. Workspace CRUD, settings
persistence, live project data, GitHub, and AI features are not implemented
yet.
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

Run the dependency-free reducer tests:

```text
npm test
```

Check Rust formatting and compilation:

```text
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
```

## Security

Read [`docs/security-model.md`](docs/security-model.md) before adding native
commands, filesystem access, external URLs, authentication, or remote content.
Report vulnerabilities according to [`SECURITY.md`](SECURITY.md).
