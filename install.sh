#!/usr/bin/env bash
set -euo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
spicetify_bin="$(command -v spicetify || true)"
if [[ -z "$spicetify_bin" && -x "$HOME/.spicetify/spicetify" ]]; then
  spicetify_bin="$HOME/.spicetify/spicetify"
fi
if [[ -z "$spicetify_bin" ]]; then
  printf '%s\n' 'Spicetify bulunamadı. Önce Spicetify kurulumunu tamamlayın.' >&2
  exit 1
fi

config_path="$("$spicetify_bin" -c)"
if [[ ! -f "$config_path" ]]; then
  printf '%s\n' "Spicetify yapılandırması bulunamadı: $config_path" >&2
  exit 1
fi
extensions_dir="$(dirname -- "$config_path")/Extensions"
mkdir -p "$extensions_dir"
if [[ -f "$extensions_dir/smooth-next.js" ]]; then
  cp -p "$extensions_dir/smooth-next.js" "$extensions_dir/smooth-next.js.bak"
fi
cp "$script_dir/smooth-next.js" "$extensions_dir/smooth-next.js"
"$spicetify_bin" config extensions smooth-next.js
printf '%s\n' 'Smooth Next uygulanıyor. Spotify yeniden başlayabilir.'
"$spicetify_bin" apply
printf '%s\n' 'Kuruldu. Spotify profil menüsünden Smooth Next açılıp kapatılabilir.'
