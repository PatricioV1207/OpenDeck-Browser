# OpenDeck Browser Architecture

## Stack

OpenDeck Browser uses:

- Tauri for the desktop application shell.
- React for the user interface.
- TypeScript for frontend code.
- Rust for native backend commands.
- GitHub API for repository, issue, and pull request data.

## Architecture principles

- Local-first by default.
- Secure by design.
- Modular features.
- Small and reviewable changes.
- No unnecessary dependencies.
- Clear separation between UI, state, services, and native commands.
- No plaintext storage of sensitive tokens.
- No automatic execution of untrusted code.

## Suggested structure

```text
opendeck-browser/
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ features/
│  │  ├─ tabs/
│  │  ├─ projects/
│  │  ├─ github/
│  │  ├─ settings/
│  │  └─ ai/
│  ├─ lib/
│  ├─ state/
│  ├─ styles/
│  └─ types/
├─ src-tauri/
├─ docs/
├─ .github/
└─ AGENTS.md