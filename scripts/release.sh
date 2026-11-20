#!/usr/bin/env bash
# Release: turboversion bumps every package to the same version (sync mode), commits and tags
# vX.Y.Z (version.config.json). Its per-package CHANGELOG.md files are replaced by a single
# CHANGELOG.md at the root, regenerated from the whole history by conventional-changelog, and
# the root package.json takes the same version; all of it in the release commit and its tag.
# Arguments go to turboversion (--bump patch|minor|major).
# Run by the Release workflow (which pushes, builds the release, publishes it and deploys it to
# staging), or by hand followed by git push --follow-tags (the tag triggers the same Release
# workflow). Production is the separate Deploy workflow.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "Release depuis main uniquement." >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Arbre de travail non propre." >&2; exit 1; }

before="$(git rev-parse HEAD)"
pnpm exec turboversion "$@"
[ "$(git rev-parse HEAD)" != "$before" ] || exit 0 # nothing to release

tag="$(git describe --tags --exact-match HEAD)"
message="$(git tag -l --format='%(contents)' "$tag")"
changelogs=(apps/*/CHANGELOG.md packages/*/CHANGELOG.md deploy/CHANGELOG.md)
git rm -q --ignore-unmatch "${changelogs[@]}"
rm -f "${changelogs[@]}"
npm pkg set version="${tag#v}"
node scripts/changelog.mjs
pnpm exec prettier --write CHANGELOG.md >/dev/null
git add package.json CHANGELOG.md
git commit -q --amend --no-edit --no-verify
git tag -f -a -m "$message" "$tag" >/dev/null # moved onto the amended commit, not pushed yet
echo "Release $tag prête : git push --follow-tags"
