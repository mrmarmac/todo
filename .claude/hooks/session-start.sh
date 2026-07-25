#!/bin/bash
# Install dependencies so a fresh Claude Code on the web session can run the
# test suite, the linter, and the build on its first tool call.
#
# Web sessions start from a clone with no node_modules, so without this the
# session's first `npm test` fails with "vitest: not found" and it has to stop
# and install before it can verify anything.
#
# Local sessions already have their own node_modules and are left alone.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# `npm install` rather than `npm ci`: the container image is cached after this
# hook completes, and install reuses an existing node_modules where ci always
# deletes and refetches. It is also idempotent, so re-runs are cheap.
npm install --no-audit --no-fund
