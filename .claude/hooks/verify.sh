#!/usr/bin/env bash
# Block the agent from stopping if the project doesn't build/test/lint clean.
# Skips any script not yet defined in package.json.
set -e

run_if_defined() {
  local script=$1
  if npm run 2>/dev/null | grep -qE "^\s+$script$"; then
    npm run "$script" || { echo "Verification failed on '$script' — fix before stopping." >&2; exit 2; }
  fi
}

run_if_defined typecheck
run_if_defined test
run_if_defined lint
