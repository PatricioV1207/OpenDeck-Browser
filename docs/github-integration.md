# GitHub Integration

## Goal

The GitHub integration should help maintainers view repositories, issues, and pull requests from OpenDeck Browser.

The MVP should be read-only by default.

## MVP scope

The first GitHub integration should support:

- Connecting a GitHub account.
- Testing the connection.
- Listing repositories.
- Selecting a repository.
- Viewing issues.
- Viewing pull requests.
- Opening the original item on GitHub.

## Out of scope

The MVP should not:

- Edit issues.
- Edit pull requests.
- Merge pull requests.
- Push commits.
- Manage repository settings.
- Automatically post comments.
- Automatically run maintainer actions.

## Security requirements

- Do not store tokens in localStorage.
- Do not log tokens.
- Mask credentials in the UI.
- Ask for user confirmation before any future write operation.
- Keep the MVP read-only.
- Show clear errors for failed authentication.

## Future features

- Pull request risk summary.
- Changelog draft generation.
- Contributor onboarding view.
- Dependency risk view.
- Release preparation assistant.