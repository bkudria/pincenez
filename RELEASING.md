# Releasing

Pincenez follows [Semantic Versioning](https://semver.org/). Until 1.0, breaking changes may land in minor versions.

## Steps

1. **Confirm CI is green** on `main`.

2. **Update CHANGELOG.md** — rename the `## [Unreleased]` heading to `## [X.Y.Z] - YYYY-MM-DD` and add a new empty `## [Unreleased]` above it. Commit:

   ```bash
   git commit -m "chore(release): X.Y.Z"
   ```

3. **Bump version + tag** — `npm version` updates `package.json`, creates a commit, and creates a tag matching the new version:

   ```bash
   npm version <patch|minor|major>   # e.g. patch: 0.1.0 → 0.1.1
   ```

4. **Push the commit and tag**:

   ```bash
   git push --follow-tags
   ```

5. **Publish to npm** — `prepublishOnly` runs `npm run build` automatically:

   ```bash
   npm publish
   ```

6. **Create a GitHub Release** from the new tag, pasting the corresponding CHANGELOG section as the release notes:

   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-from-tag
   ```

## Verifying the release

- `npm view pincenez version` should show the new version.
- `npx pincenez@X.Y.Z --version` should print `X.Y.Z`.
