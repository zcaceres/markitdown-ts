#!/usr/bin/env bash
set -euo pipefail

# Publish markitdown-typescript to npm
# Usage: ./scripts/publish.sh [--dry-run]

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "==> Dry run mode"
fi

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
