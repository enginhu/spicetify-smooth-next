#!/usr/bin/env bash
set -euo pipefail
knob_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
python3 "$knob_dir/manage.py" uninstall
spicetify_bin="$(command -v spicetify || true)"
[[ -n "$spicetify_bin" ]] || spicetify_bin="$HOME/.spicetify/spicetify"
"$spicetify_bin" config extensions smooth-next-knob.js-
"$spicetify_bin" apply
printf '%s\n' 'Knob yönlendirmesi kaldırıldı. Smooth Next düğme/klavye desteği duruyor.'
