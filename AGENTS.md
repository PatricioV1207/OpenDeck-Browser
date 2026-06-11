# AGENTS.md

## Project

OpenDeck Browser is an open-source browser/workspace for open-source maintainers, developers, and contributors.

The project helps users manage repositories, issues, pull requests, documentation, releases, and security workflows from a unified desktop interface.

## Main goal

Build a secure, modular, local-first desktop application using Tauri, React, TypeScript, and Rust.

## Non-goals

- Do not build a custom browser engine.
- Do not store user tokens in plaintext.
- Do not execute untrusted code automatically.
- Do not add cloud sync without explicit approval.
- Do not add unnecessary dependencies.
- Do not implement large unrelated features without updating docs first.

## Engineering rules

- Keep changes small and reviewable.
- Prefer modular code.
- Update documentation when behavior changes.
- Add tests for business logic.
- Use TypeScript types strictly.
- Validate all data crossing frontend/backend boundaries.
- Treat GitHub tokens as sensitive.
- Use secure storage for credentials when available.
- Do not hardcode secrets.
- Do not commit `.env` files.

## Security rules

- Never log credentials.
- Never store secrets in localStorage.
- Never expose tokens in screenshots, logs, or error messages.
- Validate all URLs before opening them externally.
- Keep Tauri permissions minimal.
- Do not add filesystem access without clear justification.
- Do not send private repository data to AI providers without explicit user action.

## Codex workflow

Before implementation:

- Read `docs/vision.md`.
- Read `docs/mvp.md`.
- Read `docs/architecture.md`.
- Read `docs/security-model.md`.
- Use `/plan` before large changes.

During implementation:

- Explain major architecture choices.
- Keep commits focused.
- Do not silently add dependencies.
- If a dependency is needed, explain why.
- Do not expand the MVP without updating documentation first.

Before finishing:

- Run lint if available.
- Run tests if available.
- Summarize changed files.
- Mention known limitations.
- Mention any commands that could not be run.

## Review guidelines

Codex reviews should focus on:

- Security regressions.
- Token handling.
- Unsafe Tauri commands.
- Unsafe URL handling.
- Missing validation.
- Missing tests for business logic.
- Unnecessary dependencies.
- Behavior changes without documentation.
- Large changes that should be split into smaller pull requests.