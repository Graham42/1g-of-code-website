#!/bin/bash
set -e
bun scripts/fetch-twitch-videos.ts "$@"
bun run format -- src/content/episodes

git add src/content/episodes src/assets/episodes

if git diff --cached --quiet; then
  echo "Nothing to commit — no new or updated episodes."
  exit 0
fi

ADDED=$(git diff --cached --name-only --diff-filter=A | grep -c '\.' || true)
MODIFIED=$(git diff --cached --name-only --diff-filter=M | grep -c '\.' || true)

MSG="fetch episodes: ${ADDED} added, ${MODIFIED} updated"
git commit -m "$MSG"
