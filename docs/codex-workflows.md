# Codex Workflows for OpenDeck Browser

## Purpose

This document defines how Codex should be used in the OpenDeck Browser project.

Codex should help with planning, implementation, review, documentation, testing, and security hardening.

## Main workflow

1. Use ChatGPT to define vision, roadmap, architecture, and project strategy.
2. Use Codex App for implementation.
3. Use `/plan` before large changes.
4. Use `/goal` only when the task is clear.
5. Use worktrees for independent tasks.
6. Review every Codex change before committing.
7. Use GitHub pull requests for review.
8. Use `@codex review` on pull requests.
9. Use Codex Security when the project has authentication, storage, and AI-related code.

## When to use `/plan`

Use `/plan` when:

- The implementation approach is unclear.
- A feature touches multiple modules.
- A security-sensitive feature is being designed.
- The project structure may change.
- A large refactor is being considered.

## When to use `/goal`

Use `/goal` when:

- The desired result is clear.
- The scope is limited.
- The stopping condition is clear.
- The required validation is known.
- The task can be reviewed as a focused change.

## Worktree strategy

Use separate worktrees for independent tasks such as:

- Main layout
- Tab system
- GitHub integration
- Issues view
- Pull requests view
- Security documentation
- AI summaries
- Tests
- Documentation

Do not use worktrees for very small changes such as typos or minor copy edits.

## Review rules

Before accepting Codex changes:

- Review the diff.
- Check new dependencies.
- Check security-sensitive code.
- Check whether documentation was updated.
- Check whether the change matches the MVP.
- Run tests and lint when available.
- Do not merge changes that you do not understand.

## Commit rules

Use small, focused commits.

Examples:

```text
docs: initialize project vision
feat: add main application layout
feat: add basic tab system
feat: add GitHub repository integration
fix: handle empty issue states
security: document token handling rules