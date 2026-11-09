#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -gt 1 || ( "$#" -eq 1 && "$1" != --gmmk3 ) ]]; then
  printf '%s\n' 'Usage: bash macos/install.sh [--gmmk3]' >&2
  exit 1
fi
knob_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
[[ "$(uname -s)" == Darwin ]] || { printf '%s\n' 'This companion requires macOS.' >&2; exit 1; }
if [[ ! -x "$knob_dir/build/smooth-next-knob" ]] || ! file "$knob_dir/build/smooth-next-knob" | grep -q "$(uname -m)"; then
  bash "$knob_dir/build.sh"
fi
spicetify_bin="$(command -v spicetify || true)"
[[ -n "$spicetify_bin" ]] || spicetify_bin="$HOME/.spicetify/spicetify"
config_path="$("$spicetify_bin" -c)"
[[ -f "$config_path" ]] || { printf '%s\n' 'Spicetify configuration was not found.' >&2; exit 1; }
extensions_dir="$(dirname -- "$config_path")/Extensions"
mkdir -p "$extensions_dir"
for extension in smooth-next.js smooth-next-knob.js; do
  if [[ -f "$extensions_dir/$extension" ]]; then cp -p "$extensions_dir/$extension" "$extensions_dir/$extension.bak"; fi
done
cp "$knob_dir/../smooth-next.js" "$extensions_dir/smooth-next.js"
cp "$knob_dir/smooth-next-knob.js" "$extensions_dir/smooth-next-knob.js"
"$spicetify_bin" config extensions smooth-next.js
"$spicetify_bin" config extensions smooth-next-knob.js
# The environment flag is only useful when the identical extensions were
# already applied during a live verification; normal installation applies them.
if [[ "${SMOOTH_NEXT_ALREADY_APPLIED:-0}" != 1 ]]; then "$spicetify_bin" apply; fi
python3 "$knob_dir/manage.py" install "$@"
