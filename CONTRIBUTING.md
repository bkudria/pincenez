# Contributing

## Development setup

See the [Development section in the README](README.md#development) for build, test, and run commands.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), enforced via a `commit-msg` hook (commitlint).

Examples:

```
feat: add --json output format
fix: handle empty checks file without crashing
docs: clarify --model precedence
chore(deps): bump zod to 4.0.1
```

The hook is installed automatically when you run `npm install` (via the `prepare` script).

## Pull requests

- Target the `main` branch.
- CI must pass (`lint`, `format:check`, `build`, `test`) — see [.github/workflows/ci.yml](.github/workflows/ci.yml).
- Add a [CHANGELOG.md](CHANGELOG.md) entry under `## [Unreleased]` for user-visible changes.
