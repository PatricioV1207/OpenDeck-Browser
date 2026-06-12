# AGENTS.md

## Project And Language

OpenDeck Browser is an open-source browser/workspace for open-source
maintainers, developers, and contributors.

The project helps users manage repositories, issues, pull requests,
documentation, releases, and security workflows from a unified desktop
interface.

The main goal is to build a secure, modular, local-first desktop application
using Tauri, React, TypeScript, and Rust.

Non-goals:

- Do not build a custom browser engine.
- Do not store user tokens in plaintext.
- Do not execute untrusted code automatically.
- Do not add cloud sync without explicit approval.
- Do not add unnecessary dependencies.
- Do not implement large unrelated features without updating docs first.

All repository files, documentation, code comments, commit messages, pull
request descriptions, and Codex-facing project content must be in English.
User-facing conversation may be in Spanish or another language.

## Scope And Workflow

- Work in small, modular, reviewable substeps.
- Do not broaden scope without explicit approval.
- Do not implement an entire roadmap phase in one task.
- Use `/plan` before non-trivial, cross-module, architectural, or
  security-sensitive implementation.
- Use `/goal` only for a clearly approved substep with known validation and a
  clear stopping condition.
- Use `/review` for storage, IPC, Tauri commands, authentication, tokens, AI
  payloads, security, and release work.
- Before non-trivial implementation, read `docs/vision.md`, `docs/mvp.md`,
  `docs/architecture.md`, and `docs/security-model.md`.
- Update documentation when behavior or architecture changes.
- Add focused tests for business logic and boundary validation.
- Use strict TypeScript and explicit Rust types.
- Do not silently add dependencies. Explain and obtain approval for any needed
  dependency.

## Architecture Boundaries

- React owns presentation and UI state only. It must not own local persistence
  or privileged operations.
- Rust/Tauri owns validation, local persistence, managed state, and privileged
  operations.
- Persisted app data uses schema version 1.
- `nextWorkspaceSequence` is internal Rust state and must never be exposed to
  React or included in frontend DTOs.
- Read and write app data only through the approved Rust JSON storage service
  for `app-data.json`.
- `AppState` owns the validated cache and serializes load-modify-write
  operations. Do not bypass it from commands.
- Tauri commands must remain narrow, named, typed, validated, and limited to
  safe DTOs.
- Frontend services must call specific commands through a private
  `invoke<unknown>` helper and runtime-validate every success and rejection.
- Do not export a generic invoke wrapper.
- React UI must not call raw Tauri `invoke` directly.

## Security Guardrails

- Do not use `localStorage` or `sessionStorage` for app data, tokens,
  credentials, secrets, prompts, repository data, or user data.
- Do not store credentials, tokens, repository data, prompts, paths, or secrets
  in `app-data.json`.
- Frontend-facing and user-facing errors must not expose raw filesystem paths,
  command payloads, serialized input, lock details, backtraces, or native
  diagnostics.
- Require an explicit plan and approval before adding plugins, permissions,
  capabilities, remote content, external links, or broader native access.
- Do not add filesystem plugin permissions, shell or process permissions, the
  opener or HTTP plugin, updater behavior, remote content, or broad
  capabilities without that approval.
- Do not introduce GitHub tokens until a dedicated credential-storage design
  is approved.
- Do not implement AI features until privacy, consent, and payload-review
  behavior is designed and approved.
- Do not hardcode or commit secrets.
- Do not commit `.env` files.
- Never log credentials or expose tokens in logs, screenshots, or errors.
- Do not execute untrusted code or repository content automatically.

## Validation And Review

Run the checks relevant to the files changed.

Frontend changes:

```text
npm test
npm run check
npm run build
```

Rust changes:

```text
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Documentation and final diff checks:

```text
git diff --check
```

For sensitive changes, include a short audit covering the command surface,
permissions, persistence, data exposure, and dependency changes.

Finish each task summary with:

- Changed files.
- Validation results.
- Known limitations.
- Commands that could not be run.

Reviews must prioritize:

- Security regressions.
- Unsafe IPC or Tauri commands.
- Storage correctness and recovery behavior.
- Missing frontend/backend boundary validation.
- Sensitive-data exposure.
- Unnecessary dependencies.
- Scope that is too large for one reviewable task.
