#!/usr/bin/env bash
set -euo pipefail
knob_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
mkdir -p "$knob_dir/build"
swiftc -swift-version 5 -O -target "$(uname -m)-apple-macos13.0" \
  -module-cache-path "${TMPDIR:-/tmp}/smooth-next-swift-cache" \
  "$knob_dir/KnobBridge.swift" -o "$knob_dir/build/smooth-next-knob" \
  -framework Cocoa -framework Carbon -framework IOKit -framework Network
printf '%s\n' "$knob_dir/build/smooth-next-knob"
