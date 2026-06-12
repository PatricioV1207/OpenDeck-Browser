# OpenDeck Browser Release Plan

## First release

The first public release will be:

```text
v0.1.0-alpha
```

This alpha release should demonstrate the MVP described in
[`mvp.md`](mvp.md). It is intended for early evaluation by open-source
maintainers, contributors, and security-minded reviewers.

The alpha label means the application is still under active development.
Users should expect incomplete workflows, limited platform validation, and
behavioral changes before a stable release.

## Release principles

- Keep the release within the documented MVP scope.
- Keep GitHub workflows read-only.
- Require explicit user action for AI summaries.
- Do not execute untrusted repository code.
- Do not release with known critical security issues.
- Document known limitations clearly.
- Prefer a delayed release over bypassing security or validation requirements.

## Release readiness

The release is ready only when the MVP success criteria in
[`mvp.md`](mvp.md) have been verified and the following checks are complete.

### Product checks

- The desktop application starts successfully on each supported release
  platform.
- The main layout, tabs, and internal views are usable.
- A user can add or select a local project workspace.
- A user can connect to GitHub and test the connection.
- Repository, issue, and pull request views handle loading, empty, success, and
  error states.
- External GitHub links open only after URL validation.
- Issue and pull request summaries run only after explicit user action.

### Security checks

- GitHub credentials are not stored in plaintext or in `localStorage`.
- Credentials and private repository data are absent from logs, screenshots,
  errors, and release artifacts.
- Tauri commands validate all frontend input and expose only the permissions
  required by the MVP.
- Repository content is treated as untrusted and rendered without executing
  scripts.
- AI summaries show what content will be sent and display a privacy warning
  before transmission.
- The requirements in [`security-model.md`](security-model.md) and the root
  `SECURITY.md` have been reviewed.

### Quality checks

- Available formatting, lint, type-checking, and test commands pass.
- Business logic added for the MVP has focused automated tests.
- Critical user flows have been checked manually.
- Dependency changes have been reviewed for necessity, licensing, and known
  security risks.
- The release build completes without credentials or local development data.

### Documentation checks

- `README.md` explains the project, current status, setup, and validation
  commands.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` are complete.
- The documented behavior matches the release.
- Known limitations and unsupported workflows are listed in the release notes.
- Installation or launch instructions have been verified from a clean
  environment.

## Release process

1. Freeze the alpha scope to the features in [`mvp.md`](mvp.md).
2. Review all changes planned for the release.
3. Run the quality and security checks listed above.
4. Prepare release notes with completed features, security considerations,
   known limitations, and upgrade notes when applicable.
5. Build and manually verify the release artifacts for each supported
   platform.
6. Create the `v0.1.0-alpha` tag from the reviewed release commit.
7. Publish the source and verified release artifacts with their release notes.
8. Announce the alpha as an early testing release and provide links for bug
   reports and security disclosures.

## Known alpha limitations

The alpha remains subject to the exclusions documented in
[`mvp.md`](mvp.md). In particular, it will not include cloud sync, automatic
repository changes, automatic execution of remote code, or integrations beyond
GitHub.

GitHub operations remain read-only, and AI summaries remain manual. Any
additional limitations discovered during validation must be added to the
release notes before publication.

## After release

- Collect feedback from maintainers and contributors.
- Triage bugs separately from feature requests.
- Handle security reports through the process in `SECURITY.md`.
- Record validation gaps and platform-specific issues.
- Use the documented roadmap to prioritize follow-up work without silently
  expanding the MVP.
