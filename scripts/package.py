#!/usr/bin/env python3
"""Validate Marketplace metadata and package only the public release files."""
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "smooth-next.js", "smooth-next.test.cjs", "install.sh", "manifest.json",
    "README.md", "README.tr.md", "CHANGELOG.md", "LICENSE", "preview.svg",
    "PUBLISHING.md", "scripts/package.py", ".gitignore",
    "macos/README.tr.md", "macos/KnobBridge.swift", "macos/build.sh",
    "macos/install.sh", "macos/uninstall.sh", "macos/manage.py",
    "macos/smooth-next-knob.js", "macos/build/smooth-next-knob",
)

source = (ROOT / "smooth-next.js").read_text(encoding="utf-8")
version = re.search(r"^// VERSION: (\d+\.\d+\.\d+)$", source, re.M).group(1)
assert f'version: "{version}"' in source, "Source version fields disagree"
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
assert isinstance(manifest, list) and len(manifest) == 1
for entry in manifest:
    for field in ("name", "description", "preview", "main", "readme"):
        assert isinstance(entry[field], str) and entry[field], f"Missing {field}"
    for field in ("preview", "main", "readme"):
        assert entry[field] in FILES and (ROOT / entry[field]).is_file(), f"Invalid {field}"
ET.parse(ROOT / "preview.svg")

output = ROOT / "dist"
output.mkdir(exist_ok=True)
archive = output / f"smooth-next-{version}.zip"
prefix = f"smooth-next-{version}/"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for name in FILES:
        data = (ROOT / name).read_bytes()
        info = zipfile.ZipInfo(prefix + name, date_time=(2026, 11, 6, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        executable = name.endswith(".sh") or name == "macos/build/smooth-next-knob"
        info.external_attr = (0o100755 if executable else 0o100644) << 16
        bundle.writestr(info, data)

with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert set(bundle.namelist()) == {prefix + name for name in FILES}
    for name in FILES:
        assert bundle.read(prefix + name) == (ROOT / name).read_bytes()

checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / (archive.name + ".sha256")).write_text(f"{checksum}  {archive.name}\n", encoding="ascii")
print(f"Validated manifest and {len(FILES)} release files")
print(f"ZIP: {archive}")
print(f"SHA-256: {checksum}")
