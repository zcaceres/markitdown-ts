#!/usr/bin/env bash
set -euo pipefail

# Publish markitdown-typescript to npm
# Usage: ./scripts/publish.sh [--dry-run]

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "==> Dry run mode"
fi

LOCAL_VERSION=$(node -p "require('./package.json').version")
REMOTE_VERSION=$(npm view markitdown-typescript version 2>/dev/null || echo "")

if [[ -z "$DRY_RUN" && -n "$REMOTE_VERSION" && "$LOCAL_VERSION" == "$REMOTE_VERSION" ]]; then
  echo "Error: version $LOCAL_VERSION is already published. Bump version in package.json first."
  exit 1
fi

echo "==> Version: $LOCAL_VERSION"
echo "==> Running tests..."
bun test

echo "==> Building..."
bun run build

echo "==> Package contents:"
npm pack --dry-run 2>&1

if [[ -n "$DRY_RUN" ]]; then
  echo "==> Dry run complete. Run without --dry-run to publish."
else
  echo "==> Publishing to npm..."
  npm publish --access public
  echo "==> Done!"
fi
