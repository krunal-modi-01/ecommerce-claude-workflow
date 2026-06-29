#!/usr/bin/env bash
# Block the agent from stopping if the project doesn't build/test/lint clean.
set -e
npm run typecheck && npm test && npm run lint || { echo "Verification failed — fix before stopping." >&2; exit 2; }
exit 0