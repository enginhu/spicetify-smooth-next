#!/usr/bin/env bash
set -euo pipefail
knob_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
mkdir -p "$knob_dir/build"
swiftc -swift-version 5 -target "$(uname -m)-apple-macos13.0" \
  -module-cache-path "${TMPDIR:-/tmp}/smooth-next-swift-cache" \
  "$knob_dir/BridgeState.swift" "$knob_dir/BridgeStateTests.swift" \
  -o "$knob_dir/build/bridge-state-tests"
"$knob_dir/build/bridge-state-tests"
