# OpenDeck Browser Security Model

## Security goal

OpenDeck Browser must protect user data, repository information, access tokens, local files, and maintainer workflows.

Because the app is designed for open-source maintainers, it may eventually handle sensitive repository metadata, security alerts, pull request contents, and authentication tokens.

## Sensitive data

OpenDeck Browser should treat the following as sensitive:

- GitHub tokens
- User account information
- Repository metadata from private repositories
- Pull request contents from private repositories
- Issue contents from private repositories
- Local file paths
- AI prompts containing private code or private repository data
- Logs that may include credentials or URLs

## Security principles

- Do not store tokens in plaintext.
- Do not store secrets in localStorage.
- Do not commit `.env` files.
- Do not log secrets.
- Do not send repository data to AI providers without clear user action.
- Do not execute untrusted code automatically.
- Validate all data crossing the frontend/backend boundary.
- Keep Tauri permissions minimal.
- Treat external URLs as untrusted.
- Prefer explicit user confirmation for sensitive actions.

## Initial threat model

### Token leakage

Risk: GitHub tokens may be exposed through logs, localStorage, screenshots, debug output, or accidental commits.

Mitigation:
- Use secure storage when available.
- Never log tokens.
- Mask tokens in UI.
- Avoid storing credentials in frontend state longer than necessary.

### Unsafe IPC

Risk: The frontend may call backend commands with unsafe input.

Mitigation:
- Validate all command inputs.
- Keep command APIs narrow.
- Avoid generic command execution.
- Avoid exposing filesystem access without strict scope.

### Malicious repository content

Risk: Issues, pull requests, markdown, URLs, and repository metadata may contain malicious content.

Mitigation:
- Escape rendered content.
- Validate external links.
- Do not execute scripts from repository content.
- Open external links safely.

### AI privacy risk

Risk: Private repository data may be sent to an AI provider without user awareness.

Mitigation:
- AI features must be manual in the MVP.
- Show a privacy warning before sending content.
- Clearly show what content will be summarized.
- Allow users to disable AI features.

## MVP security requirements

Before the first alpha release:

- Document credential handling.
- Avoid plaintext token storage.
- Add warning for AI summaries.
- Avoid automatic code execution.
- Avoid broad filesystem permissions.
- Add SECURITY.md.